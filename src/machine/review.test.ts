import assert from 'node:assert/strict';
import {test} from 'node:test';

import {markRobot, reviewOf, spokeByRobot} from './review.ts';

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

test('the spy mark and an ignored commenter are the robot, a bot login is not', () => {
  const sonar = [/sonarqubecloud/i];
  assert.equal(spokeByRobot('Нужно поребейзить ПР', '3y3', sonar), false);
  assert.equal(spokeByRobot('🤖 sdd:layer=code → implementing', '3y3', sonar), true);
  assert.equal(spokeByRobot('Quality Gate passed', 'sonarqubecloud[bot]', sonar), true);
  assert.equal(spokeByRobot('please rename the cache', 'reviewer[bot]', sonar), false);
  assert.equal(markRobot('sdd:layer=code → implementing'), '🤖 sdd:layer=code → implementing');
  assert.equal(markRobot('🤖 sdd:note fyi'), '🤖 sdd:note fyi');
});

test('a conversation layer stays open until a later sdd:fixed', () => {
  const open = reviewOf(
    [],
    [
      {robot: false, body: 'Нужно поребейзить ПР'},
      {robot: true, body: '🤖 sdd:layer=code → implementing'},
    ],
  );
  assert.equal(open.unanswered, false);
  assert.equal(open.rollback, 'implementing');
  assert.deepEqual(open.layers, ['code']);

  const closed = reviewOf(
    [],
    [
      {robot: false, body: 'Нужно поребейзить ПР'},
      {robot: true, body: '🤖 sdd:layer=code → implementing'},
      {robot: true, body: '🤖 sdd:fixed abc'},
    ],
  );
  assert.equal(closed.unanswered, false);
  assert.equal(closed.rollback, null);
  assert.deepEqual(closed.layers, []);
});
