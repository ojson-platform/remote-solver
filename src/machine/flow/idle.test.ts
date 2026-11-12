import assert from 'node:assert/strict';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {machine, type Machine} from '../../adapters/compose.ts';
import {memoryPorts} from '../../adapters/tracker/github.ts';
import {tryHoldIssue} from '../../adapters/runtime/lock.ts';
import {readChat, rememberChat} from '../../adapters/runtime/session.ts';
import {resolveCycle} from './flow.ts';
import {files} from '../__tests__/harness.ts';
import type {Runtime, Vcs} from '../port.ts';
import type {Decision} from '../decide/policy.ts';
import {loadCycle} from '../spy/snapshot.ts';
import {exited, tick, type State} from '../spy/scheduler.ts';
import {driveIssue} from '../../main.ts';
import {laterTurn} from '../../window/__tests__/live.harness.ts';

spec('idle', () => {
  requirement('A run with no commit is not repeated', () => {
    scenario('A later turn with no commit stays idle', async () => {
      const {lines, runs} = await laterTurn();
      assert.equal(runs, 2);
      assert.equal(lines.filter(line => line.includes('restore-baseline')).length, 1);
      assert.equal(lines.at(-1), '');
    });
    scenario('The same decision stays idle', async () => {
      const root = mkdtempSync(path.join(tmpdir(), 'sdd-refused-'));
      const seen: string[] = [];
      const runtime: Runtime = {
        async run(skill) {
          seen.push(skill.action);
          return {commits: 0};
        },
        async ask() {
          return {text: ''};
        },
      };
      const box = implementing(root, runtime);
      const first = await driveIssue(box, '8');
      assert.equal(first.code, 0);
      const notes = await box.tracker.comments('8');
      const refusal = notes.find(note => note.body.includes('sdd:refused'));
      assert.ok(refusal);
      assert.ok((await box.tracker.labels('8')).includes('sdd:refused'));
      assert.equal(refusal.body.includes('\0'), false);
      assert.match(refusal.body, /implementing/);
      assert.match(refusal.body, /implement-next-task/);
      assert.match(refusal.body, /next open task/);
      await driveIssue(box, '8');
      assert.deepEqual(seen, ['implement-next-task']);
    });
    scenario('A person comment leaves the refusal', async () => {
      const root = mkdtempSync(path.join(tmpdir(), 'sdd-person-'));
      const seen: string[] = [];
      const runtime: Runtime = {
        async run(skill) {
          seen.push(skill.action);
          return {commits: 0};
        },
        async ask() {
          return {text: ''};
        },
      };
      const tasks = path.join('openspec', 'changes', 'issue-8', 'tasks.md');
      const {tracker, review, person} = memoryPorts({
        issues: [
          {
            key: '8',
            title: '#8: title',
            body: '',
            state: 'OPEN',
            labels: ['remote-solver', 'sdd:cycle', 'sdd:implementing'],
          },
        ],
        pulls: {8: [{id: '80', title: '#8: title', state: 'OPEN'}]},
      });
      const box = machine(root, {
        config: {
          queues: [{name: 'remote-solver'}],
          base: 'master',
          branchScope: 'sdd',
          ignoreComments: [],
        },
        tracker,
        review,
        vcs: {
          filesAt: () => ({
            exists: rel => rel === tasks,
            read: rel => (rel === tasks ? '- [ ] one\n' : ''),
            list: () => [],
          }),
          compare: async () => null,
          push: async () => {},
          head: async () => 'abc',
          published: async () => true,
          dirty: async () => [],
        },
        runtime,
      });
      const first = await driveIssue(box, '8');
      assert.equal(first.code, 0);
      person('8', 'please continue');
      await driveIssue(box, '8');
      assert.deepEqual(seen, ['implement-next-task']);
    });
    scenario('Removing the label starts the effect again', async () => {
      const root = mkdtempSync(path.join(tmpdir(), 'sdd-clear-'));
      const seen: string[] = [];
      const runtime: Runtime = {
        async run(skill) {
          seen.push(skill.action);
          return {commits: 0};
        },
        async ask() {
          return {text: ''};
        },
      };
      const tasks = path.join('openspec', 'changes', 'issue-8', 'tasks.md');
      const {tracker, review} = memoryPorts({
        issues: [
          {
            key: '8',
            title: '#8: title',
            body: '',
            state: 'OPEN',
            labels: ['remote-solver', 'sdd:cycle', 'sdd:implementing'],
          },
        ],
        pulls: {8: [{id: '80', title: '#8: title', state: 'OPEN'}]},
      });
      const box = machine(root, {
        config: {
          queues: [{name: 'remote-solver'}],
          base: 'master',
          branchScope: 'sdd',
          ignoreComments: [],
        },
        tracker,
        review,
        vcs: {
          filesAt: () => ({
            exists: rel => rel === tasks,
            read: rel => (rel === tasks ? '- [ ] one\n' : ''),
            list: () => [],
          }),
          compare: async () => null,
          push: async () => {},
          head: async () => 'abc',
          published: async () => true,
          dirty: async () => [],
        },
        runtime,
      });
      const first = await driveIssue(box, '8');
      assert.equal(first.code, 0);
      await tracker.editLabels('8', [], ['sdd:refused']);
      await driveIssue(box, '8');
      assert.deepEqual(seen, ['implement-next-task', 'implement-next-task']);
    });
    scenario('A different action starts', () => {
      const empty: State = {running: [], reported: {}};
      const first: Extract<Decision, {kind: 'agent'}> = {
        kind: 'agent',
        issue: '1',
        action: 'create-proposal',
        skill: 'plan',
        phase: 'proposing',
        pr: '',
        reason: 'write proposal.md',
      };
      const left = exited({...empty, running: ['1']}, '1');
      const next = tick(
        left,
        [{...first, action: 'create-initial-specs', reason: 'write the delta'}],
        1,
      );
      assert.equal(next.start[0]?.action, 'create-initial-specs');
    });
  });

  requirement('A running issue and the parallel cap are left alone', () => {
    scenario('A running issue is not moved', async () => {
      const {tracker, review, calls} = memoryPorts({
        issues: [
          {
            key: '7',
            title: '#7: title',
            body: '',
            state: 'OPEN',
            labels: ['Sandcastle', 'sdd:cycle', 'sdd:proposed'],
          },
        ],
      });
      const snapshot = await loadCycle(tracker, review, () => files, [{name: 'Sandcastle'}]);
      const decisions = await resolveCycle(
        snapshot,
        tracker,
        [{name: 'Sandcastle'}],
        new Set(['7']),
      );
      assert.deepEqual(decisions, []);
      assert.equal(calls.includes('editLabels'), false);
      assert.deepEqual(await tracker.labels('7'), ['Sandcastle', 'sdd:cycle', 'sdd:proposed']);
    });
    scenario('Parallel 1 starts one of two ready issues', () => {
      const empty: State = {running: [], reported: {}};
      const one: Extract<Decision, {kind: 'agent'}> = {
        kind: 'agent',
        issue: '1',
        action: 'create-proposal',
        skill: 'plan',
        phase: 'proposing',
        pr: '',
        reason: 'write proposal.md',
      };
      const turned = tick(empty, [one, {...one, issue: '2', reason: 'other'}], 1);
      assert.deepEqual(
        turned.start.map(item => item.issue),
        ['1'],
      );
    });
  });

  requirement('Another process does not start a held issue', () => {
    scenario('A held issue does not start an agent', async () => {
      const root = mkdtempSync(path.join(tmpdir(), 'sdd-hold-'));
      const held = tryHoldIssue(root, '7');
      assert.ok(held);
      let ran = false;
      const box = {
        root,
        runtime: {
          async run() {
            ran = true;
            return {commits: 0};
          },
        },
      } as Machine;
      const result = await driveIssue(box, '7');
      assert.equal(ran, false);
      assert.equal(result.busy, true);
      assert.equal(result.code, 0);
      assert.equal(result.idle, undefined);
      held.release();
    });
    scenario('A dead holder releases the issue', () => {
      const root = mkdtempSync(path.join(tmpdir(), 'sdd-hold-dead-'));
      const file = path.join(root, '.sandcastle', 'locks', '7');
      mkdirSync(path.dirname(file), {recursive: true});
      writeFileSync(file, '99999999\n');
      const held = tryHoldIssue(root, '7');
      assert.ok(held);
      assert.equal(readFileSync(file, 'utf8').trim(), String(process.pid));
      held.release();
      assert.equal(existsSync(file), false);
    });
  });

  requirement('A crashed run resumes its chat once', () => {
    scenario('A crash resumes the same chat', async () => {
      const {root, seen, crash} = crashedIssue();
      await assert.rejects(() => driveIssue(crash, '8'));
      assert.deepEqual(seen, [undefined]);
      await assert.rejects(() => driveIssue(crash, '8'));
      assert.deepEqual(seen, [undefined, 'chat-1']);
      assert.equal(readChat(root, '8')?.resumed, true);
    });
    scenario('A second crash stays idle', async () => {
      const {seen, crash} = crashedIssue();
      await assert.rejects(() => driveIssue(crash, '8'));
      await assert.rejects(() => driveIssue(crash, '8'));
      const third = await driveIssue(crash, '8');
      assert.equal(third.code, 0);
      assert.equal(seen.length, 2);
      const notes = await crash.tracker.comments('8');
      assert.ok(notes.some(note => note.body.includes('sdd:refused')));
    });
    scenario('A commit starts a new chat', async () => {
      const root = mkdtempSync(path.join(tmpdir(), 'sdd-chat-commit-'));
      const seen: Array<string | undefined> = [];
      const runtime: Runtime = {
        async run(skill) {
          seen.push(skill.resumeSession);
          if (seen.length === 1) {
            rememberChat(root, skill.key, {
              action: skill.action,
              signature: skill.signature ?? '',
              sessionId: 'chat-1',
            });
          }
          return {commits: seen.length === 1 ? 1 : 0};
        },
        async ask() {
          return {text: ''};
        },
      };
      const result = await driveIssue(implementing(root, runtime), '8');
      assert.equal(result.code, 0);
      assert.deepEqual(seen, [undefined, undefined]);
      assert.equal(readChat(root, '8'), undefined);
    });
    scenario('A run with no commit does not start again', async () => {
      const root = mkdtempSync(path.join(tmpdir(), 'sdd-chat-stop-'));
      const seen: Array<string | undefined> = [];
      const runtime: Runtime = {
        async run(skill) {
          seen.push(skill.resumeSession);
          rememberChat(root, skill.key, {
            action: skill.action,
            signature: skill.signature ?? '',
            sessionId: 'chat-1',
          });
          return {commits: 0};
        },
        async ask() {
          return {text: ''};
        },
      };
      const box = implementing(root, runtime);
      const first = await driveIssue(box, '8');
      assert.equal(first.code, 0);
      assert.equal(readChat(root, '8'), undefined);
      await driveIssue(box, '8');
      assert.deepEqual(seen, [undefined]);
    });
    scenario('A different decision starts a new chat', async () => {
      const root = mkdtempSync(path.join(tmpdir(), 'sdd-chat-other-'));
      rememberChat(root, '8', {
        action: 'implement-next-task',
        signature: 'implementing\0implement-next-task\0next open task',
        sessionId: 'old',
      });
      const seen: string[] = [];
      const runtime: Runtime = {
        async run(skill) {
          seen.push(`${skill.action} ${skill.resumeSession ?? '-'}`);
          return {commits: 0};
        },
        async ask() {
          return {text: ''};
        },
      };
      const {tracker, review} = memoryPorts({
        issues: [
          {
            key: '8',
            title: '#8: title',
            body: '',
            state: 'OPEN',
            labels: ['remote-solver', 'sdd:cycle', 'sdd:proposing'],
          },
        ],
      });
      const result = await driveIssue(
        machine(root, {
          config: {
            queues: [{name: 'remote-solver'}],
            base: 'master',
            branchScope: 'sdd',
            ignoreComments: [],
          },
          tracker,
          review,
          vcs: emptyVcs(),
          runtime,
        }),
        '8',
      );
      assert.equal(result.code, 0);
      assert.deepEqual(seen, ['create-proposal -']);
      assert.equal(readChat(root, '8'), undefined);
    });
  });
});

