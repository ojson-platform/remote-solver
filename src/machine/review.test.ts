import assert from 'node:assert/strict';
import {test} from 'vitest';

import {markRobot, reviewOf, spokeByRobot, threadsReport} from './review.ts';

test('threads report lists open threads with their handles and filters by marker', () => {
  const records = [
    {
      id: 'T1',
      comment: '11',
      path: 'openspec/changes/issue-1/proposal.md',
      line: 40,
      resolved: false,
      body: 'is this in scope?',
    },
    {
      id: 'T2',
      comment: '12',
      path: 'src/a.ts',
      line: 3,
      resolved: false,
      body: '🤖 sdd:layer=spec → specifying',
    },
    {
      id: 'T3',
      comment: '13',
      path: 'src/a.ts',
      line: null,
      resolved: false,
      body: '🤖 sdd:note baseline',
    },
    {
      id: 'T4',
      comment: '14',
      path: 'src/b.ts',
      line: 9,
      resolved: true,
      body: 'sdd:layer=code → implementing',
    },
  ];
  const comments = [
    {robot: false, body: 'please rebase'},
    {robot: true, body: '🤖 sdd:layer=code → implementing'},
  ];
  const all = threadsReport(records, comments);
  assert.deepEqual(
    all.threads.map(line => [line.thread, line.comment, line.marker]),
    [
      ['T1', '11', null],
      ['T2', '12', 'spec'],
      ['T3', '13', 'note'],
    ],
  );
  assert.equal(all.threads[0].file, 'openspec/changes/issue-1/proposal.md');
  assert.equal(all.threads[0].line, 40);
  assert.deepEqual(all.conversation, {last: comments[1], layer: 'code', unanswered: false});
  assert.deepEqual(
    threadsReport(records, comments, {layer: 'spec'}).threads.map(line => line.thread),
    ['T2'],
  );
  assert.deepEqual(
    threadsReport(records, comments, {unmarked: true}).threads.map(line => line.thread),
    ['T1'],
  );
  assert.deepEqual(threadsReport([], []).conversation, {last: null, layer: null, unanswered: false});
  assert.equal(threadsReport([], [{robot: false, body: 'please rebase'}]).conversation.unanswered, true);
});

test('a thread fixed but not yet resolved is done: not unanswered, not a layer, not unmarked', () => {
  const records = [
    {id: 'T1', comment: '11', path: 'src/a.ts', line: 3, resolved: false, body: '🤖 sdd:fixed abc123'},
  ];
  const review = reviewOf(records, []);
  assert.equal(review.unanswered, false);
  assert.equal(review.rollback, null);
  assert.deepEqual(review.layers, []);
  assert.equal(threadsReport(records, []).threads[0].marker, 'fixed');
  assert.deepEqual(threadsReport(records, [], {unmarked: true}).threads, []);
});

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
