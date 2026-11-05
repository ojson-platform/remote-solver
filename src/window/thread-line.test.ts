import assert from 'node:assert/strict';

import {requirement, scenario, spec} from '@ojson/spec-coverage';
import {changeDir} from '../machine/naming.ts';

import {
  bandOf,
  held,
  hosted,
  MANAGER,
  pageHtml,
  post,
  spineOf,
  writeChange,
} from './page.harness.ts';

const KEY = '49';

function planPath(arcadia: string): string {
  return `${changeDir(KEY)}/proposal.md`.replace(/\\/g, '/');
}

function proposalBody(scopeLine: string): string {
  return ['## Outcome', '', 'Годность.', '', '## Scope', '', scopeLine, ''].join('\n');
}

function scopeLineNumber(body: string, scopeLine: string): number {
  const lines = body.split('\n');
  const index = lines.indexOf(scopeLine);
  assert.ok(index >= 0, scopeLine);
  return index + 1;
}

spec('thread-line', () => {
  requirement('Each review thread stands on the line it anchors', () => {
    scenario('The sidebar shows each review thread of the open pull request on the line it anchors', async () => {
      const scopeLine = 'Строка с якорем.';
      const body = proposalBody(scopeLine);
      const at = scopeLineNumber(body, scopeLine);
      const file = planPath('');
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'proposing', {openPullRequests: 1, pull: '58'})],
          review: () => ({
            threads: [
              {
                marker: null,
                file,
                line: at,
                lines: ['только последний ответ'],
                comments: ['комментарий, который был скрыт', 'только последний ответ'],
              },
            ],
          }),
        },
        async (page, window, paths) => {
          writeChange(paths.arcadia, KEY, 'proposal.md', body);
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: KEY}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          const plan = spineOf(html, KEY, 'Plan');
          assert.match(plan, new RegExp(`data-path="${file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
          assert.match(plan, new RegExp(`data-at="${at}"`));
          const anchor = plan.indexOf(`data-at="${at}"`);
          const after = plan.slice(anchor, anchor + 800);
          assert.match(after, /комментарий, который был скрыт/);
          assert.equal(bandOf(html, KEY).includes('ревью'), false);
        },
      );
    });

    scenario('A thread that is already on the pull request is visible this way', async () => {
      const scopeLine = 'Уже на pull request.';
      const body = proposalBody(scopeLine);
      const at = scopeLineNumber(body, scopeLine);
      const file = planPath('');
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'proposing', {openPullRequests: 1, pull: '58'})],
          review: () => ({
            threads: [
              {
                marker: 'fixed',
                file,
                line: at,
                lines: ['sdd:fixed deadbeef'],
                comments: ['замечание на строке', 'sdd:fixed deadbeef'],
              },
            ],
          }),
        },
        async (page, window, paths) => {
          writeChange(paths.arcadia, KEY, 'proposal.md', body);
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: KEY}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          const plan = spineOf(html, KEY, 'Plan');
          const anchor = plan.indexOf(`data-at="${at}"`);
          const after = plan.slice(anchor, anchor + 800);
          assert.match(after, /замечание на строке/);
          assert.equal(plan.includes('sdd:fixed'), false);
          assert.equal(bandOf(html, KEY).includes('ревью'), false);
        },
      );
    });
  });
});
