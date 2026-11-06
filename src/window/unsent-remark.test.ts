import {requirement, scenario, spec} from '@ojson/spec-coverage';
import assert from 'node:assert/strict';
import {test} from 'vitest';

import {changeDir} from '../machine/naming.ts';

import {buildAnswerPostsFromState} from './client/remark-queue.ts';
import {
  bandOf,
  held,
  hosted,
  MANAGER,
  pageHtml,
  post,
  writeChange,
} from './page.harness.ts';
import {mergeThreadIntoReview} from './store.ts';
import type {WindowReview} from './types.ts';

spec('unsent-remark', () => {
  requirement('A new remark stays in the window until send', () => {
    scenario('A new remark stays in the window until send', () => {});
  });

  requirement('The send control posts every unsent remark as its own review thread', () => {
    scenario(
      'The send control on the remark field posts every unsent remark as its own review thread',
      () => {},
    );
  });

  requirement('«Принять» stays on the phase row', () => {
    scenario('«Принять» stays on the phase row', () => {});
    scenario('The send control does not take its place', () => {});
  });

  requirement('A successful send shows the thread and clears the draft', () => {
    scenario(
      'Immediately after a successful send the thread is visible in the sidebar and the draft is cleared together with that',
      () => {},
    );
    scenario('After the GitHub thread has been accepted, the draft must disappear', () => {});
  });

  requirement('The draft remains only when that thread is not on the pull request', () => {
    scenario('A failed send leaves the draft', () => {});
    scenario(
      'Once GitHub has accepted the thread, the draft disappears, including when the window reported an error such as stale',
      () => {},
    );
    scenario('The draft remains only when that thread is not on the pull request', () => {});
    scenario('The draft remains only when the thread is not on the pull request', () => {});
  });

  requirement('A retry does not post a second thread with the same text on the same line', () => {
    scenario(
      'When the pull request already has that thread, including after the window reported an error, a retry does not post a second thread with the same text on the same line',
      () => {},
    );
    scenario(
      'If the window replied with an error after the write, including stale, a retry does not create a second thread with the same text on the same line',
      () => {},
    );
  });

  requirement('The window holds the queue for the open ticket', () => {
    scenario('The window holds the queue for the open ticket', () => {});
    scenario('A reload drops unsent remarks', () => {});
  });
});

test('The send control on the remark field posts every unsent remark as its own review thread', () => {
  const posts = buildAnswerPostsFromState(
    '9',
    [
      {line: '- line A', text: '  first line  ', question: ''},
      {line: '- line B', text: 'second', question: ''},
    ],
    line => {
      if (line === '- line A') {
        return {path: 'a.md', at: '1', side: 'right'};
      }
      if (line === '- line B') {
        return {path: 'b.md', at: '2', side: 'left'};
      }
      return undefined;
    },
    {Plan: 'plan note', Specify: '', Design: 'design note'},
  );
  assert.equal(posts.length, 4);
  assert.deepEqual(
    [...posts[0]!.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    [
      ['act', 'answer'],
      ['at', '1'],
      ['key', '9'],
      ['line', '- line A'],
      ['path', 'a.md'],
      ['question', ''],
      ['reply', 'first line'],
      ['side', 'right'],
    ],
  );
  assert.deepEqual(
    [...posts[1]!.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    [
      ['act', 'answer'],
      ['at', '2'],
      ['key', '9'],
      ['line', '- line B'],
      ['path', 'b.md'],
      ['question', ''],
      ['reply', 'second'],
      ['side', 'left'],
    ],
  );
  assert.deepEqual([...posts[2]!.entries()].sort((a, b) => a[0].localeCompare(b[0])), [
    ['act', 'answer'],
    ['key', '9'],
    ['layer', 'Plan'],
    ['reply', 'plan note'],
  ]);
  assert.deepEqual([...posts[3]!.entries()].sort((a, b) => a[0].localeCompare(b[0])), [
    ['act', 'answer'],
    ['key', '9'],
    ['layer', 'Design'],
    ['reply', 'design note'],
  ]);
});

test('«Принять» stays on the phase row', async () => {
  await hosted(
    {login: () => MANAGER, tickets: () => [held('1', 'proposing', {openPullRequests: 1})]},
    async (page, window, paths) => {
      writeChange(paths.arcadia, '1', 'proposal.md', '## Outcome\n\nГодность.\n');
      window.chooseAgent('cursor');
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString())).status,
        200,
      );
      const html = bandOf(await pageHtml(page.url), '1');
      const spinePlan = html.slice(html.indexOf('id="spine-Plan"'), html.indexOf('id="spine-Specify"'));
      assert.match(spinePlan, /class="acts"[^>]*>[\s\S]*accept-review[\s\S]*aria-label="Принять Plan"/);
      assert.match(spinePlan, /class="plan-foot"[\s\S]*aria-label="Записать"/);
    },
  );
});

