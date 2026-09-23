import {existsSync, mkdirSync, symlinkSync} from 'node:fs';
import path from 'node:path';

import {Output, cursor, run, type AgentStreamEvent} from '@ai-hero/sandcastle';

import {branchName} from '../machine/naming.ts';
import type {Runtime, RuntimeAsk, SkillRun} from '../machine/port.ts';
import {modelFor, modeOfSkill} from '../machine/skill.ts';
import {hostSandbox} from './host-sandbox.ts';
import {ensureIssueBranch} from './vcs.ts';

const LINKED = [
  ['skills', 'skills'],
  ['prompts', 'prompts'],
  ['src/sdd.ts', 'sdd.ts'],
  ['src/accept.ts', 'accept.ts'],
  ['.env', '.env'],
] as const;

export type SandcastleRuntimeConfig = {
  /** Repository the worktrees are created in. */
  root: string;
  skillsDir: string;
  branchPrefix: string;
  /** Ref a missing issue branch is cut from. */
  baseBranch: string;
  /** This package. Its files are linked into the issue worktree. */
  solverRoot: string;
};

function shQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

/**
 * Host hook sandcastle runs with cwd set to the issue worktree. The worktree
 * is a checkout of the service, so the agent reaches this package through
 * these links. Node resolves a symlinked `sdd.ts` from its real path, and the
 * service `node_modules` stays the worktree's own.
 */
export function linkCommand(solverRoot: string, serviceRoot: string): string {
  const steps = ['mkdir -p .sandcastle'];
  for (const [fromName, toName] of LINKED) {
    const from = path.join(solverRoot, fromName);
    if (existsSync(from)) {
      steps.push(`ln -sfn ${shQuote(from)} .sandcastle/${toName}`);
    }
  }
  const modules = path.join(serviceRoot, 'node_modules');
  if (existsSync(modules)) {
    steps.push(`ln -sfn ${shQuote(modules)} node_modules`);
  }
  return steps.join(' && ');
}

/** Same path sandcastle uses for a file log: `/` in the branch becomes `-`. */
export function agentLogPath(root: string, branch: string, name: string): string {
  const safeBranch = branch.replace(/[/\\:*?"<>|]/g, '-');
  const suffix = name.toLowerCase().replace(/[^a-z0-9_.-]/g, '-');
  return path.join(root, '.sandcastle', 'logs', `${safeBranch}-${suffix}.log`);
}

export type AgentLogPiece = {text: string; atLineStart: boolean};

/**
 * Text stays in the open log. A tool call becomes a GitHub Actions group, so
 * the step shows the model's words and hides the call until it is expanded.
 * Raw stream JSON is dropped.
 */
export function renderAgentEvent(event: AgentStreamEvent, atLineStart: boolean): AgentLogPiece {
  if (event.type === 'raw') {
    return {text: '', atLineStart};
  }
  if (event.type === 'text') {
    return {
      text: event.message,
      atLineStart: event.message.endsWith('\n') ? true : event.message.length === 0 ? atLineStart : false,
    };
  }
  const name = event.name.replace(/[\r\n]/g, ' ').trim() || 'tool';
  const args = event.formattedArgs.trim();
  const short = args.length > 0 && args.length <= 100 && !args.includes('\n');
  const title = short ? `${name} ${args}` : name;
  const body = short ? '' : args;
  const lead = atLineStart ? '' : '\n';
  const inside = body ? `${body}\n` : '';
  return {text: `${lead}::group::${title}\n${inside}::endgroup::\n`, atLineStart: true};
}

/** The sandcastle library reads `<service>/.sandcastle/.env`. Point that at this package. */
export function ensureServiceEnv(serviceRoot: string, solverRoot: string): void {
  const from = path.join(solverRoot, '.env');
  if (!existsSync(from)) {
    return;
  }
  const dir = path.join(serviceRoot, '.sandcastle');
  mkdirSync(dir, {recursive: true});
  const to = path.join(dir, '.env');
  if (existsSync(to)) {
    return;
  }
  symlinkSync(from, to);
}

export function sandcastleRuntime(config: SandcastleRuntimeConfig): Runtime {
  return {
    async ask(request: RuntimeAsk) {
      ensureServiceEnv(config.root, config.solverRoot);
      const logPath = agentLogPath(config.root, request.branch, request.name);
      console.log(`::group::${request.name} agent`);
      let atLineStart = true;
      try {
        const result = await run({
          name: request.name,
          sandbox: hostSandbox(),
          agent: cursor(modelFor(request.mode)),
          promptFile: request.promptFile,
          promptArgs: request.promptArgs,
          output: Output.string({tag: request.outputTag}),
          maxIterations: 1,
          logging: {
            type: 'file',
            path: logPath,
            onAgentStreamEvent(event) {
              const piece = renderAgentEvent(event, atLineStart);
              atLineStart = piece.atLineStart;
              if (piece.text) {
                process.stdout.write(piece.text);
              }
            },
          },
          branchStrategy: {
            type: 'branch',
            branch: request.branch,
            baseBranch: config.baseBranch,
          },
          cwd: config.root,
        });
        return result.output;
      } finally {
        if (!atLineStart) {
          process.stdout.write('\n');
        }
        console.log('::endgroup::');
      }
    },
    async run(skill: SkillRun) {
      ensureIssueBranch(config.root, skill.key, {
        branchPrefix: config.branchPrefix,
        defaultBranch: config.baseBranch,
      });
      ensureServiceEnv(config.root, config.solverRoot);
      const mode = modeOfSkill(config.skillsDir, skill.skill);
      const branch = branchName(skill.key, config.branchPrefix);
      const result = await run({
        name: skill.action,
        sandbox: hostSandbox(),
        agent: cursor(modelFor(mode)),
        promptFile: path.join(config.solverRoot, 'prompts', 'sdd.md'),
        promptArgs: {
          ISSUE: skill.key,
          ACTION: skill.action,
          PHASE: skill.phase,
          PR: skill.pull,
          SKILL: skill.skill,
        },
        maxIterations: 1,
        branchStrategy: {
          type: 'branch',
          branch,
          baseBranch: config.baseBranch,
        },
        cwd: config.root,
        hooks: {
          host: {
            onWorktreeReady: [{command: linkCommand(config.solverRoot, config.root)}],
          },
        },
      });
      return {commits: result.commits.length};
    },
  };
}
