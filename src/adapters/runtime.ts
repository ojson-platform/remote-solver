import {existsSync, mkdirSync, symlinkSync} from 'node:fs';
import path from 'node:path';

import type {AgentStreamEvent} from '@ai-hero/sandcastle';

import {branchName} from '../machine/naming.ts';
import type {Runtime, RuntimeAsk, SkillRun, Vcs} from '../machine/port.ts';
import {agentFor} from '../machine/skill.ts';
import {runAgent} from './agent.ts';
import {linkCommand as checkoutLinks, packageLinks} from './vcs.ts';

/** The hook sandcastle runs. Links whatever of this package is on disk. */
export function linkCommand(solverRoot: string, serviceRoot: string): string {
  return checkoutLinks(packageLinks(solverRoot), serviceRoot);
}

export type AgentRuntimeConfig = {
  /** Repository the worktrees are created in. */
  root: string;
  vcs: Vcs;
  branchPrefix: string;
  /** Queue label and pull request base. The prompt names them for the skill. */
  queueLabel: string;
  prBase: string;
  /** This package. Its files are linked into the issue worktree. */
  solverRoot: string;
};

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

const WORKTREES = '.sandcastle/worktrees';

function keyFromBranch(branch: string, prefix: string): string {
  const head = `${prefix}/`;
  return branch.startsWith(head) ? branch.slice(head.length) : branch.slice(branch.indexOf('/') + 1);
}

function commitCount(vcs: Vcs, before: string, after: string): number {
  if (before === after) {
    return 0;
  }
  const range = vcs.compare(before, after);
  if (!range?.commits.trim()) {
    return 0;
  }
  return range.commits.split('\n').filter(line => line.trim()).length;
}

/** One runtime for every host. The checkout is whatever `vcs` prepares. */
export function agentRuntime(config: AgentRuntimeConfig): Runtime {
  const checkout = (key: string) =>
    config.vcs.prepare(key, {worktreesDir: WORKTREES, links: packageLinks(config.solverRoot)});
  return {
    async run(skill: SkillRun) {
      const dir = checkout(skill.key);
      const before = config.vcs.tip(skill.key);
      ensureServiceEnv(config.root, config.solverRoot);
      const answer = await runAgent({
        cwd: dir,
        hostCwd: config.root,
        provider: agentFor(skill.mode),
        name: skill.action,
        promptFile: path.join(config.solverRoot, 'prompts', 'sdd.md'),
        promptArgs: {
          ISSUE: skill.key,
          ACTION: skill.action,
          PHASE: skill.phase,
          PR: skill.pull,
          SKILL: skill.skill,
          QUEUE: config.queueLabel,
          BASE: config.prBase,
        },
        logPath: agentLogPath(config.root, branchName(skill.key, config.branchPrefix), skill.action),
        resumeSession: skill.resumeSession,
      });
      return {
        commits: commitCount(config.vcs, before, config.vcs.tip(skill.key)),
        sessionId: answer.sessionId,
        usage: answer.usage,
      };
    },
    async ask(request: RuntimeAsk) {
      const key = keyFromBranch(request.branch, config.branchPrefix);
      const dir = checkout(key);
      ensureServiceEnv(config.root, config.solverRoot);
      return runAgent({
        cwd: dir,
        hostCwd: config.root,
        provider: agentFor(request.mode),
        name: request.name,
        promptFile: request.promptFile,
        promptArgs: request.promptArgs,
        logPath: agentLogPath(config.root, request.branch, request.name),
        outputTag: request.outputTag,
      });
    },
  };
}
