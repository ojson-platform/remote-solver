import {spawn, spawnSync} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';

/** A path vitest collects. A helper under `__tests__` is not a test. */
export function isTestPath(file: string): boolean {
  return /(?:^|\/)[^/]+\.test\.(?:[cm]?[jt]sx?)$/.test(file);
}

export type DiffEntry = {status: string; path: string; from?: string};

/** `git diff --name-status -z` output, including renames. */
export function parseNameStatus(raw: string): DiffEntry[] {
  const parts = raw.split('\0').filter(part => part.length > 0);
  const entries: DiffEntry[] = [];
  let index = 0;
  while (index < parts.length) {
    const status = parts[index] ?? '';
    index += 1;
    if (status.startsWith('R') || status.startsWith('C')) {
      const from = parts[index] ?? '';
      const file = parts[index + 1] ?? '';
      index += 2;
      entries.push({status, from, path: file});
      continue;
    }
    entries.push({status, path: parts[index] ?? ''});
    index += 1;
  }
  return entries;
}

export function vitestArguments(
  root: string,
  files: string[],
  titles: readonly string[] = [],
): {bin: string; args: string[]} {
  const args = ['--run', '--reporter=default'];
  if (existsSync(path.join(root, 'vitest.config.mjs'))) {
    args.push('--config', 'vitest.config.mjs');
  }
  if (titles.length > 0) {
    args.push('-t', titles.map(title => title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'));
  }
  args.push(...files);
  return {bin: path.join(root, 'node_modules', '.bin', 'vitest'), args};
}

/** Runs the changed test files. A non-zero status is a red run. Titles limit the run to those scenarios. */
export function runVitest(root: string, files: string[], titles: readonly string[] = []): Promise<number> {
  const {bin, args} = vitestArguments(root, files, titles);
  if (!existsSync(bin)) {
    throw new Error(`vitest is not installed at ${bin}`);
  }
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {cwd: root, stdio: 'inherit'});
    child.on('error', reject);
    child.on('close', status => {
      resolve(status ?? 1);
    });
  });
}

type GitResult = {status: number; stdout: string; stderr: string};

function gitResult(root: string, args: string[]): GitResult {
  const result = spawnSync('git', args, {cwd: root, encoding: 'utf8'});
  return {status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? ''};
}

function gitOk(root: string, args: string[]): string {
  const result = gitResult(root, args);
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `git ${args.join(' ')} failed`);
  }
  return result.stdout;
}

function testFiles(entries: DiffEntry[]): string[] {
  return entries
    .filter(entry => !entry.status.startsWith('D') && isTestPath(entry.path))
    .map(entry => entry.path);
}

function onHead(root: string, file: string): boolean {
  return gitResult(root, ['cat-file', '-e', `HEAD:${file}`]).status === 0;
}

function toParent(root: string, entry: DiffEntry): void {
  if (entry.status.startsWith('A')) {
    gitOk(root, ['rm', '-f', '--ignore-unmatch', '--', entry.path]);
    return;
  }
  if ((entry.status.startsWith('R') || entry.status.startsWith('C')) && entry.from) {
    gitOk(root, ['checkout', 'HEAD^', '--', entry.from]);
    if (entry.path !== entry.from) {
      gitOk(root, ['rm', '-f', '--ignore-unmatch', '--', entry.path]);
    }
    return;
  }
  gitOk(root, ['checkout', 'HEAD^', '--', entry.path]);
}

function restoreHead(root: string, entries: DiffEntry[]): void {
  const paths = new Set<string>();
  for (const entry of entries) {
    paths.add(entry.path);
    if (entry.from) {
      paths.add(entry.from);
    }
  }
  for (const file of paths) {
    if (onHead(root, file)) {
      gitOk(root, ['checkout', 'HEAD', '--', file]);
    } else {
      gitOk(root, ['rm', '-f', '--ignore-unmatch', '--', file]);
    }
  }
}

