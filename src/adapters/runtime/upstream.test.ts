import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {vi} from 'vitest';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import type {AgentRun} from './agent.ts';
import {launcherRuntime} from '../../cli.ts';
import type {Vcs} from '../../machine.ts';
import {contentRevision} from '../../machine/change/stamp.ts';
import {accept, decide} from '../../machine/decide/policy.ts';
import {action, change, issue, pull} from '../../machine/__tests__/harness.ts';

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

async function promptOf(
  root: string,
  skill: string,
  phase: string,
  links?: readonly string[],
): Promise<string> {
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
    ...(links ? {links} : {}),
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
      assert.match(upstream, /file existing is not a reason to leave that sentence/);
      assert.match(upstream, /already replaced is not copied back/);
    });

    scenario('A code run says the action has no previous artifact', async () => {
      const upstream = await promptOf(repo(), 'implement', 'implementing');
      assert.match(upstream, /This action has no previous artifact/);
      assert.match(upstream, /The delta revision is `/);
      assert.match(upstream, /Every delta Scenario title is on a card/);
    });

    scenario('An implement run names a Scenario title on no card', async () => {
      const root = repo();
      write(
        root,
        'openspec/changes/issue-6/specs/hold/spec.md',
        '## ADDED Requirements\n\n### Requirement: Hold\n\n#### Scenario: The draft stays\n\n- **WHEN** the person records\n- **THEN** the draft stays\n',
      );
      const upstream = await promptOf(root, 'implement', 'implementing');
      const again = await promptOf(root, 'implement', 'implementing');
      assert.equal(again, upstream);
      assert.match(upstream, /Scenario titles on no card/);
      assert.match(upstream, /- The draft stays/);
    });

  });

  requirement('An untraced baseline is covered before the next task', () => {
    scenario('The cover prompt lists each untraced triple', async () => {
      const root = repo();
      const dir = 'openspec/changes/issue-6';
      write(
        root,
        `${dir}/proposal.md`,
        '## Capabilities\n\n### Modified\n\n- focus-prose keep\n',
      );
      write(
        root,
        `${dir}/design.md`,
        [
          '## Verification boundary',
          'trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`',
          'test path: `src/**/*.test.ts`',
          '',
        ].join('\n'),
      );
      write(
        root,
        `${dir}/specs/focus-prose/spec.md`,
        '## REMOVED Requirements\n\n### Requirement: The written prose is the words after the marker\n',
      );
      write(
        root,
        'openspec/specs/focus-prose/spec.md',
        [
          '## Requirements',
          '',
          '### Requirement: The written prose is the words after the marker',
          '',
          '#### Scenario: Marks stay the characters that were written',
          '',
          '### Requirement: This surface has no line comment and no diff row',
          '',
          '#### Scenario: The written prose has no line comment and no diff row',
          '',
        ].join('\n'),
      );
      const upstream = await promptOf(root, 'cover-baseline', 'implementing');
      assert.match(
        upstream,
        /focus-prose \/ This surface has no line comment and no diff row \/ The written prose has no line comment and no diff row/,
      );
      assert.equal(upstream.includes('Marks stay'), false);
    });
  });

  requirement('A matching tasks stamp names a card gap', () => {
    scenario('A matching tasks stamp names the card gap', async () => {
      const root = repo();
      const dir = 'openspec/changes/issue-6';
      const specText = [
        '## ADDED Requirements',
        '',
        '### Requirement: Hold',
        '',
        '#### Scenario: The draft stays',
        '',
        '- **WHEN** the person records',
        '- **THEN** the draft stays',
        '',
      ].join('\n');
      const specPath = `${dir}/specs/hold/spec.md`;
      const designPath = `${dir}/design.md`;
      const designText = '# design\n';
      const revision = contentRevision([
        {path: specPath, text: specText},
        {path: designPath, text: designText},
      ]);
      write(root, designPath, designText);
      write(root, specPath, specText);
      write(root, `${dir}/tasks.md`, `# tasks\nsdd-absorbed: ${revision}\n`);
      const upstream = await promptOf(root, 'tasks', 'tasking');
      assert.match(upstream, /matches the input revision/);
      assert.match(upstream, /the delta revision is not the card/);
      assert.match(upstream, /Do not Publish/);
    });
  });

  requirement('The writing prompt carries the input revision', () => {
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
      assert.match(upstream, /Linked issues: none/);
      assert.equal(upstream.includes(deltaRevision), true);
      assert.equal(upstream.includes('A remark stays until send.'), false);
    });

    scenario('A tasks run prints the issues already linked', async () => {
      const root = repo();
      write(root, 'openspec/changes/issue-6/tasks.md', '# tasks\n');
      const upstream = await promptOf(root, 'tasks', 'tasking', ['8']);
      assert.match(upstream, /Linked issues: #8/);
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
      assert.equal(action(decision), 'improve-specs');
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
    scenario('A phase file edited without moving the stamp stays on the gate', () => {
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
      assert.equal(decision.kind, 'wait');
      if (decision.kind === 'wait') {
        assert.deepEqual(decision.gate, {artifact: 'design', from: 'designing', to: 'designed'});
      }
    });
    scenario('A spec edited without moving the stamp stays on the gate', () => {
      const decision = decide(
        issue(1, ['sdd:specifying']),
        [],
        [pull(9)],
        change({
          proposal: true,
          delta: true,
          proposalRevision: 'aaa',
          specStamp: 'aaa',
          specDrift: true,
        }),
      );
      assert.equal(decision.kind, 'wait');
      if (decision.kind === 'wait') {
        assert.deepEqual(decision.gate, {artifact: 'spec', from: 'specifying', to: 'specified'});
      }
    });
    scenario('A tasks file edited without moving the stamp still advances', () => {
      const decision = decide(
        issue(1, ['sdd:tasking']),
        [],
        [pull(9)],
        change({
          proposal: true,
          delta: true,
          design: true,
          tasks: true,
          tasksInputRevision: 'eee',
          tasksStamp: 'eee',
          tasksDrift: true,
        }),
      );
      assert.equal(decision.kind, 'advance');
      if (decision.kind === 'advance') {
        assert.equal(decision.to, 'implementing');
      }
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
