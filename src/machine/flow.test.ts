import assert from 'node:assert/strict';
import {test} from 'node:test';

import {resolveCycle, resolveIssue} from './flow.ts';
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
  assert.equal(calls.some(call => call.startsWith('close:')), false);
  assert.equal(decision.kind, 'agent');
  if (decision.kind === 'agent') {
    assert.equal(decision.action, 'create-proposal');
  }
  assert.deepEqual(tracker.labels('424242'), ['Sandcastle', 'sdd:cycle', 'sdd:proposing']);
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
  assert.equal(open.calls.some(call => call.startsWith('close:')), false);
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
  assert.equal(green.calls.some(call => call.startsWith('close:')), false);

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
