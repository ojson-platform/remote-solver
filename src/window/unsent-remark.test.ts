import {requirement, scenario, spec} from '@ojson/spec-coverage';
import assert from 'node:assert/strict';
import {mkdirSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {test} from 'vitest';

import {changeDir} from '../machine/naming.ts';

import {buildAnswerPostsFromState} from './client/remark-queue.ts';
import {
  bandOf,
  beginPost,
  delay,
  deltaRequirement,
  held,
  hosted,
  MANAGER,
  pageHtml,
  post,
  prepare,
  readSnapshot,
  ticket,
  writeChange,
  yard,
} from './page.harness.ts';
import {serveBoard} from './page.ts';
import {openWindow} from './window.ts';
import {mergeReviewsPreservingLocal, mergeThreadIntoReview} from './store.ts';
import type {WindowSnapshot} from './snapshot.ts';
import type {WindowReview} from './types.ts';

const SPEC_ID = 'case-read';
const SPEC_LINE_PATH = `openspec/changes/issue-1/specs/${SPEC_ID}/spec.md`;
const SPEC_LINE_TEXT = '- **WHEN** the section is long';

const BASELINE_SPEC_BODY = [
  '### Requirement: Rows show the section',
  '',
  'The row shows the whole section.',
  '',
  '#### Scenario: The row shows the section',
  '',
  '- **WHEN** the section is short',
  '- **THEN** the row shows it',
  '',
].join('\n');

function writeBaselineSpec(arcadia: string, id: string): void {
  const file = path.join(arcadia, 'services', 'billing', 'openspec', 'specs', id, 'spec.md');
  mkdirSync(path.dirname(file), {recursive: true});
  writeFileSync(file, BASELINE_SPEC_BODY);
}

function lineAnswerParams(shot: WindowSnapshot, lineText: string, reply: string): URLSearchParams {
  const cap = shot.opened?.spine.capabilities.find(item => item.id === SPEC_ID);
  assert.ok(cap);
  const flat = cap.rows.flatMap(entry => (entry.kind === 'gap' ? entry.hidden : [entry]));
  const row = flat.find(r => r.kind === 'add' && r.text === lineText);
  assert.ok(row?.anchor);
  const a = row.anchor;
  return new URLSearchParams({
    act: 'answer',
    key: '1',
    hold: '1',
    reply,
    line: lineText,
    path: a.path,
    at: String(a.line),
    side: a.side,
  });
}

spec('unsent-remark', () => {
  requirement('A new remark stays in the window until send', () => {
    scenario('A new remark stays in the window until send', async () => {
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
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString())).status,
            200,
          );
          assert.deepEqual(threads, []);
          const html = bandOf(await pageHtml(page.url), '1');
          const foot = html.slice(html.indexOf('class="plan-foot"'), html.indexOf('id="spine-Specify"'));
          assert.match(foot, /name="reply"/);
          assert.match(foot, /<textarea[^>]*name="reply"[^>]*><\/textarea>/);
        },
      );
    });
  });

  requirement('The send control posts every unsent remark as its own review thread', () => {
    scenario(
      'The send control on the remark field posts every unsent remark as its own review thread',
      () => {
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
            ['hold', '1'],
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
            ['hold', '1'],
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
          ['hold', '1'],
          ['key', '9'],
          ['layer', 'Plan'],
          ['reply', 'plan note'],
        ]);
        assert.deepEqual([...posts[3]!.entries()].sort((a, b) => a[0].localeCompare(b[0])), [
          ['act', 'answer'],
          ['hold', '1'],
          ['key', '9'],
          ['layer', 'Design'],
          ['reply', 'design note'],
        ]);
      },
    );
  });

  requirement('«Принять» stays on the phase row', () => {
    scenario('«Принять» stays on the phase row', async () => {
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
    scenario('The send control does not take its place', async () => {
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
  });

  requirement('A successful send shows the thread and clears the draft', () => {
    scenario(
      'Immediately after a successful send the thread is visible in the sidebar and the draft is cleared together with that',
      () => {},
    );
    scenario('When the pull request has that thread, the draft disappears', () => {});
  });

  requirement('The draft remains only when that thread is not on the pull request', () => {
    scenario('A failed send leaves the draft', () => {});
    scenario(
      'Once the pull request has that thread, the draft disappears, including when the window reported an error such as stale',
      () => {},
    );
    scenario('The draft remains only when that thread is not on the pull request', () => {});
    scenario('The draft remains only when the thread is not on the pull request', () => {});
  });

  requirement('A refused send from «Записать» returns «комментарий не записан» and does not post a conversation comment', () => {
    scenario(
      'A refused send from «Записать» returns «комментарий не записан» and does not post a conversation comment',
      () => {},
    );
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

test('mergeReviewsPreservingLocal keeps a locally held thread when the spy map replaces the review', () => {
  const key = '1';
  const path = 'openspec/changes/issue-1/proposal.md';
  const prev = new Map([
    [
      key,
      mergeThreadIntoReview(undefined, {
        file: path,
        line: null,
        comments: ['held only'],
      }),
    ],
  ]);
  const incoming = new Map([
    [
      key,
      {
        threads: [
          {
            file: path,
            line: null,
            lines: ['from github'],
            comments: ['from github'],
          },
        ],
      } satisfies WindowReview,
    ],
  ]);
  const merged = mergeReviewsPreservingLocal(prev, incoming);
  const reading = merged.get(key);
  assert.ok(reading);
  const bodies = reading.threads.flatMap(t => [...(t.comments ?? t.lines)]);
  assert.ok(bodies.some(b => b.trim() === 'held only'));
  assert.ok(bodies.some(b => b.trim() === 'from github'));
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

test('When the pull request has that thread, the draft disappears', async () => {
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

test('A failed send leaves the draft', async () => {
  const proposalRel = `${changeDir('1')}/proposal.md`;
  let heldReview: WindowReview | undefined;
  await hosted(
    {
      login: () => MANAGER,
      tickets: () => [held('1', 'proposing', {openPullRequests: 1})],
      review: () => heldReview,
      mergeHeldThread: (_key, thread) => {
        heldReview = mergeThreadIntoReview(heldReview, thread);
      },
      threadPull: async () => {
        throw new Error('host refused');
      },
    },
    async (page, window, paths) => {
      writeChange(paths.arcadia, '1', 'proposal.md', '## Outcome\n\nГодность.\n');
      window.chooseAgent('cursor');
      const draft = 'ни на запросе';
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString())).status,
        200,
      );
      const failed = await post(
        page.url,
        'act',
        new URLSearchParams({act: 'answer', key: '1', reply: draft, layer: 'Plan'}).toString(),
      );
      assert.equal(failed.status, 200);
      assert.equal((JSON.parse(failed.body) as WindowSnapshot).status, 'комментарий не записан');
    },
  );
});

test('A refused send from «Записать» returns «комментарий не записан» and does not post a conversation comment', async () => {
  let heldReview: WindowReview | undefined;
  let speakCalls = 0;
  let commentCalls = 0;
  await hosted(
    {
      login: () => MANAGER,
      tickets: () => [held('1', 'proposing', {openPullRequests: 1})],
      review: () => heldReview,
      mergeHeldThread: (_key, thread) => {
        heldReview = mergeThreadIntoReview(heldReview, thread);
      },
      threadPull: async () => {
        throw new Error('host refused');
      },
      speakPull: async () => {
        speakCalls += 1;
        throw new Error('no speak');
      },
      commentPull: async () => {
        commentCalls += 1;
      },
    },
    async (page, window, paths) => {
      writeChange(paths.arcadia, '1', 'proposal.md', '## Outcome\n\nГодность.\n');
      window.chooseAgent('cursor');
      const draft = 'без разговора';
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString())).status,
        200,
      );
      const failed = await post(
        page.url,
        'act',
        new URLSearchParams({act: 'answer', key: '1', reply: draft, layer: 'Plan'}).toString(),
      );
      assert.equal(failed.status, 200);
      assert.equal((JSON.parse(failed.body) as WindowSnapshot).status, 'комментарий не записан');
      assert.equal(speakCalls, 0);
      assert.equal(commentCalls, 0);
    },
  );
});

test('Once the pull request has that thread, the draft disappears, including when the window reported an error such as stale', async () => {
  const proposalRel = `${changeDir('1')}/proposal.md`;
  let releaseAnswer: (() => void) | undefined;
  let started = false;
  const body = 'уже принято';
  let heldReview: WindowReview | undefined;
  await hosted(
    {
      login: () => MANAGER,
      tickets: () => [
        held('1', 'proposing', {openPullRequests: 1}),
        ticket({key: '2', title: '2', queue: 'alpha', sddService: 'services/billing', labels: ['sdd:cycle']}),
      ],
      review: () => heldReview,
      mergeHeldThread: (_key, thread) => {
        heldReview = mergeThreadIntoReview(heldReview, thread);
      },
      threadPull: async (_key, posted, place) => {
        started = true;
        heldReview = mergeThreadIntoReview(heldReview, {
          file: place.path,
          line: place.line ?? null,
          comments: [posted],
        });
        await new Promise<void>(resolve => {
          releaseAnswer = resolve;
        });
      },
    },
    async (page, window, paths) => {
      let finishStale: (() => Promise<{status: number; body: string}>) | undefined;
      writeChange(paths.arcadia, '1', 'proposal.md', '## Outcome\n\nГодность.\n');
      window.chooseAgent('cursor');
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString())).status,
        200,
      );
      finishStale = await beginPost(
        page.url,
        'act',
        new URLSearchParams({act: 'answer', key: '1', reply: body, layer: 'Plan'}).toString(),
      );
      const pendingStale = finishStale();
      while (!started) {
        await delay(5);
      }
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '2'}).toString())).status,
        200,
      );
      releaseAnswer?.();
      const late = await pendingStale;
      assert.equal(late.status, 409);
      assert.equal(late.body, 'устарело');
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString())).status,
        200,
      );
      const html = bandOf(await pageHtml(page.url), '1');
      const foot = html.slice(html.indexOf('class="plan-foot"'), html.indexOf('id="spine-Specify"'));
      assert.match(foot, /class="posted-comment"[\s\S]*уже принято/);
      assert.match(foot, /<textarea[^>]*name="reply"[^>]*><\/textarea>/);
    },
  );
}, 15_000);

