import assert from 'node:assert/strict';
import {test} from 'vitest';

import {handoffAnchorRefusal} from './sdd.ts';

test('a 422 on thread open names the line and stops the step', () => {
  const error = Object.assign(new Error('gh exited 1'), {
    stderr: 'gh: Validation Failed (HTTP 422)\n',
  });
  assert.equal(
    handoffAnchorRefusal(error, 'src/window/board-command.test.ts', 552),
    'the line is not on the pushed head: src/window/board-command.test.ts:552. The step stops.',
  );
});

test('another openThread failure keeps its own message', () => {
  assert.equal(handoffAnchorRefusal(new Error('line is missing'), 'src/a.ts', 1), undefined);
});
