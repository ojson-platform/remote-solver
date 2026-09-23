import assert from 'node:assert/strict';
import {test} from 'node:test';

import {describe, describeQueue, reviewQueue} from './plan.ts';

const accepting = ['sdd:cycle', 'sdd:accepting', 'sdd:auto-review'];

test('auto-merge stands the reviewer down, and a ready issue names its one open pull', () => {
  const items = reviewQueue(
    [
      {key: '11', labels: [...accepting, 'sdd:auto-merge']},
      {key: '12', labels: accepting},
      {key: '13', labels: ['sdd:cycle', 'sdd:implementing', 'sdd:auto-review']},
      {key: '14', labels: ['sdd:cycle', 'sdd:accepting']},
    ],
    key => (key === '12' ? [{id: '15', state: 'OPEN'}] : []),
  );
  assert.deepEqual(items, [
    {kind: 'skip', issue: '11', reason: 'sdd:auto-merge merges without this review'},
    {kind: 'ready', issue: '12', pull: '15'},
    {kind: 'skip', issue: '13', reason: 'sdd:auto-review waits for accepting'},
  ]);
  assert.deepEqual(describeQueue(items), [
    '#11 skip: sdd:auto-merge merges without this review',
    '#12 review pull 15',
    '#13 skip: sdd:auto-review waits for accepting',
  ]);
  assert.equal(describe(items[1], {action: 'clean'}), '#12 clean');
  assert.equal(
    describe(items[1], {action: 'unjudged', reason: 'empty answer'}),
    '#12 unjudged: empty answer',
  );
  assert.equal(
    describe(items[1], {action: 'wait', reason: 'checks are pending'}),
    '#12 wait: checks are pending',
  );
});

test('several open pull requests wait, and an empty queue says so', () => {
  const waiting = reviewQueue([{key: '11', labels: accepting}], () => [
    {id: '3', state: 'OPEN'},
    {id: '4', state: 'OPEN'},
  ]);
  assert.equal(waiting[0].kind, 'wait');
  assert.deepEqual(describeQueue([]), ['no sdd:auto-review issues']);
});
