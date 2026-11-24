import assert from 'node:assert/strict';
import {test} from 'vitest';

import {commandExit, familyNames, requestedFamily, requestedId} from './cases.ts';

test('a missing family names the families and is not a pass', () => {
  assert.equal(requestedFamily([]), undefined);
  assert.deepEqual(familyNames, ['review', 'fix', 'plan', 'design', 'tasks', 'pr-comments', 'repair-suite', 'chat']);
});

test('the family is the first bare argument', () => {
  assert.equal(requestedFamily(['--', 'review']), 'review');
  assert.equal(requestedFamily(['review']), 'review');
  assert.equal(
    requestedId(['review', 'unused-line-is-not-a-return']),
    'unused-line-is-not-a-return',
  );
  assert.equal(requestedId(['review']), undefined);
});

test('one failed case fails the command', () => {
  assert.equal(commandExit(['pass', 'fail']), 1);
});

test('an unreadable case is not a pass', () => {
  assert.equal(commandExit(['pass', 'inconclusive']), 2);
});

test('a clean batch passes', () => {
  assert.equal(commandExit(['pass', 'pass']), 0);
});
