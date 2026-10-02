import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {readFileSync} from 'node:fs';
import {test} from 'vitest';

import {machine, solverRoot} from './compose.ts';
import {memoryPorts} from './github.ts';
import type {Runtime} from '../machine/port.ts';

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
  assert.equal(box.runtime, undefined);
});

test('the machine takes a runtime only from the caller', () => {
  const runtime: Runtime = {run: async () => ({commits: 0}), ask: async () => ({text: ''})};
  const box = machine(mkdtempSync(tmpdir()), {runtime});
  assert.equal(box.runtime, runtime);
  const source = readFileSync(new URL('./compose.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /runtime\.ts/);
  assert.doesNotMatch(source, /@ai-hero\/sandcastle/);
  assert.ok(solverRoot().endsWith('devops/remote-solver'));
});
