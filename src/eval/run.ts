import {execFileSync} from 'node:child_process';
import {cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

import {cursor} from '@ai-hero/sandcastle';

import {runAgent} from '../adapters/runtime/agent.ts';
import {assembledStep} from '../machine/skill/hook.ts';
import {modelFor, skillMode} from '../machine/skill/mode.ts';

import {cases, commandExit, familyNames, requestedFamily, requestedId, type EvalCase} from './cases.ts';
import {aggregate, type Attempt} from './score.ts';
import {prepareSession, sessionPrompt} from './session.ts';

const attempts = 3;

/**
 * Exit 1: a forbidden action, or the required action missed twice.
 * Exit 2: the action was not read.
 * One miss beside two passes is exit 0 and stays visible in the table.
 */
export async function main(argv: string[], root: string): Promise<number> {
  const family = requestedFamily(argv);
  if (family === undefined || !known(family)) {
    process.stdout.write(`${familyNames.join('\n')}\n`);
    return 2;
  }
  const id = requestedId(argv);
  const selected = (family === 'all' ? cases : cases.filter(item => item.family === family)).filter(
    item => id === undefined || item.id === id,
  );
  if (selected.length === 0) {
    process.stdout.write(`${family} has no cases\n`);
    return 2;
  }
  const verdicts = await Promise.all(selected.map(item => runCase(item, root)));
  return commandExit(verdicts);
}

function resultDir(root: string, item: EvalCase, index?: number): string {
  const label = process.env.EVAL_LABEL?.trim();
  const parts = [root, 'eval-results', item.family, item.id];
  if (label) {
    parts.push(label);
  }
  if (index !== undefined) {
    parts.push(String(index));
  }
  return path.join(...parts);
}

function keep(root: string, item: EvalCase, index: number, attempt: Attempt): void {
  const dest = resultDir(root, item, index);
  mkdirSync(dest, {recursive: true});
  writeFileSync(path.join(dest, 'answer.txt'), attempt.text);
  writeFileSync(path.join(dest, 'trace.txt'), attempt.trace.join('\n'));
  writeFileSync(path.join(dest, 'edited.txt'), attempt.edited.join('\n'));
  if (attempt.log !== undefined) {
    writeFileSync(path.join(dest, 'log.txt'), attempt.log);
  }
}

function known(family: string): boolean {
  return family === 'all' || familyNames.includes(family as (typeof familyNames)[number]);
}

async function runCase(item: EvalCase, root: string): Promise<'pass' | 'fail' | 'inconclusive'> {
  const prompt = casePrompt(item, root);
  const promptDir = resultDir(root, item);
  mkdirSync(promptDir, {recursive: true});
  writeFileSync(path.join(promptDir, 'prompt.txt'), prompt);
  const verdicts = [];
  for (let index = 1; index <= attempts; index += 1) {
    let attempt: Attempt;
    try {
      attempt = await oneAttempt(item, root, prompt, index);
    } catch (error) {
      attempt = {text: error instanceof Error ? error.message : String(error), trace: [], edited: []};
    }
    const verdict = item.score(attempt);
    verdicts.push(verdict);
    process.stdout.write(`${item.family}\t${item.id}\t${index}\t${verdict}\n`);
    keep(root, item, index, attempt);
  }
  const score = aggregate(verdicts);
  process.stdout.write(`${item.family}\t${item.id}\tcase\t${score.verdict}\t${score.because}\n`);
  return score.verdict;
}

function casePrompt(item: EvalCase, root: string): string {
  if (item.prompt === 'skill') {
    const skill = readFileSync(path.join(root, '.agents/skills/sdd-final-review/SKILL.md'), 'utf8');
    return `The finished change is this directory. The base is master. The issue key is 1.\n\n${skill}`;
  }
  if (item.prompt === 'session') {
    return sessionPrompt(item, root);
  }
  return assembledStep({
    solverRoot: root,
    serviceRoot: root,
    skill: item.skill,
    action: item.action,
    sddHooks: undefined,
  });
}

/** A clone has the fixture files and no nested git dir. The agent diffs against master. */
function ensureFixtureGit(dir: string): void {
  if (existsSync(path.join(dir, '.git'))) {
    return;
  }
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: 'eval',
    GIT_AUTHOR_EMAIL: 'eval@example.com',
    GIT_COMMITTER_NAME: 'eval',
    GIT_COMMITTER_EMAIL: 'eval@example.com',
  };
  const git = (...args: string[]) => execFileSync('git', args, {cwd: dir, env});
  git('init', '-b', 'master');
  git('commit', '--allow-empty', '-m', 'base');
  git('checkout', '-b', 'sdd/1');
  git('add', '-A');
  git('commit', '-m', 'change');
}