/** Scenario titles a test file names with `scenario('...')`. */
export function scenarioTitles(text: string): string[] {
  return [...text.matchAll(/scenario\(\s*['"]([^'"]+)['"]/g)].flatMap(match => (match[1] ? [match[1]] : []));
}

/** Scenario titles this change's delta names. Archived changes do not count. */
export function deltaScenarioTitles(root: string): Set<string> {
  const listed = gitOk(root, ['ls-files', '--', 'openspec/changes']);
  const titles = new Set<string>();
  for (const file of listed.split('\n')) {
    if (!file.endsWith('/spec.md') || !file.includes('/specs/') || file.includes('/archive/')) {
      continue;
    }
    const text = readFileSync(path.join(root, file), 'utf8');
    for (const match of text.matchAll(/^#### Scenario:\s*(.+?)\s*$/gm)) {
      if (match[1]) {
        titles.add(match[1]);
      }
    }
  }
  return titles;
}

/** Scenario titles the stable specs name. A change delta does not count. */
export function stableScenarioTitles(root: string): Set<string> {
  const listed = gitOk(root, ['ls-files', '--', 'openspec/specs']);
  const titles = new Set<string>();
  for (const file of listed.split('\n')) {
    if (!file.endsWith('/spec.md') || !file.startsWith('openspec/specs/')) {
      continue;
    }
    const text = readFileSync(path.join(root, file), 'utf8');
    for (const match of text.matchAll(/^#### Scenario:\s*(.+?)\s*$/gm)) {
      if (match[1]) {
        titles.add(match[1]);
      }
    }
  }
  return titles;
}

/**
 * Scenario titles the changed tests name that the delta or a stable spec names.
 * A title neither names is dropped.
 */
export function proofTitles(root: string, tests: readonly string[]): string[] {
  const allowed = new Set([...deltaScenarioTitles(root), ...stableScenarioTitles(root)]);
  const named = new Set<string>();
  for (const file of tests) {
    for (const title of scenarioTitles(readFileSync(path.join(root, file), 'utf8'))) {
      if (allowed.has(title)) {
        named.add(title);
      }
    }
  }
  return [...named].sort();
}

/**
 * Refuses unless a scenario the HEAD commit changes, named by the delta or a
 * stable spec, fails against that commit's first parent and passes on HEAD. A
 * scenario neither names does not count. Restores the worktree either way.
 */
export async function proveCodeFix(
  root: string,
  run: (root: string, files: string[], titles: readonly string[]) => Promise<number> = runVitest,
): Promise<void> {
  if (gitOk(root, ['status', '--porcelain']).trim()) {
    throw new Error('the worktree is dirty: Publish, then thread fix.');
  }
  if (gitResult(root, ['rev-parse', '--verify', '--quiet', 'HEAD^']).status !== 0) {
    throw new Error('the answering commit has no parent: the new test cannot fail on one.');
  }
  const entries = parseNameStatus(gitOk(root, ['diff', '--name-status', '-z', 'HEAD^', 'HEAD']));
  const tests = testFiles(entries);
  if (tests.length === 0) {
    throw new Error(
      'the answering commit changes no test. Add a test that fails on the parent, or hand the thread off to spec.',
    );
  }
  const titles = proofTitles(root, tests);
  if (titles.length === 0) {
    throw new Error(
      "the answering test's scenario is not in the delta or a stable spec. Hand the thread off to spec.",
    );
  }
  const sources = entries.filter(entry => !isTestPath(entry.path));
  for (const entry of sources) {
    toParent(root, entry);
  }
  let parentStatus: number;
  try {
    parentStatus = await run(root, tests, titles);
  } finally {
    restoreHead(root, sources);
  }
  if (parentStatus === 0) {
    throw new Error(
      'a test the answering commit changes passes on the parent. It does not show the remark. Add a test that fails on the parent, or hand the thread off to spec.',
    );
  }
  if ((await run(root, tests, titles)) !== 0) {
    throw new Error('a test the answering commit changes fails on HEAD.');
  }
}
