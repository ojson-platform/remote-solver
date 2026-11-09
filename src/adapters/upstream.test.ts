import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {vi} from 'vitest';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import type {AgentRun} from './agent.ts';
import {launcherRuntime} from '../cli.ts';
import type {Vcs} from '../machine/port.ts';

const runAgent = vi.hoisted(() => vi.fn(async (_run: AgentRun) => ({text: ''})));

vi.mock('./agent.ts', () => ({runAgent}));

function idleVcs(root: string): Vcs {
  return {
    prepare: async () => root,
    tip: async () => 'abc',
    filesAt: () => ({exists: () => false, read: () => '', list: () => []}),
    compare: async () => null,
    push: async () => {},
    head: async () => 'abc',
    published: async () => true,
    dirty: async () => [],
  };
}

function git(cwd: string, args: string[]): void {
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    },
  });
}

function repo(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'sdd-upstream-'));
  git(root, ['init']);
  return root;
}

function write(root: string, rel: string, text: string): void {
  const file = path.join(root, rel);
  mkdirSync(path.dirname(file), {recursive: true});
  writeFileSync(file, text);
}

async function promptOf(root: string, skill: string, phase: string): Promise<string> {
  runAgent.mockClear();
  const runtime = launcherRuntime({
    root,
    vcs: idleVcs(root),
    config: {queues: [{name: 'FIRST'}], branchScope: 'sdd', base: 'trunk'},
  });
  await runtime.run({
    skill,
    action: 'create-design',
    key: '6',
    phase,
    pull: '9',
    mode: 'judgment',
    issue: {title: 'Hold the remark', body: 'The draft stays until send.'},
  });
  return runAgent.mock.calls[0]?.[0].promptArgs.UPSTREAM ?? '';
}

spec('artifact', () => {
  requirement('The writing prompt carries the upstream diff', () => {
    scenario('A design run after a spec edit carries that diff', async () => {
      const root = repo();
      const change = 'openspec/changes/issue-6';
      write(root, `${change}/design.md`, '# design\n');
      write(root, `${change}/specs/unsent-remark/spec.md`, 'A remark stays until send.\n');
      git(root, ['add', '.']);
      git(root, ['commit', '-m', 'design']);
      write(
        root,
        `${change}/specs/unsent-remark/spec.md`,
        'A refused send from «Записать» does not post a conversation comment.\n',
      );
      git(root, ['add', '.']);
      git(root, ['commit', '-m', 'spec']);
      const upstream = await promptOf(root, 'design', 'designing');
      assert.match(upstream, /does not post a conversation comment/);
      assert.equal(upstream.includes('has not changed'), false);
    });

    scenario(
      'A design run with no later spec edit says the previous artifact has not changed',
      async () => {
        const root = repo();
        const change = 'openspec/changes/issue-6';
        write(root, `${change}/design.md`, '# design\n');
        write(root, `${change}/specs/unsent-remark/spec.md`, 'A remark stays until send.\n');
        git(root, ['add', '.']);
        git(root, ['commit', '-m', 'together']);
        const upstream = await promptOf(root, 'design', 'designing');
        assert.match(upstream, /The previous artifact has not changed/);
      },
    );

    scenario('A design run before design.md exists says the file does not exist yet', async () => {
      const root = repo();
      write(root, 'openspec/changes/issue-6/proposal.md', '# proposal\n');
      git(root, ['add', '.']);
      git(root, ['commit', '-m', 'proposal']);
      const upstream = await promptOf(root, 'design', 'designing');
      assert.match(upstream, /design\.md` does not exist yet/);
    });

    scenario('A plan run says the issue text is the upstream', async () => {
      const upstream = await promptOf(repo(), 'plan', 'proposing');
      assert.match(upstream, /issue text above is the upstream of `proposal\.md`/);
      assert.match(upstream, /file existing is not a reason to leave it/);
    });

    scenario('A code run says the action has no upstream diff', async () => {
      const upstream = await promptOf(repo(), 'implement', 'implementing');
      assert.match(upstream, /This action has no upstream diff/);
    });

    scenario(
      'A run whose diff cannot be read does not treat the file as already right',
      async () => {
        const root = mkdtempSync(path.join(tmpdir(), 'sdd-upstream-none-'));
        const upstream = await promptOf(root, 'design', 'designing');
        assert.match(upstream, /could not be read/);
        assert.match(upstream, /Do not treat the existing file as already right/);
      },
    );
  });
});
