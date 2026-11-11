import assert from 'node:assert/strict';
import {test} from 'vitest';

import {openHostHandle} from './host-sandbox.ts';

test('commands run on the host, including streamed lines', async () => {
  const handle = await openHostHandle(process.cwd());
  const plain = await handle.exec('printf hi');
  assert.equal(plain.stdout, 'hi');
  assert.equal(plain.exitCode, 0);
  const lines: string[] = [];
  const streamed = await handle.exec('printf "a\\nb\\n"', {onLine: line => lines.push(line)});
  assert.deepEqual(lines, ['a', 'b']);
  assert.equal(streamed.exitCode, 0);
});
