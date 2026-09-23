import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

import {authorIgnored, loadIgnoredAuthors, parseIgnoredAuthors} from './ignore.ts';

test('an author pattern is a case-insensitive login expression', () => {
  const patterns = parseIgnoredAuthors(`
comments:
  ignore:
    - author: sonarqubecloud
`);
  assert.equal(authorIgnored('sonarqubecloud[bot]', patterns), true);
  assert.equal(authorIgnored('SonarQubeCloud', patterns), true);
  assert.equal(authorIgnored('reviewer[bot]', patterns), false);
  assert.equal(authorIgnored('3y3', patterns), false);
});

test('a service file ignores its authors, and a service without one ignores nobody', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'sandcastle-ignore-'));
  assert.deepEqual(loadIgnoredAuthors(root), []);
  writeFileSync(path.join(root, 'sandcastle.yaml'), 'comments:\n  ignore:\n    - author: sonarqubecloud\n');
  const patterns = loadIgnoredAuthors(root);
  assert.equal(authorIgnored('sonarqubecloud[bot]', patterns), true);
  assert.equal(authorIgnored('reviewer[bot]', patterns), false);
});