function emptyVcs(): Vcs {
  return {
    prepare: async () => '',
    tip: async () => 'abc',
    filesAt: () => ({exists: () => false, read: () => '', list: () => []}),
    compare: async () => null,
    push: async () => {},
    head: async () => 'abc',
    published: async () => true,
    dirty: async () => [],
  };
}

function implementing(root: string, runtime: Runtime): Machine {
  const tasks = path.join('openspec', 'changes', 'issue-8', 'tasks.md');
  const {tracker, review} = memoryPorts({
    issues: [
      {
        key: '8',
        title: '#8: title',
        body: '',
        state: 'OPEN',
        labels: ['remote-solver', 'sdd:cycle', 'sdd:implementing'],
      },
    ],
    pulls: {8: [{id: '80', title: '#8: title', state: 'OPEN'}]},
  });
  return machine(root, {
    config: {
      queues: [{name: 'remote-solver'}],
      base: 'master',
      branchScope: 'sdd',
      ignoreComments: [],
    },
    tracker,
    review,
    vcs: {
      ...emptyVcs(),
      filesAt: () => ({
        exists: rel => rel === tasks,
        read: rel => (rel === tasks ? '- [ ] one\n' : ''),
        list: () => [],
      }),
    },
    runtime,
  });
}

function crashedIssue(): {root: string; seen: Array<string | undefined>; crash: Machine} {
  const root = mkdtempSync(path.join(tmpdir(), 'sdd-chat-crash-'));
  const seen: Array<string | undefined> = [];
  const runtime: Runtime = {
    async run(skill) {
      seen.push(skill.resumeSession);
      rememberChat(root, skill.key, {
        action: skill.action,
        signature: skill.signature ?? '',
        sessionId: 'chat-1',
      });
      throw new Error('agent exited 1');
    },
    async ask() {
      return {text: ''};
    },
  };
  return {root, seen, crash: implementing(root, runtime)};
}
