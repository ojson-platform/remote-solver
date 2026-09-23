import assert from 'node:assert/strict';
import {test} from 'node:test';

import {placeOnDiff} from './place.ts';

const diff = `diff --git a/src/cache.ts b/src/cache.ts
--- a/src/cache.ts
+++ b/src/cache.ts
@@ -10,3 +12,4 @@
 keep
+added
 same
`;

test('a line in the diff stays, a line outside the hunk keeps the file, a missing file is dropped', () => {
  assert.deepEqual(placeOnDiff(diff, {body: 'on the addition', path: 'src/cache.ts', line: 13}), {
    body: 'on the addition',
    path: 'src/cache.ts',
    line: 13,
  });
  assert.deepEqual(placeOnDiff(diff, {body: 'elsewhere', path: 'src/cache.ts', line: 99}), {
    body: 'elsewhere',
    path: 'src/cache.ts',
  });
  assert.deepEqual(placeOnDiff(diff, {body: 'no such file', path: 'src/other.ts', line: 1}), {
    body: 'no such file',
  });
});
