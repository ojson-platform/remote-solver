import assert from 'node:assert/strict';
import {test} from 'node:test';

import {reviewOf} from './review.ts';

test('a note is skipped, an unlabeled thread is unanswered, and the earliest marker wins', () => {
  const review = reviewOf(
    [
      {resolved: true, body: 'sdd:layer=proposal'},
      {resolved: false, body: 'sdd:note leave this'},
      {resolved: false, body: 'please fix the name'},
      {resolved: false, body: 'sdd:layer=code → implementing'},
      {resolved: false, body: 'sdd:layer=spec → specifying'},
      {resolved: false, body: 'sdd:layer=out — #4'},
    ],
    [],
  );
  assert.equal(review.unanswered, true);
  assert.equal(review.rollback, 'specifying');
  assert.deepEqual(review.layers, ['code', 'spec', 'out']);
});

test('a conversation from someone else is unanswered, and the machine login is not', () => {
  const other = reviewOf([], [{robot: false, body: 'what about cache?'}]);
  assert.equal(other.unanswered, true);
  const mine = reviewOf(
    [],
    [
      {robot: false, body: 'what about cache?'},
      {robot: true, body: 'done'},
    ],
  );
  assert.equal(mine.unanswered, false);
  const noted = reviewOf([], [{robot: false, body: 'sdd:note fyi'}]);
  assert.equal(noted.unanswered, false);
});
