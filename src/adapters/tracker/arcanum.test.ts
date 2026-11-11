import assert from 'node:assert/strict';
import {requirement, scenario, spec} from '@ojson/spec-coverage';
import {test} from 'vitest';

import {
  arcanumLinksFromPayload,
  arcanumOpenThread,
  arcanumReadLinks,
  arcanumSpeak,
  arcanumTracker,
  arcanumWriteLink,
} from './arcanum.ts';
import {changelist, fakeHttp, specPath} from './__tests__/arcanum.harness.ts';
import {linkIssue} from '../../sdd.ts';

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

spec('dependencies', () => {
  requirement('Host issue links are the child and the blocker', () => {
    scenario('The machine reads parent, blocks, blocked-by, and depends-on from the host\'s own issue links', async () => {
      const {get, post} = fakeHttp(undefined, {
        '7': {parent: '1', blocked_by: ['8'], depends_on: ['10'], blocks: ['3']},
      });
      const links = await arcanumReadLinks({get, post}, '7');
      assert.equal(links.parent, '1');
      assert.deepEqual(links.blockedBy, ['8']);
      assert.deepEqual(links.dependsOn, ['10']);
      assert.deepEqual(links.blocks, ['3']);
      const tracker = arcanumTracker({get, post}, [
        {
          key: '7',
          title: '#7: title',
          body: 'Parent: #99\nDepends: #88\n',
          state: 'OPEN',
          labels: [],
        },
      ]);
      const record = await tracker.issue('7');
      assert.equal(record.parent, '1');
      assert.deepEqual(record.blockedBy, ['8']);
      assert.deepEqual(record.dependsOn, ['10']);
    });

    scenario('It writes those links when the flow creates a child cycle or a dependency, and it does not write a body line', async () => {
      const {get, post, posts} = fakeHttp();
      await arcanumWriteLink({get, post}, '7', 'depends-on', '8');
      assert.deepEqual(posts, [{path: '/v2/public/issue/7/link', body: {kind: 'depends-on', other: '8'}}]);
    });

    scenario('The flow that opens a child cycle or a dependency writes the host link and does not write a body line', async () => {
      const {get, post, posts} = fakeHttp();
      const tracker = arcanumTracker({get, post}, [
        {key: '2', title: '#2: title', body: 'keep\n', state: 'OPEN', labels: []},
      ]);
      await linkIssue({key: '2', kind: 'parent', other: '1'}, tracker);
      assert.deepEqual(posts, [{path: '/v2/public/issue/2/link', body: {kind: 'parent', other: '1'}}]);
      assert.equal((await tracker.issue('2')).body, 'keep\n');
    });

    scenario('A parent link is a child: an open cycle issue this issue is the parent of', () => {
      const mapped = arcanumLinksFromPayload({parent: '1'});
      assert.equal(mapped.parent, '1');
    });

    scenario('A blocked-by link and a depends-on link are blockers: issues this issue waits on', () => {
      const mapped = arcanumLinksFromPayload({blocked_by: ['8'], depends_on: ['9']});
      assert.deepEqual(mapped.blockedBy, ['8']);
      assert.deepEqual(mapped.dependsOn, ['9']);
    });

    scenario('A blocks link is the other side and does not hold this issue', () => {
      const mapped = arcanumLinksFromPayload({blocks: ['4']});
      assert.deepEqual(mapped.blocks, ['4']);
      assert.deepEqual(mapped.blockedBy, []);
    });

    scenario('One issue on two of these links counts once for the wait', () => {
      const mapped = arcanumLinksFromPayload({parent: '9', blocked_by: ['9']});
      assert.equal(mapped.parent, '9');
      assert.deepEqual(mapped.blockedBy, ['9']);
    });
  });
});
