import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {vi} from 'vitest';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import type {AgentRun} from './agent.ts';
import {launcherRuntime} from '../cli.ts';
import {contentRevision} from '../machine/change.ts';
import {action, change, issue, pull} from '../machine/harness.ts';
import {accept, decide} from '../machine/policy.ts';
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

function repo(): string {
  return mkdtempSync(path.join(tmpdir(), 'sdd-upstream-'));
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
  requirement('The writing prompt carries the input revision', () => {
    scenario('A design run after a spec edit carries that text', async () => {
      const root = repo();
      const change = 'openspec/changes/issue-6';
      write(root, `${change}/design.md`, '# design\n');
      write(
        root,
        `${change}/specs/unsent-remark/spec.md`,
        'A refused send from «Записать» does not post a conversation comment.\n',
      );
      const upstream = await promptOf(root, 'design', 'designing');
      assert.match(upstream, /does not post a conversation comment/);
      assert.match(upstream, /The input revision is/);
      assert.equal(upstream.includes('matches the input revision'), false);
      assert.equal(upstream.includes('```diff'), false);
    });

    scenario('A design run whose stamp matches says so in one sentence', async () => {
      const root = repo();
      const change = 'openspec/changes/issue-6';
      const specText = 'A remark stays until send.\n';
      const specPath = `${change}/specs/unsent-remark/spec.md`;
      const revision = contentRevision([{path: specPath, text: specText}]);
      write(root, `${change}/design.md`, `# design\nsdd-absorbed: ${revision}\n`);
      write(root, specPath, specText);
      const upstream = await promptOf(root, 'design', 'designing');
      assert.match(
        upstream,
        /The stamp in `openspec\/changes\/issue-6\/design\.md` matches the input revision/,
      );
      assert.equal(upstream.includes('A remark stays until send.'), false);
    });

    scenario('A design run before design.md exists says the file does not exist yet', async () => {
      const root = repo();
      write(root, 'openspec/changes/issue-6/proposal.md', '# proposal\n');
      const upstream = await promptOf(root, 'design', 'designing');
      assert.match(upstream, /design\.md` does not exist yet/);
    });

    scenario('A plan run says the issue text is the upstream', async () => {
      const upstream = await promptOf(repo(), 'plan', 'proposing');
      assert.match(upstream, /issue text above is the upstream of `proposal\.md`/);
      assert.match(upstream, /file existing is not a reason to leave it/);
    });

    scenario('A code run says the action has no previous artifact', async () => {
      const upstream = await promptOf(repo(), 'implement', 'implementing');
      assert.match(upstream, /This action has no previous artifact/);
    });

    scenario('A tasks run whose stamp matches names the delta revision', async () => {
      const root = repo();
      const dir = 'openspec/changes/issue-6';
      const specText = 'A remark stays until send.\n';
      const specPath = `${dir}/specs/unsent-remark/spec.md`;
      const designPath = `${dir}/design.md`;
      const designText = '# design\n';
      const revision = contentRevision([
        {path: specPath, text: specText},
        {path: designPath, text: designText},
      ]);
      const deltaRevision = contentRevision([{path: specPath, text: specText}]);
      write(root, designPath, designText);
      write(root, specPath, specText);
      write(root, `${dir}/tasks.md`, `# tasks\nsdd-absorbed: ${revision}\n`);
      const upstream = await promptOf(root, 'tasks', 'tasking');
      assert.match(upstream, /matches the input revision/);
      assert.match(upstream, /The delta revision is `/);
      assert.equal(upstream.includes(deltaRevision), true);
      assert.equal(upstream.includes('A remark stays until send.'), false);
    });

    scenario(
      'A run whose previous artifact cannot be read does not treat the file as already right',
      async () => {
        const root = repo();
        mkdirSync(path.join(root, 'openspec/changes/issue-6/design.md'), {recursive: true});
        const upstream = await promptOf(root, 'design', 'designing');
        assert.match(upstream, /could not be read/);
        assert.match(upstream, /Do not treat the existing file as already right/);
      },
    );
  });

  requirement('A stale stamp restarts the writing skill', () => {
    const behind = {
      proposalRevision: 'aaa',
      specStamp: 'bbb',
      specsRevision: 'ccc',
      designStamp: 'ddd',
      tasksInputRevision: 'eee',
      tasksStamp: 'fff',
    };
    scenario('A stale spec stamp restarts specify before the auto advance', () => {
      const decision = decide(
        issue(1, ['sdd:specifying', 'sdd:auto-spec']),
        [],
        [pull(9)],
        change({proposal: true, delta: true, ...behind}),
      );
      assert.equal(action(decision), 'create-initial-specs');
    });
    scenario('A matching spec stamp still opens the gate', () => {
      const decision = decide(
        issue(1, ['sdd:specifying']),
        [],
        [pull(9)],
        change({proposal: true, delta: true, proposalRevision: 'aaa', specStamp: 'aaa'}),
      );
      assert.equal(decision.kind, 'wait');
      if (decision.kind === 'wait') {
        assert.deepEqual(decision.gate, {artifact: 'spec', from: 'specifying', to: 'specified'});
      }
    });
    scenario('A phase file edited without moving the stamp restarts the skill', () => {
      const decision = decide(
        issue(1, ['sdd:designing']),
        [],
        [pull(9)],
        change({
          proposal: true,
          delta: true,
          design: true,
          designStamp: 'ccc',
          specsRevision: 'ccc',
          designDrift: true,
        }),
      );
      assert.equal(action(decision), 'create-design');
    });
    scenario('A stale design stamp restarts design before the auto advance', () => {
      const decision = decide(
        issue(1, ['sdd:designing', 'sdd:auto-design']),
        [],
        [pull(9)],
        change({proposal: true, delta: true, design: true, ...behind}),
      );
      assert.equal(action(decision), 'create-design');
    });
    scenario('A stale tasks stamp restarts tasks before implementing', () => {
      const decision = decide(
        issue(1, ['sdd:tasking']),
        [],
        [pull(9)],
        change({proposal: true, delta: true, design: true, tasks: true, ...behind}),
      );
      assert.equal(action(decision), 'create-tasks');
    });
    scenario('An open decision waits before a stale design stamp', () => {
      const decision = decide(
        issue(1, ['sdd:designing', 'sdd:auto-design']),
        [],
        [pull(9)],
        change({proposal: true, delta: true, design: true, openDecisions: 1, ...behind}),
      );
      assert.equal(decision.kind, 'wait');
      if (decision.kind === 'wait') {
        assert.match(decision.reason, /open decision/);
      }
    });
    scenario('Accept refuses a stale spec stamp', () => {
      const decision = accept(
        issue(1, ['sdd:cycle', 'sdd:specifying']),
        change({proposal: true, delta: true, ...behind}),
      );
      assert.equal(decision.kind, 'wait');
      if (decision.kind === 'wait') {
        assert.match(decision.reason, /not the stamp/);
      }
    });
  });
});