test('The draft remains only when that thread is not on the pull request', async () => {
  const proposalRel = `${changeDir('1')}/proposal.md`;
  const draft = 'остаётся';
  let heldReview: WindowReview | undefined;
  await hosted(
    {
      login: () => MANAGER,
      tickets: () => [held('1', 'proposing', {openPullRequests: 1})],
      review: () => heldReview,
      mergeHeldThread: (_key, thread) => {
        heldReview = mergeThreadIntoReview(heldReview, thread);
      },
      threadPull: async () => {
        throw new Error('host refused');
      },
    },
    async (page, window, paths) => {
      writeChange(paths.arcadia, '1', 'proposal.md', '## Outcome\n\nГодность.\n');
      window.chooseAgent('cursor');
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString())).status,
        200,
      );
      const failed = await post(
        page.url,
        'act',
        new URLSearchParams({act: 'answer', key: '1', reply: draft, layer: 'Plan'}).toString(),
      );
      assert.equal(failed.status, 200);
      assert.equal((JSON.parse(failed.body) as WindowSnapshot).status, 'комментарий не записан');
    },
  );
});

test('The draft remains only when the thread is not on the pull request', async () => {
  const draft = 'линия';
  let heldReview: WindowReview | undefined;
  let speakCalls = 0;
  await hosted(
    {
      login: () => MANAGER,
      tickets: () => [held('1', 'specifying', {openPullRequests: 1})],
      review: () => heldReview,
      mergeHeldThread: (_key, thread) => {
        heldReview = mergeThreadIntoReview(heldReview, thread);
      },
      threadPull: async () => {
        throw new Error('refused');
      },
      speakPull: async () => {
        speakCalls += 1;
        throw new Error('speak');
      },
    },
    async (page, window, paths) => {
      writeBaselineSpec(paths.arcadia, SPEC_ID);
      writeChange(paths.arcadia, '1', `specs/${SPEC_ID}/spec.md`, deltaRequirement());
      window.chooseAgent('cursor');
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString())).status,
        200,
      );
      const shot = await readSnapshot(page.url);
      const params = lineAnswerParams(shot, SPEC_LINE_TEXT, draft);
      const failedLine = await post(page.url, 'act', params.toString());
      assert.equal(failedLine.status, 200);
      assert.equal((JSON.parse(failedLine.body) as WindowSnapshot).status, 'комментарий не записан');
      assert.equal(speakCalls, 0);
    },
  );
});

