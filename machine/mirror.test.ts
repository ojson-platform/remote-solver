import assert from 'node:assert/strict';
import {test} from 'node:test';

import {updateMirror} from './mirror.ts';

test('a missing block is appended and the author text stays', () => {
  const next = updateMirror('Please look at cache.\n', 'Plan', 'one line');
  assert.match(next, /^Please look at cache\.\n\n<!-- sdd:begin -->\nPlan: one line\n<!-- sdd:end -->\n$/);
});

test('an existing layer line is replaced and the others stay', () => {
  const body = ['intro', '', '<!-- sdd:begin -->', 'Plan: old', 'Specify: kept', '<!-- sdd:end -->', ''].join('\n');
  const next = updateMirror(body, 'Plan', 'new');
  assert.match(next, /Plan: new/);
  assert.match(next, /Specify: kept/);
  assert.match(next, /^intro/);
});
