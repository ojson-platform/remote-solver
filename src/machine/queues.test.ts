import assert from 'node:assert/strict';
import {test} from 'vitest';

import {queueOf} from './queues.ts';

const queues = [{name: 'FIRST', description: 'default child'}, {name: 'SECOND'}];

test('the earlier configured queue wins', () => {
  assert.equal(queueOf(['sdd:cycle', 'SECOND', 'FIRST'], queues)?.name, 'FIRST');
  assert.equal(queueOf(['sdd:cycle'], queues), undefined);
});
