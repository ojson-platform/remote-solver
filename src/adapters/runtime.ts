import {existsSync} from 'node:fs';
import path from 'node:path';

import {run, cursor} from '@ai-hero/sandcastle';

import {branchName} from '../machine/naming.ts';
import type {Runtime, SkillRun} from '../machine/port.ts';
import {modelFor, modeOfSkill} from '../machine/skill.ts';
import {hostSandbox} from './host-sandbox.ts';
import {ensureIssueBranch} from './vcs.ts';

const LINKED = ['context.md', 'skills', 'prompts', 'sdd.ts', 'accept.ts', '.env'] as const;

export type SandcastleRuntimeConfig = {
  /** Repository the worktrees are created in. */
  root: string;
  skillsDir: string;
  branchPrefix: string;
  /** Ref a missing issue branch is cut from. */
  baseBranch: string;
  /** Checkout whose `.sandcastle` and `node_modules` the worktree links. */
  linkRoot: string;
};

function shQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

/**
 * Host hook sandcastle runs with cwd set to the issue worktree. The worktree
 * does not contain this gitignored machine, so the agent reaches it through
 * these links. Node resolves a symlinked `sdd.ts` from its real path.
 */
export function linkCommand(linkRoot: string): string {
  const steps = ['mkdir -p .sandcastle'];
  const box = path.join(linkRoot, '.sandcastle');
  for (const name of LINKED) {
    const from = path.join(box, name);
    if (existsSync(from)) {
      steps.push(`ln -sfn ${shQuote(from)} .sandcastle/${name}`);
    }
  }
  const modules = path.join(linkRoot, 'node_modules');
  if (existsSync(modules)) {
    steps.push(`ln -sfn ${shQuote(modules)} node_modules`);
  }
  return steps.join(' && ');
}

export function sandcastleRuntime(config: SandcastleRuntimeConfig): Runtime {
  return {
    async run(skill: SkillRun) {
      ensureIssueBranch(config.root, skill.key, {branchPrefix: config.branchPrefix, defaultBranch: config.baseBranch});
      const mode = modeOfSkill(config.skillsDir, skill.skill);
      const result = await run({
        name: skill.action,
        sandbox: hostSandbox(),
        agent: cursor(modelFor(mode)),
        promptFile: path.join(config.root, '.sandcastle', 'prompts', 'sdd.md'),
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
          branch: branchName(skill.key, config.branchPrefix),
          baseBranch: config.baseBranch,
        },
        cwd: config.root,
        hooks: {
          host: {
            onWorktreeReady: [{command: linkCommand(config.linkRoot)}],
          },
        },
      });
      return {commits: result.commits.length};
    },
  };
}
