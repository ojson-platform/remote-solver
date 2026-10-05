import assert from 'node:assert/strict';
import {test} from 'vitest';

import {authorIgnored} from './ignore.ts';

test('an ignored pattern is a case-insensitive login expression', () => {
  const patterns = [/sonarqubecloud/i];
  assert.equal(authorIgnored('sonarqubecloud[bot]', patterns), true);
  assert.equal(authorIgnored('SonarQubeCloud', patterns), true);
  assert.equal(authorIgnored('reviewer[bot]', patterns), false);
});
