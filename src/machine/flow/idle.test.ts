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
import {change, files} from '../__tests__/harness.ts';
import {emptyReview} from '../mark/review.ts';
import type {Runtime, Vcs} from '../port.ts';
import type {Decision} from '../decide/policy.ts';
import {loadCycle, type CycleSnapshot} from '../spy/snapshot.ts';
import {exited, tick, type State} from '../spy/scheduler.ts';
import {driveIssue} from '../../main.ts';
import {runSdd} from '../../sdd.ts';
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
      assert.match(refusal.body, /A comment on this issue runs this step again/);
      await driveIssue(box, '8');
      assert.deepEqual(seen, ['implement-next-task']);
    });
    scenario('A person comment starts the effect', async () => {
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
      assert.deepEqual(seen, ['implement-next-task', 'implement-next-task']);
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

  requirement('A changed run is not idle', () => {
    scenario('A dirty worktree does not refuse the open task', async () => {
      const root = mkdtempSync(path.join(tmpdir(), 'sdd-dirty-'));
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
      box.vcs.issueDirty = async () => ['src/a.ts'];
      const first = await driveIssue(box, '8');
      assert.equal(first.code, 0);
      const notes = await box.tracker.comments('8');
      assert.equal(
        notes.some(note => note.body.includes('sdd:refused')),
        false,
      );
      assert.equal((await box.tracker.labels('8')).includes('sdd:refused'), false);
      await driveIssue(box, '8');
      assert.deepEqual(seen, ['implement-next-task', 'implement-next-task']);
    });
    scenario('A layer marker does not refuse the run', async () => {
      const root = mkdtempSync(path.join(tmpdir(), 'sdd-marker-'));
      const seen: string[] = [];
      const threads: {resolved: boolean; body: string}[] = [];
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
        threads: {80: threads},
      });
      const runtime: Runtime = {
        async run(skill) {
          seen.push(skill.action);
          threads.push({resolved: false, body: 'sdd:layer=spec'});
          return {commits: 0};
        },
        async ask() {
          return {text: ''};
        },
      };
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
          ...emptyVcs(),
          filesAt: () => ({
            exists: rel => rel === tasks,
            read: rel => (rel === tasks ? '- [ ] one\n' : ''),
            list: () => [],
          }),
        },
        runtime,
      });
      const first = await driveIssue(box, '8');
      assert.equal(first.code, 0);
      assert.deepEqual(seen, ['implement-next-task']);
      const notes = await tracker.comments('8');
      assert.equal(
        notes.some(note => note.body.includes('sdd:refused')),
        false,
      );
      assert.equal((await tracker.labels('8')).includes('sdd:refused'), false);
      assert.equal((await tracker.labels('8')).includes('sdd:specifying'), true);
    });
    scenario('A cached thread list does not hide a new layer marker', async () => {
      const root = mkdtempSync(path.join(tmpdir(), 'sdd-cached-marker-'));
      const threads: {resolved: boolean; body: string}[] = [];
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
        threads: {80: threads},
      });
      const listed = review.threadList.bind(review);
      let cache: Awaited<ReturnType<typeof listed>> | undefined;
      review.threadList = async (pull, read) => {
        if (cache === undefined || read?.fresh) {
          cache = await listed(pull);
        }
        return cache;
      };
      const runtime: Runtime = {
        async run() {
          threads.push({resolved: false, body: 'sdd:layer=spec'});
          return {commits: 0};
        },
        async ask() {
          return {text: ''};
        },
      };
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
          ...emptyVcs(),
          filesAt: () => ({
            exists: rel => rel === tasks,
            read: rel => (rel === tasks ? '- [ ] one\n' : ''),
            list: () => [],
          }),
        },
        runtime,
      });
      const first = await driveIssue(box, '8');
      assert.equal(first.code, 0);
      const notes = await tracker.comments('8');
      assert.equal(
        notes.some(note => note.body.includes('sdd:refused')),
        false,
      );
      assert.equal((await tracker.labels('8')).includes('sdd:refused'), false);
    });
    scenario('The refusal names the open task', async () => {
      const root = mkdtempSync(path.join(tmpdir(), 'sdd-task-name-'));
      const runtime: Runtime = {
        async run() {
          return {commits: 0};
        },
        async ask() {
          return {text: ''};
        },
      };
      const box = implementing(root, runtime);
      await driveIssue(box, '8');
      const notes = await box.tracker.comments('8');
      const refusal = notes.find(note => note.body.includes('sdd:refused'));
      assert.ok(refusal);
      assert.match(refusal.body, /next open task one/);
    });
  });

  requirement('An unmarked thread is not an empty run', () => {
    scenario('A new unmarked thread does not refuse the run', async () => {
      const root = mkdtempSync(path.join(tmpdir(), 'sdd-unmarked-'));
      const seen: string[] = [];
      const threads: {resolved: boolean; body: string}[] = [];
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
        threads: {80: threads},
      });
      const runtime: Runtime = {
        async run(skill) {
          seen.push(skill.action);
          if (skill.action === 'implement-next-task') {
            threads.push({resolved: false, body: 'the fence is still the marker'});
          }
          if (skill.action === 'classify-comments' && threads[0]) {
            threads[0].body = 'sdd:layer=spec → specifying\nthe fence is still the marker';
          }
          return {commits: 0};
        },
        async ask() {
          return {text: ''};
        },
      };
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
          ...emptyVcs(),
          filesAt: () => ({
            exists: rel => rel === tasks,
            read: rel => (rel === tasks ? '- [ ] one\n' : ''),
            list: () => [],
          }),
        },
        runtime,
      });
      const first = await driveIssue(box, '8');
      assert.equal(first.code, 0);
      assert.deepEqual(seen, ['implement-next-task', 'classify-comments']);
      const notes = await tracker.comments('8');
      assert.equal(
        notes.some(note => note.body.includes('sdd:refused')),
        false,
      );
      assert.equal((await tracker.labels('8')).includes('sdd:refused'), false);
      assert.equal((await tracker.labels('8')).includes('sdd:specifying'), true);
    });
    scenario('A conversation layer marker does not refuse the run', async () => {
      const root = mkdtempSync(path.join(tmpdir(), 'sdd-spoken-'));
      const seen: string[] = [];
      const comments: {body: string}[] = [];
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
        comments: {80: comments},
      });
      const runtime: Runtime = {
        async run(skill) {
          seen.push(skill.action);
          comments.push({body: 'sdd:layer=code → implementing'});
          return {commits: 0};
        },
        async ask() {
          return {text: ''};
        },
      };
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
          ...emptyVcs(),
          filesAt: () => ({
            exists: rel => rel === tasks,
            read: rel => (rel === tasks ? '- [ ] one\n' : ''),
            list: () => [],
          }),
        },
        runtime,
      });
      const first = await driveIssue(box, '8');
      assert.equal(first.code, 0);
      const notes = await tracker.comments('8');
      assert.equal(
        notes.some(note => note.body.includes('sdd:refused')),
        false,
      );
      await driveIssue(box, '8');
      assert.deepEqual(seen, ['implement-next-task', 'implement-next-task']);
    });
  });

  requirement('A closed thread releases the refusal', () => {
    scenario('A closed code thread releases the refusal', async () => {
      const row = {
        key: '8',
        title: '#8: title',
        body: '',
        state: 'OPEN',
        labels: ['Sandcastle', 'sdd:cycle', 'sdd:implementing', 'sdd:refused'],
        assignee: 'me',
      };
      const {tracker} = memoryPorts({issues: [row], user: 'me'});
      await tracker.comment(
        '8',
        'sdd:refused\nimplementing\nfix-implementation\nthreads on code',
      );
      const snapshot: CycleSnapshot = {
        issues: [row],
        cycles: [row],
        pulls: new Map([
          [
            '8',
            [
              {
                id: '9',
                title: '#8: title',
                state: 'OPEN',
                checks: 'green',
                review: emptyReview,
              },
            ],
          ],
        ]),
        changes: new Map([['8', change({proposal: true, delta: true, design: true, tasks: true})]]),
        facts: new Map(),
        texts: new Map(),
      };
      const decisions = await resolveCycle(
        snapshot,
        tracker,
        [{name: 'Sandcastle'}],
        new Set(),
        () => files,
      );
      assert.equal((await tracker.labels('8')).includes('sdd:refused'), false);
      assert.equal(
        decisions.some(item => item.kind === 'wait' && item.reason.includes('threads on code')),
        false,
      );
      assert.ok((await tracker.comments('8')).some(note => note.body.includes('threads on code')));
    });
  });

  requirement('A clean suite run moves the phase', () => {
    scenario('A clean suite run moves to verifying', async () => {
      const root = mkdtempSync(path.join(tmpdir(), 'sdd-suite-'));
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
          ...emptyVcs(),
          filesAt: () => ({
            exists: rel => rel === tasks,
            read: rel => (rel === tasks ? '- [x] one\n' : ''),
            list: () => [],
          }),
        },
        runtime,
      });
      const result = await driveIssue(box, '8');
      assert.equal(result.code, 0);
      const labels = await tracker.labels('8');
      assert.ok(labels.includes('sdd:verifying'));
      assert.equal(labels.includes('sdd:refused'), false);
      assert.deepEqual(seen, ['repair-suite']);
    });
    scenario('A publish with no repair commit moves to verifying', async () => {
      const root = mkdtempSync(path.join(tmpdir(), 'sdd-suite-publish-'));
      const box = doneSuite(root);
      await runSdd(['publish', '8', '#8: title'], box);
      const labels = await box.tracker.labels('8');
      assert.ok(labels.includes('sdd:verifying'));
      assert.equal(labels.includes('sdd:implementing'), false);
    });
    scenario('A publish after a repair commit stays implementing', async () => {
      const root = mkdtempSync(path.join(tmpdir(), 'sdd-suite-commit-'));
      const box = doneSuite(root);
      await runSdd(['commit', '8', '#8: mock the route'], box);
      await runSdd(['publish', '8', '#8: title'], box);
      const stayed = await box.tracker.labels('8');
      assert.ok(stayed.includes('sdd:implementing'));
      assert.equal(stayed.includes('sdd:verifying'), false);
      await runSdd(['publish', '8', '#8: title'], box);
      const moved = await box.tracker.labels('8');
      assert.ok(moved.includes('sdd:verifying'));
      assert.equal(moved.includes('sdd:implementing'), false);
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

function doneSuite(root: string): Machine {
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
        read: rel => (rel === tasks ? '- [x] one\n' : ''),
        list: () => [],
      }),
      commit: async () => undefined,
    },
  });
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
