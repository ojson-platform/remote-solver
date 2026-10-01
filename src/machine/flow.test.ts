import assert from 'node:assert/strict';
import {test} from 'vitest';

import {readChange} from './change.ts';
import {performIssue, resolveCycle, resolveIssue} from './flow.ts';
import {markRobot} from './marker.ts';
import {loadCycle} from './snapshot.ts';
import {memoryPorts} from '../adapters/github.ts';
import type {FileSource} from './port.ts';

const files: FileSource = {
  exists: () => false,
  read: () => '',
  list: () => [],
};

test('resolveIssue loads the cycle once and flushes mechanical advances in one write', () => {
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
  const decision = resolveIssue('424242', {tracker, review, files, queueLabel: 'Sandcastle'});
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
  assert.deepEqual(tracker.labels('424242'), ['Sandcastle', 'sdd:cycle', 'sdd:proposing']);
});

test('the machine opens the review gate with one ask and does not repeat it', () => {
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
    queueLabel: 'Sandcastle',
    change: {...readChange('5', files), proposal: true},
  };
  const opened = resolveIssue('5', options);
  assert.equal(opened.kind, 'wait');
  assert.ok(tracker.labels('5').includes('sdd:wait-human'));
  const asks = () =>
    calls.filter(call => call.startsWith('body:') && call.includes('Review the proposal'));
  assert.equal(asks().length, 1);
  assert.match(
    asks()[0],
    /Review the proposal\. To accept it, replace the label `sdd:proposing` with `sdd:proposed` on this issue, or run `sdd accept 5`\./,
  );

  const held = resolveIssue('5', options);
  assert.equal(held.kind, 'wait');
  if (held.kind === 'wait') {
    assert.deepEqual(held.gate, {artifact: 'proposal', from: 'proposing', to: 'proposed'});
  }
  assert.equal(asks().length, 1);
});

test('a person who moves the gate label on the issue gets a record, or the change goes back', () => {
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
  resolveIssue('5', {
    ...accepted,
    files,
    queueLabel: 'Sandcastle',
    change: {...base, proposal: true},
  });
  assert.ok(accepted.tracker.labels('5').includes('sdd:specifying'));
  assert.ok(!accepted.tracker.labels('5').includes('sdd:wait-human'));
  assert.ok(accepted.calls.includes('body:' + markRobot('sdd:accept proposing → specifying')));

  const open = seed(['Sandcastle', 'sdd:cycle', 'sdd:proposed']);
  const options = {
    ...open,
    files,
    queueLabel: 'Sandcastle',
    change: {...base, proposal: true, openQuestions: 1},
  };
  const held = resolveIssue('5', options);
  assert.equal(held.kind, 'wait');
  assert.deepEqual(open.tracker.labels('5'), ['Sandcastle', 'sdd:cycle', 'sdd:proposing']);
  const notes = () => open.calls.filter(call => call.startsWith('body:'));
  assert.equal(notes().length, 1);
  assert.match(notes()[0], /back to proposing/);
  assert.match(notes()[0], /## Open questions in openspec\/changes\/issue-5\/proposal\.md/);

  resolveIssue('5', options);
  assert.equal(notes().length, 1);
  resolveIssue('5', {...options, change: {...base, proposal: true}});
  assert.equal(notes().length, 2);
  assert.match(notes()[1], /Review the proposal/);
});

test('resolveCycle leaves an issue a worker already runs', () => {
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
  const snapshot = loadCycle(tracker, review, () => files, 'Sandcastle');
  const decisions = resolveCycle(snapshot, tracker, 'Sandcastle', new Set(['7']));
  assert.deepEqual(decisions, []);
  assert.equal(calls.filter(call => call === 'editLabels').length, 0);
  assert.deepEqual(tracker.labels('7'), ['Sandcastle', 'sdd:cycle', 'sdd:proposed']);
});

test('resolveIssue closes an accepted issue once the pull request is merged', () => {
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
  const waiting = resolveIssue('424242', {
    tracker: open.tracker,
    review: open.review,
    files,
    queueLabel: 'Sandcastle',
  });
  assert.equal(waiting.kind, 'wait');
  assert.equal(
    open.calls.some(call => call.startsWith('close:')),
    false,
  );
  assert.equal(open.tracker.issue('424242').state, 'OPEN');

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
  const held = resolveIssue('424242', {
    tracker: green.tracker,
    review: green.review,
    files,
    queueLabel: 'Sandcastle',
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
  const decision = resolveIssue('424242', {
    tracker: merged.tracker,
    review: merged.review,
    files,
    queueLabel: 'Sandcastle',
  });
  assert.equal(decision.kind, 'done');
  assert.equal(merged.calls.filter(call => call.startsWith('close:')).length, 1);
});

test('performIssue merges a green archived pull request and settles the close', () => {
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
  const decision = performIssue('3', {
    tracker,
    review,
    files: archived,
    queueLabel: 'Sandcastle',
  });
  assert.equal(decision.kind, 'done');
  if (decision.kind === 'done') {
    assert.equal(decision.reason, 'pull request merged');
  }
  assert.equal(calls.filter(call => call === 'merge:9').length, 1);
  assert.ok(tracker.labels('3').includes('sdd:accepted'));
  assert.equal(tracker.issue('3').state, 'CLOSED');
});
