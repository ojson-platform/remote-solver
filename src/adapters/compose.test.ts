import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'vitest';

import {machine, solverRoot} from './compose.ts';
import {memoryPorts} from './github.ts';
import type {Runtime} from '../machine/port.ts';

test('a caller can replace the tracker and the review without touching the composition', async () => {
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
  const box = machine(process.cwd(), {tracker, review, config: {queues: [{name: 'Sandcastle'}]}});
  assert.equal(box.tracker, tracker);
  assert.equal(box.review, review);
  assert.equal((await box.tracker.issue('LAVKA-1')).key, 'LAVKA-1');
  assert.equal(box.runtime, undefined);
});

test('the machine takes a runtime only from the caller', () => {
  const runtime: Runtime = {run: async () => ({commits: 0}), ask: async () => ({text: ''})};
  const box = machine(mkdtempSync(tmpdir()), {runtime, config: {queues: [{name: 'Sandcastle'}]}});
  assert.equal(box.runtime, runtime);
  const source = readFileSync(new URL('./compose.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /runtime\.ts/);
  assert.doesNotMatch(source, /@ai-hero\/sandcastle/);
  const root = solverRoot();
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {name?: string};
  assert.equal(pkg.name, '@ojson/remote-solver');
});

test('a bare machine throws when queues are missing', () => {
  assert.throws(() => machine(mkdtempSync(tmpdir())), /queues is missing/);
});