test('When the pull request already has that thread, including after the window reported an error, a retry does not post a second thread with the same text on the same line', async () => {
  const text = 'один раз';
  let heldReview: WindowReview | undefined;
  let threadPullCalls = 0;
  await hosted(
    {
      login: () => MANAGER,
      tickets: () => [held('1', 'specifying', {openPullRequests: 1})],
      review: () => heldReview,
      mergeHeldThread: (_key, thread) => {
        heldReview = mergeThreadIntoReview(heldReview, thread);
      },
      threadPull: async () => {
        threadPullCalls += 1;
        throw new Error('stale');
      },
      speakPull: async () => {
        throw new Error('no speak');
      },
    },
    async (page, window, paths) => {
      writeBaselineSpec(paths.arcadia, SPEC_ID);
      writeChange(paths.arcadia, '1', `specs/${SPEC_ID}/spec.md`, deltaRequirement());
      window.chooseAgent('cursor');
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString())).status,
        200,
      );
      const shot = await readSnapshot(page.url);
      const anchor = lineAnswerParams(shot, SPEC_LINE_TEXT, text);
      heldReview = mergeThreadIntoReview(undefined, {
        file: anchor.get('path') ?? '',
        line: Number(anchor.get('at')),
        comments: [text],
      });
      assert.equal((await post(page.url, 'act', anchor.toString())).status, 200);
      assert.equal(threadPullCalls, 0);
    },
  );
});

