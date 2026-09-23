import assert from 'node:assert/strict';
import {test} from 'node:test';

import {annotate} from './actions.ts';

test('an annotation is a GitHub Actions workflow command', () => {
  const lines: string[] = [];
  const write = console.log;
  console.log = line => lines.push(String(line));
  try {
    annotate('error', '#12 remark', 'line one\nline two: 50%');
    annotate('warning', '#12 wait', 'checks are pending');
  } finally {
    console.log = write;
  }
  assert.deepEqual(lines, [
    '::error title=#12 remark::line one%0Aline two: 50%25',
    '::warning title=#12 wait::checks are pending',
  ]);
});
