import assert from 'node:assert/strict';
import {requirement, scenario, spec} from '@ojson/spec-coverage';
import {test} from 'vitest';

import {arcanumOpenThread, arcanumSpeak} from './arcanum.ts';

const specPath = 'openspec/changes/issue-1/specs/case-read/spec.md';
const activeDiff = '/v1/pull-requests/42/active-diff?fields=id';
const changelist = '/v2/public/diff/7/changelist?fields=path,entry_id';

type Posted = {path: string; body: unknown};

function fakeHttp(active: unknown = {id: 7}) {
  const gets: string[] = [];
  const posts: Posted[] = [];
  const get = async (path: string): Promise<unknown> => {
    gets.push(path);
    if (path === activeDiff) {
      return active;
    }
    if (path === changelist) {
      return [{path: specPath, entry_id: 'e1'}];
    }
    throw new Error(`unexpected get ${path}`);
  };
  const post = async (path: string, body: unknown): Promise<void> => {
    posts.push({path, body});
  };
  return {get, post, gets, posts};
}

spec('spec-diff', () => {
  requirement('Arcanum posts a published thread on the active diff', () => {
    scenario('A published thread uses the changelist entry', async () => {
      const {get, post, gets, posts} = fakeHttp();
      const body = 'смотрите сюда';
      await arcanumOpenThread({get, post}, '42', {
        commit: 'abc',
        path: specPath,
        line: 12,
        body,
        side: 'right',
      });
      assert.deepEqual(gets, [activeDiff, changelist]);
      assert.deepEqual(posts, [
        {
          path: '/v2/public/diff/7/comment',
          body: {
            entry_id: 'e1',
            is_draft: false,
            side: 'new',
            line: 12,
            size: 1,
            content: body,
          },
        },
      ]);
    });
    scenario('A missing file fails the thread', async () => {
      const {get, post, posts} = fakeHttp();
      await assert.rejects(
        arcanumOpenThread({get, post}, '42', {
          commit: 'abc',
          path: 'src/missing.ts',
          line: 12,
          body: 'смотрите сюда',
          side: 'right',
        }),
      );
      assert.deepEqual(posts, []);
    });
  });
});

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