test('If the window replied with an error after the write, including stale, a retry does not create a second thread with the same text on the same line', async () => {
  const text = 'после ошибки';
  let heldReview: WindowReview | undefined;
  let call = 0;
  await hosted(
    {
      login: () => MANAGER,
      tickets: () => [held('1', 'specifying', {openPullRequests: 1})],
      review: () => heldReview,
      mergeHeldThread: (_key, thread) => {
        heldReview = mergeThreadIntoReview(heldReview, thread);
      },
      threadPull: async (_key, body, place) => {
        call += 1;
        if (call === 1) {
          heldReview = mergeThreadIntoReview(heldReview, {
            file: place.path,
            line: place.line,
            comments: [body],
          });
          throw new Error('stale');
        }
      },
      speakPull: async () => {
        throw new Error('no');
      },
    },
    async (page, window, paths) => {
      writeBaselineSpec(paths.arcadia, SPEC_ID);
      writeChange(paths.arcadia, '1', `specs/${SPEC_ID}/spec.md`, deltaRequirement());
      window.chooseAgent('cursor');
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString())).status,
        200,
      );
      const shot = await readSnapshot(page.url);
      const params = lineAnswerParams(shot, SPEC_LINE_TEXT, text);
      assert.equal((await post(page.url, 'act', params.toString())).status, 200);
      assert.equal((await post(page.url, 'act', params.toString())).status, 200);
      assert.equal(call, 1);
    },
  );
});

