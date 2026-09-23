import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {Dossier} from './dossier.ts';
import {sandcastleJudge} from './judge.ts';

const dossier: Dossier = {
  issue: '12',
  pull: '16',
  head: '24143f8848df5b1328801fc59b91c078dcfce2e3',
  base: 'def',
  commits: 'abc',
  diff: 'diff',
  change: 'why',
  standards: '',
};

test('a runtime failure stays unjudged and keeps the error message', async () => {
  const verdict = await sandcastleJudge(
    {
      ask: async () => {
        throw new Error('tag <verdict> not found');
      },
    },
    dossier,
  );
  assert.deepEqual(verdict, {kind: 'unjudged', reason: 'tag <verdict> not found'});
});
