import assert from 'node:assert/strict';
import {test} from 'vitest';

import {paintLine} from './paint.ts';

test('A covered line shows the node value', () => {
  assert.equal(paintLine('first', 'alpha', '- alpha'), 'alpha');
});
