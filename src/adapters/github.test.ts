import assert from 'node:assert/strict';
import {test} from 'node:test';

import {classifyChecks, linkedTitle, linksFrom, memoryPorts, type CheckRollup} from './github.ts';
import {setPhase} from '../machine/labels.ts';
import {loadCycle} from '../machine/snapshot.ts';
import type {FileSource} from '../machine/port.ts';

function rollup(over: Partial<CheckRollup> = {}): CheckRollup {
  return {state: 'OPEN', statusCheckRollup: [], ...over};
}

const files: FileSource = {exists: () => false, read: () => '', list: () => []};

test('a merged pull request is green', () => {
  assert.equal(classifyChecks(rollup({state: 'MERGED'})), 'green');
});

test('a named check is red, pending, or missing on its own', () => {
  const view = rollup({
    statusCheckRollup: [
      {name: 'units', conclusion: 'SUCCESS', status: 'COMPLETED'},
      {name: 'cursor-review', status: 'IN_PROGRESS'},
    ],
  });
  assert.equal(classifyChecks(view), 'pending');
  assert.equal(classifyChecks(view, 'cursor-review'), 'pending');
  assert.equal(classifyChecks(rollup({statusCheckRollup: [{name: 'units', conclusion: 'FAILURE'}]}), 'units'), 'red');
  assert.equal(classifyChecks(view, 'missing'), 'none');
});

test('a completed rollup with no pending check is green', () => {
  assert.equal(
    classifyChecks(rollup({statusCheckRollup: [{name: 'units', conclusion: 'SUCCESS', status: 'COMPLETED'}]})),
    'green',
  );
});

test('parent and depends are read from the issue body', () => {
  assert.deepEqual(linksFrom('Parent: #LAVKA-1\nDepends: #LAVKA-2\nDepends: #9\n'), {
    parent: 'LAVKA-1',
    dependsOn: ['LAVKA-2', '9'],
  });
});

test('a pull title links to an issue only with the key prefix', () => {
  assert.equal(linkedTitle('7', '#7: change'), true);
  assert.equal(linkedTitle('7', '#7 leftover'), true);
  assert.equal(linkedTitle('7', 'unrelated'), false);
  assert.equal(linkedTitle('7', '#70: other'), false);
});

test('loadCycle keeps marker grammar above the port', () => {
  const {tracker, review, calls} = memoryPorts({
    user: 'robot',
    issues: [
      {
        key: '7',
        title: '#7: title',
        body: 'Parent: #1\n',
        state: 'OPEN',
        labels: ['Sandcastle', 'sdd:cycle', 'sdd:implementing'],
      },
    ],
    pulls: {
      7: [{id: '71', title: '#7: change', state: 'OPEN'}],
    },
    threads: {
      71: [{resolved: false, body: 'sdd:layer=spec → specifying'}],
    },
    comments: {
      71: [{robot: false, body: 'hello'}],
    },
  });
  const snapshot = loadCycle(tracker, review, () => files, 'Sandcastle');
  const pulls = snapshot.pulls.get('7') ?? [];
  assert.deepEqual(
    pulls.map(pr => pr.id),
    ['71'],
  );
  assert.equal(pulls[0].review.rollback, 'specifying');
  assert.equal(pulls[0].review.unanswered, true);
  assert.equal(snapshot.cycles[0].parent, '1');
  assert.equal(calls.filter(call => call === 'listOpen').length, 1);
});

test('setPhase keeps a single phase label and refuses a gate label', () => {
  const {tracker} = memoryPorts({
    issues: [
      {
        key: '7',
        title: '#7: title',
        body: '',
        state: 'OPEN',
        labels: ['Sandcastle', 'sdd:proposing', 'sdd:designing'],
      },
    ],
  });
  setPhase('7', 'specifying', tracker);
  assert.deepEqual(tracker.labels('7'), ['Sandcastle', 'sdd:specifying']);
  assert.throws(() => setPhase('7', 'proposed', tracker), /gate label sdd:proposed/);
});

test('posted bodies carry the spy mark, and the shared login is not the robot', () => {
  const {tracker, review, calls} = memoryPorts({
    user: '3y3',
    issues: [{key: '7', title: '#7: title', body: '', state: 'OPEN', labels: []}],
  });
  tracker.comment('7', 'sdd:accept proposal accepted by @3y3');
  review.openThread('15', {commit: 'abc', path: 'src/a.ts', line: 1, body: 'sdd:note baseline'});
  review.reply('15', '9', 'sdd:fixed abc');
  review.say('15', 'sdd:layer=code → implementing');
  tracker.close('7', 'SDLC accepted');
  assert.deepEqual(
    calls.filter(call => call.startsWith('body:')),
    [
      'body:🤖 sdd:accept proposal accepted by @3y3',
      'body:🤖 sdd:note baseline',
      'body:🤖 sdd:fixed abc',
      'body:🤖 sdd:layer=code → implementing',
      'body:🤖 SDLC accepted',
    ],
  );
});