test('The send control does not take its place', async () => {
  await hosted(
    {login: () => MANAGER, tickets: () => [held('1', 'proposing', {openPullRequests: 1})]},
    async (page, window, paths) => {
      writeChange(paths.arcadia, '1', 'proposal.md', '## Outcome\n\nГодность.\n');
      window.chooseAgent('cursor');
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString())).status,
        200,
      );
      const html = bandOf(await pageHtml(page.url), '1');
      const spinePlan = html.slice(html.indexOf('id="spine-Plan"'), html.indexOf('id="spine-Specify"'));
      const acts = spinePlan.match(/<div class="acts">[\s\S]*?<\/div>/)?.[0] ?? '';
      assert.match(acts, /accept-review/);
      assert.equal(acts.includes('class="send"'), false);
    },
  );
});

test('A new remark stays in the window until send', async () => {
  const threads: {path: string; line?: number; subject_type?: 'file'}[] = [];
  await hosted(
    {
      login: () => MANAGER,
      tickets: () => [held('1', 'proposing', {openPullRequests: 1})],
      threadPull: (_key, _body, place) => {
        threads.push({
          path: place.path,
          line: place.line,
          subject_type: place.subject_type,
        });
        return Promise.resolve();
      },
    },
    async (page, window, paths) => {
      writeChange(paths.arcadia, '1', 'proposal.md', '## Outcome\n\nГодность.\n');
      window.chooseAgent('cursor');
      window.openCard('1');
      void window.answer('1', '', '   ', '', '', '', '', 'Plan');
      assert.deepEqual(threads, []);
    },
  );
});

test('mergeThreadIntoReview ignores a duplicate thread body on the same file and line bucket', () => {
  const path = 'openspec/changes/issue-1/proposal.md';
  const once = mergeThreadIntoReview(undefined, {
    file: path,
    line: null,
    comments: ['same'],
  });
  const twice = mergeThreadIntoReview(once, {
    file: path,
    line: null,
    comments: ['same'],
  });
  assert.equal(twice.threads.length, 1);
});

test('Immediately after a successful send the thread is visible in the sidebar and the draft is cleared together with that', async () => {
  const proposalRel = `${changeDir('1')}/proposal.md`;
  const opened: {path: string; line?: number; subject_type?: 'file'}[] = [];
  let heldReview: WindowReview | undefined;
  await hosted(
    {
      login: () => MANAGER,
      tickets: () => [held('1', 'proposing', {openPullRequests: 1})],
      review: () => heldReview,
      mergeHeldThread: (_key, thread) => {
        heldReview = mergeThreadIntoReview(heldReview, thread);
      },
      threadPull: async (_key, body, place) => {
        opened.push({
          path: place.path,
          line: place.line,
          subject_type: place.subject_type,
        });
        assert.equal(body, 'sidebar together');
      },
    },
    async (page, window, paths) => {
      writeChange(paths.arcadia, '1', 'proposal.md', '## Outcome\n\nГодность.\n');
      window.chooseAgent('cursor');
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString())).status,
        200,
      );
      assert.equal(
        (
          await post(
            page.url,
            'act',
            new URLSearchParams({
              act: 'answer',
              key: '1',
              reply: 'sidebar together',
              layer: 'Plan',
            }).toString(),
          )
        ).status,
        200,
      );
      assert.deepEqual(opened, [{path: proposalRel, line: undefined, subject_type: 'file'}]);
      const html = bandOf(await pageHtml(page.url), '1');
      const foot = html.slice(html.indexOf('class="plan-foot"'), html.indexOf('id="spine-Specify"'));
      assert.match(foot, /class="posted-comment"[\s\S]*sidebar together/);
      assert.match(foot, /<textarea[^>]*name="reply"[^>]*><\/textarea>/);
    },
  );
});

test('After the GitHub thread has been accepted, the draft must disappear', async () => {
  const proposalRel = `${changeDir('1')}/proposal.md`;
  const body = 'уже на запросе';
  let heldReview: WindowReview | undefined = mergeThreadIntoReview(undefined, {
    file: proposalRel,
    line: null,
    comments: [body],
  });
  let threadPullCalls = 0;
  await hosted(
    {
      login: () => MANAGER,
      tickets: () => [held('1', 'proposing', {openPullRequests: 1})],
      review: () => heldReview,
      mergeHeldThread: (_key, thread) => {
        heldReview = mergeThreadIntoReview(heldReview, thread);
      },
      threadPull: async () => {
        threadPullCalls += 1;
      },
    },
    async (page, window, paths) => {
      writeChange(paths.arcadia, '1', 'proposal.md', '## Outcome\n\nГодность.\n');
      window.chooseAgent('cursor');
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString())).status,
        200,
      );
      assert.equal(
        (
          await post(
            page.url,
            'act',
            new URLSearchParams({
              act: 'answer',
              key: '1',
              reply: body,
              layer: 'Plan',
            }).toString(),
          )
        ).status,
        200,
      );
      assert.equal(threadPullCalls, 0);
      const html = bandOf(await pageHtml(page.url), '1');
      const foot = html.slice(html.indexOf('class="plan-foot"'), html.indexOf('id="spine-Specify"'));
      assert.match(foot, /class="posted-comment"[\s\S]*уже на запросе/);
      assert.match(foot, /<textarea[^>]*name="reply"[^>]*><\/textarea>/);
    },
  );
});