async function oneAttempt(item: EvalCase, root: string, prompt: string, index: number): Promise<Attempt> {
  const source = path.join(root, 'eval', item.family, item.id, 'fixture');
  const cwd = mkdtempSync(path.join(tmpdir(), `eval-${item.family}-${item.id}-`));
  const trace = path.join(cwd, 'eval-trace.log');
  try {
    if (existsSync(source)) {
      cpSync(source, cwd, {recursive: true});
    }
    if (item.prompt === 'session') {
      prepareSession(cwd, root, item);
    }
    ensureFixtureGit(cwd);
    if (item.family === 'repair-suite') {
      const skillDir = path.join(root, '.agents/skills/sdd-final-review');
      if (existsSync(skillDir)) {
        cpSync(skillDir, path.join(cwd, '.agents/skills/sdd-final-review'), {recursive: true});
      }
    }
    writeFileSync(trace, '');
    const bin = path.join(cwd, 'bin');
    mkdirSync(bin, {recursive: true});
    const before = snapshot(cwd);
    const logPath = path.join(cwd, `attempt-${index}.log`);
    const answer = await runAgent({
      cwd,
      hostCwd: root,
      provider: cursor(modelFor(skillMode(prompt)), {
        captureSessions: false,
        env: {
          PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`,
          EVAL_TRACE: trace,
        },
      }),
      name: item.id,
      prompt,
      promptFile: path.join(root, '.agents/skills/sdd-final-review/SKILL.md'),
      promptArgs: {},
      logPath,
    });
    const log = existsSync(logPath) ? readFileSync(logPath, 'utf8') : '';
    return {text: answer.text, trace: readTrace(trace), edited: changed(before, cwd), files: texts(cwd), log};
  } finally {
    rmSync(cwd, {recursive: true, force: true});
  }
}

function readTrace(file: string): string[] {
  if (!existsSync(file)) {
    return [];
  }
  return readFileSync(file, 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '');
}

function texts(dir: string): Record<string, string> {
  const files: Record<string, string> = {};
  walk(dir, dir, (relative, body) => {
    if (relative.startsWith('.git/') || relative.startsWith('bin/') || relative.startsWith('eval-trace') || relative.startsWith('attempt-')) {
      return;
    }
    files[relative] = body.toString('utf8');
  });
  return files;
}

function snapshot(dir: string): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  walk(dir, dir, (relative, body) => {
    files.set(relative, body);
  });
  return files;
}

function changed(before: Map<string, Buffer>, copy: string): string[] {
  const found: string[] = [];
  walk(copy, copy, (relative, body) => {
    if (relative.startsWith('eval-trace') || relative.startsWith('attempt-') || relative.startsWith('.git/')) {
      return;
    }
    const prior = before.get(relative);
    if (prior === undefined || Buffer.compare(prior, body) !== 0) {
      found.push(relative);
    }
  });
  return found;
}

function walk(root: string, dir: string, visit: (relative: string, body: Buffer) => void): void {
  for (const name of readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) {
      walk(root, full, visit);
      continue;
    }
    if (!name.isFile()) {
      continue;
    }
    visit(path.relative(root, full), readFileSync(full));
  }
}

if (process.argv[1]?.endsWith('run.mjs') || process.argv[1]?.endsWith('run.ts')) {
  const root = process.cwd();
  main(process.argv.slice(2), root).then(
    code => process.exit(code),
    error => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    },
  );
}
