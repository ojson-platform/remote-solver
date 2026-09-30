import assert from 'node:assert/strict';
import {test} from 'vitest';

import {phaseOf} from './phase.ts';

test('a gate label wins over the phase it closes', () => {
  assert.equal(phaseOf(['sdd:proposing', 'sdd:proposed']), 'proposed');
  assert.equal(phaseOf(['sdd:specifying', 'sdd:specified']), 'specified');
  assert.equal(phaseOf(['sdd:designing', 'sdd:designed']), 'designed');
  assert.equal(phaseOf(['sdd:accepting', 'sdd:accepted']), 'accepted');
});

test('otherwise the earliest phase label wins', () => {
  assert.equal(phaseOf(['sdd:proposing', 'sdd:specified']), 'proposing');
  assert.equal(phaseOf(['sdd:specifying', 'sdd:tasking']), 'specifying');
  assert.equal(phaseOf(['sdd:tasking']), 'tasking');
  assert.equal(phaseOf(['sdd:cycle']), null);
});
