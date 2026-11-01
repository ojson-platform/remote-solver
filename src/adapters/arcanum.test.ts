import assert from 'node:assert/strict';
import {test} from 'vitest';

import {arcanumOpenThread, arcanumSpeak} from './arcanum.ts';
import {changelist, fakeHttp, specPath} from './arcanum.harness.ts';

test('a left-side thread posts the old side', async () => {
  const {get, post, posts} = fakeHttp();
  const body = 'смотрите сюда';
  await arcanumOpenThread({get, post}, '42', {
    commit: 'abc',
    path: specPath,
    line: 12,
    body,
    side: 'left',
  });
  assert.deepEqual(posts, [
    {
      path: '/v2/public/diff/7/comment',
      body: {
        entry_id: 'e1',
        is_draft: false,
        side: 'old',
        line: 12,
        size: 1,
        content: body,
      },
    },
  ]);
});

test('a pull request comment posts the given content', async () => {
  const {get, post, gets, posts} = fakeHttp();
  const content = 'ответ в переписке';
  await arcanumSpeak({get, post}, '42', content);
  assert.deepEqual(gets, []);
  assert.deepEqual(posts, [
    {
      path: '/v2/public/pull-request/42/comment',
      body: {is_draft: false, content},
    },
  ]);
});

test('an active diff without an id rejects and posts nothing', async () => {
  const {get, post, gets, posts} = fakeHttp({});
  await assert.rejects(
    arcanumOpenThread({get, post}, '42', {
      commit: 'abc',
      path: specPath,
      line: 12,
      body: 'смотрите сюда',
      side: 'right',
    }),
  );
  assert.deepEqual(posts, []);
  assert.equal(gets.includes(changelist), false);
});
