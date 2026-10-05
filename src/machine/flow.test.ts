import assert from 'node:assert/strict';
import {test} from 'vitest';

import {readChange} from './change.ts';
import {performIssue, resolveCycle, resolveIssue} from './flow.ts';
import {markRobot} from './marker.ts';
import {queueOf} from './queues.ts';
import {loadCycle} from './snapshot.ts';
import {memoryPorts} from '../adapters/github.ts';
import type {FileSource} from './port.ts';

const files: FileSource = {
  exists: () => false,
  read: () => '',
  list: () => [],
};

test('resolveIssue loads the cycle once and flushes mechanical advances in one write', async () => {
  const {tracker, review, calls} = memoryPorts({
    issues: [
      {
        key: '424242',
        title: '#424242: title',
        body: '',
        state: 'OPEN',
        labels: ['Sandcastle', 'sdd:cycle', 'sdd:proposed'],
      },
    ],
  });
  const decision = await resolveIssue('424242', {
    tracker,
    review,
    files,
    queues: [{name: 'Sandcastle'}],
  });
  assert.equal(calls.filter(call => call === 'listOpen').length, 1);
  assert.equal(calls.filter(call => call === 'editLabels').length, 1);
  assert.equal(
    calls.some(call => call.startsWith('close:')),
    false,
  );
  assert.equal(decision.kind, 'agent');
  if (decision.kind === 'agent') {
    assert.equal(decision.action, 'create-proposal');
  }
  assert.deepEqual(await tracker.labels('424242'), ['Sandcastle', 'sdd:cycle', 'sdd:proposing']);
});

test('the machine opens the review gate with one ask and does not repeat it', async () => {
  const {tracker, review, calls} = memoryPorts({
    issues: [
      {
        key: '5',
        title: '#5: title',
        body: '',
        state: 'OPEN',
        labels: ['Sandcastle', 'sdd:cycle', 'sdd:proposing'],
      },
    ],
    pulls: {'5': [{id: '9', title: '#5: title', state: 'OPEN'}]},
  });
  const options = {
    tracker,
    review,
    files,
    queues: [{name: 'Sandcastle'}],
    change: {...readChange('5', files), proposal: true},
  };
  const opened = await resolveIssue('5', options);
  assert.equal(opened.kind, 'wait');
  assert.ok((await tracker.labels('5')).includes('sdd:wait-human'));
  const asks = () =>
    calls.filter(call => call.startsWith('body:') && call.includes('Review the proposal'));
  assert.equal(asks().length, 1);
  assert.match(
    asks()[0],
    /Review the proposal\. To accept it, replace the label `sdd:proposing` with `sdd:proposed` on this issue, or run `sdd accept 5`\./,
  );

  const held = await resolveIssue('5', options);
  assert.equal(held.kind, 'wait');
  if (held.kind === 'wait') {
    assert.deepEqual(held.gate, {artifact: 'proposal', from: 'proposing', to: 'proposed'});
  }
  assert.equal(asks().length, 1);
});