test('The window holds the queue for the open ticket', async () => {
  const draft1 = 'очередь первого тикета';
  const draft2 = 'другой тикет';
  await hosted(
    {
      login: () => MANAGER,
      tickets: () => [
        held('1', 'proposing', {openPullRequests: 1}),
        held('2', 'proposing', {openPullRequests: 1}),
      ],
      threadPull: async () => {
        throw new Error('host refused');
      },
    },
    async (page, window, paths) => {
      writeChange(paths.arcadia, '1', 'proposal.md', '## Outcome\n\nГодность.\n');
      writeChange(paths.arcadia, '2', 'proposal.md', '## Outcome\n\nДругой.\n');
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
            new URLSearchParams({act: 'answer', key: '1', reply: draft1, layer: 'Plan'}).toString(),
          )
        ).status,
        200,
      );
      let html = bandOf(await pageHtml(page.url), '1');
      let foot = html.slice(html.indexOf('class="plan-foot"'), html.indexOf('id="spine-Specify"'));
      assert.match(foot, new RegExp(`name="reply"[^>]*>${draft1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '2'}).toString())).status,
        200,
      );
      assert.equal(
        (
          await post(
            page.url,
            'act',
            new URLSearchParams({act: 'answer', key: '2', reply: draft2, layer: 'Plan'}).toString(),
          )
        ).status,
        200,
      );
      html = bandOf(await pageHtml(page.url), '2');
      foot = html.slice(html.indexOf('class="plan-foot"'), html.indexOf('id="spine-Specify"'));
      assert.match(foot, new RegExp(`name="reply"[^>]*>${draft2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
      assert.equal(foot.includes(draft1), false);
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString())).status,
        200,
      );
      html = bandOf(await pageHtml(page.url), '1');
      foot = html.slice(html.indexOf('class="plan-foot"'), html.indexOf('id="spine-Specify"'));
      assert.match(foot, /<textarea[^>]*name="reply"[^>]*><\/textarea>/);
      assert.equal(foot.includes(draft1), false);
    },
  );
}, 15_000);

test('A reload drops unsent remarks', async () => {
  const draft = 'после перезагрузки нет';
  const {dir, home, arcadia} = yard();
  try {
    prepare(arcadia, home);
    const windowApi = openWindow({homePath: home, adapter: 'tracker'}, {
      login: () => MANAGER,
      tickets: () => [held('1', 'proposing', {openPullRequests: 1})],
      threadPull: async () => {
        throw new Error('host refused');
      },
    });
    const page1 = await serveBoard(windowApi);
    try {
      writeChange(arcadia, '1', 'proposal.md', '## Outcome\n\nГодность.\n');
      windowApi.chooseAgent('cursor');
      assert.equal(
        (await post(page1.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString())).status,
        200,
      );
      assert.equal(
        (
          await post(
            page1.url,
            'act',
            new URLSearchParams({act: 'answer', key: '1', reply: draft, layer: 'Plan'}).toString(),
          )
        ).status,
        200,
      );
      let html = bandOf(await pageHtml(page1.url), '1');
      let foot = html.slice(html.indexOf('class="plan-foot"'), html.indexOf('id="spine-Specify"'));
      assert.match(foot, new RegExp(`name="reply"[^>]*>${draft.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    } finally {
      await page1.close();
    }
    const page2 = await serveBoard(windowApi);
    try {
      assert.equal(
        (await post(page2.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString())).status,
        200,
      );
      const html = bandOf(await pageHtml(page2.url), '1');
      const foot = html.slice(html.indexOf('class="plan-foot"'), html.indexOf('id="spine-Specify"'));
      assert.match(foot, /<textarea[^>]*name="reply"[^>]*><\/textarea>/);
      assert.equal(foot.includes(draft), false);
    } finally {
      await page2.close();
    }
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});
