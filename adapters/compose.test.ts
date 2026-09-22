import assert from 'node:assert/strict';
import {test} from 'node:test';

import {machine} from './compose.ts';
import {memoryPorts} from './github.ts';

test('a caller can replace the tracker and the review without touching the composition', () => {
  const {tracker, review} = memoryPorts({
    issues: [
      {
        key: 'LAVKA-1',
        title: 'title',
        body: '',
        state: 'OPEN',
        labels: ['Sandcastle', 'sdd:cycle'],
      },
    ],
  });
  const box = machine(process.cwd(), {tracker, review});
  assert.equal(box.tracker, tracker);
  assert.equal(box.review, review);
  assert.equal(box.tracker.issue('LAVKA-1').key, 'LAVKA-1');
});