test('a person who moves the gate label on the issue gets a record, or the change goes back', async () => {
  const seed = (labels: string[]) =>
    memoryPorts({
      issues: [{key: '5', title: '#5: title', body: '', state: 'OPEN', labels}],
      pulls: {'5': [{id: '9', title: '#5: title', state: 'OPEN'}]},
    });
  const base = readChange('5', files);

  const accepted = seed([
    'Sandcastle',
    'sdd:cycle',
    'sdd:proposing',
    'sdd:proposed',
    'sdd:wait-human',
  ]);
  await resolveIssue('5', {
    ...accepted,
    files,
    queues: [{name: 'Sandcastle'}],
    change: {...base, proposal: true},
  });
  assert.ok((await accepted.tracker.labels('5')).includes('sdd:specifying'));
  assert.ok(!(await accepted.tracker.labels('5')).includes('sdd:wait-human'));
  assert.ok(accepted.calls.includes('body:' + markRobot('sdd:accept proposing → specifying')));

  const open = seed(['Sandcastle', 'sdd:cycle', 'sdd:proposed']);
  const options = {
    ...open,
    files,
    queues: [{name: 'Sandcastle'}],
    change: {...base, proposal: true, openQuestions: 1},
  };
  const held = await resolveIssue('5', options);
  assert.equal(held.kind, 'wait');
  assert.deepEqual(await open.tracker.labels('5'), ['Sandcastle', 'sdd:cycle', 'sdd:proposing']);
  const notes = () => open.calls.filter(call => call.startsWith('body:'));
  assert.equal(notes().length, 1);
  assert.match(notes()[0], /back to proposing/);
  assert.match(notes()[0], /## Open questions in openspec\/changes\/issue-5\/proposal\.md/);

  await resolveIssue('5', options);
  assert.equal(notes().length, 1);
  await resolveIssue('5', {...options, change: {...base, proposal: true}});
  assert.equal(notes().length, 2);
  assert.match(notes()[1], /Review the proposal/);
});

test('resolveCycle leaves an issue a worker already runs', async () => {
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
  const decisions = await resolveCycle(snapshot, tracker, [{name: 'Sandcastle'}], new Set(['7']));
  assert.deepEqual(decisions, []);
  assert.equal(calls.filter(call => call === 'editLabels').length, 0);
  assert.deepEqual(await tracker.labels('7'), ['Sandcastle', 'sdd:cycle', 'sdd:proposed']);
});

test('resolveIssue closes an accepted issue once the pull request is merged', async () => {
  const open = memoryPorts({
    issues: [
      {
        key: '424242',
        title: '#424242: title',
        body: '',
        state: 'OPEN',
        labels: ['Sandcastle', 'sdd:cycle', 'sdd:accepted'],
      },
    ],
    pulls: {'424242': [{id: '9', title: '#424242: title', state: 'OPEN'}]},
  });
  const waiting = await resolveIssue('424242', {
    tracker: open.tracker,
    review: open.review,
    files,
    queues: [{name: 'Sandcastle'}],
  });
  assert.equal(waiting.kind, 'wait');
  assert.equal(
    open.calls.some(call => call.startsWith('close:')),
    false,
  );
  assert.equal((await open.tracker.issue('424242')).state, 'OPEN');

  const green = memoryPorts({
    issues: [
      {
        key: '424242',
        title: '#424242: title',
        body: '',
        state: 'OPEN',
        labels: ['Sandcastle', 'sdd:cycle', 'sdd:accepted'],
      },
    ],
    pulls: {'424242': [{id: '9', title: '#424242: title', state: 'OPEN'}]},
    checks: {'9': {checks: 'green'}},
  });
  const held = await resolveIssue('424242', {
    tracker: green.tracker,
    review: green.review,
    files,
    queues: [{name: 'Sandcastle'}],
  });
  assert.deepEqual(held, {kind: 'wait', issue: '424242', reason: 'wait for merge of PR #9'});
  assert.equal(
    green.calls.some(call => call.startsWith('close:')),
    false,
  );

  const merged = memoryPorts({
    issues: [
      {
        key: '424242',
        title: '#424242: title',
        body: '',
        state: 'OPEN',
        labels: ['Sandcastle', 'sdd:cycle', 'sdd:accepted'],
      },
    ],
    pulls: {'424242': [{id: '9', title: '#424242: title', state: 'MERGED'}]},
  });
  const decision = await resolveIssue('424242', {
    tracker: merged.tracker,
    review: merged.review,
    files,
    queues: [{name: 'Sandcastle'}],
  });
  assert.equal(decision.kind, 'done');
  assert.equal(merged.calls.filter(call => call.startsWith('close:')).length, 1);
});

test('performIssue merges a green archived pull request and settles the close', async () => {
  const {tracker, review, calls} = memoryPorts({
    issues: [
      {
        key: '3',
        title: '#3: title',
        body: '',
        state: 'OPEN',
        labels: ['Sandcastle', 'sdd:cycle', 'sdd:accepting', 'sdd:auto-merge'],
      },
    ],
    pulls: {'3': [{id: '9', title: '#3: title', state: 'OPEN'}]},
    checks: {'9': {checks: 'green'}},
  });
  const archived: FileSource = {
    exists: rel => rel === 'openspec/changes/archive/issue-3',
    read: () => '',
    list: () => [],
  };
  const decision = await performIssue('3', {
    tracker,
    review,
    files: archived,
    queues: [{name: 'Sandcastle'}],
  });
  assert.equal(decision.kind, 'done');
  if (decision.kind === 'done') {
    assert.equal(decision.reason, 'pull request merged');
  }
  assert.equal(calls.filter(call => call === 'merge:9').length, 1);
  assert.ok((await tracker.labels('3')).includes('sdd:accepted'));
  assert.equal((await tracker.issue('3')).state, 'CLOSED');
});

test('a cycle includes every configured queue and the earlier name wins', async () => {
  const queues = [{name: 'FIRST'}, {name: 'SECOND'}];
  const {tracker, review} = memoryPorts({
    issues: [
      {
        key: '1',
        title: '#1: title',
        body: '',
        state: 'OPEN',
        labels: ['FIRST', 'sdd:cycle', 'sdd:proposed'],
      },
      {
        key: '2',
        title: '#2: title',
        body: '',
        state: 'OPEN',
        labels: ['SECOND', 'sdd:cycle', 'sdd:proposed'],
      },
      {
        key: '3',
        title: '#3: title',
        body: '',
        state: 'OPEN',
        labels: ['SECOND', 'FIRST', 'sdd:cycle', 'sdd:proposed'],
      },
    ],
  });
  const snapshot = await loadCycle(tracker, review, () => files, queues);
  assert.deepEqual(
    snapshot.cycles.map(issue => issue.key),
    ['1', '2', '3'],
  );
  assert.equal(snapshot.cycles.filter(issue => issue.key === '3').length, 1);
  assert.equal(queueOf(['SECOND', 'FIRST', 'sdd:cycle', 'sdd:proposed'], queues)?.name, 'FIRST');
});
