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

    scenario('A remark with no line stands on the phase', async () => {
      const scopeLine = 'Фаза без якоря.';
      const body = proposalBody(scopeLine);
      const file = planPath('');
      const missingLine = 42;
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'proposing', {openPullRequests: 1, pull: '58'})],
          review: () => ({
            threads: [
              {
                marker: null,
                file,
                line: null,
                lines: ['замечание на фазу'],
                comments: ['замечание на фазу'],
              },
              {
                marker: null,
                file,
                line: missingLine,
                lines: ['строка вне документа'],
                comments: ['строка вне документа'],
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
          const foot = plan.match(/<div class="plan-foot">[\s\S]*?<\/div>\s*<\/div>/)?.[0] ?? '';
          assert.match(foot, /замечание на фазу/);
          assert.match(foot, /строка вне документа/);
          assert.match(foot, new RegExp(`data-path="${file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
          assert.match(foot, new RegExp(`data-at="${missingLine}"`));
          const remarkAt = foot.indexOf('placeholder="Замечание ко всему документу"');
          const phaseAt = foot.indexOf('замечание на фазу');
          assert.ok(remarkAt >= 0 && phaseAt >= 0 && phaseAt < remarkAt);
          const band = bandOf(html, KEY);
          const reviewBlock =
            band.match(/<section class="block"[\s\S]*?<h3>ревью<\/h3>[\s\S]*?<\/section>/)?.[0] ??
            '';
          assert.equal(reviewBlock.includes('замечание на фазу'), false);
          assert.equal(reviewBlock.includes('строка вне документа'), false);
        },
      );
    });

    scenario('One line holds more than one comment', async () => {
      const anchorLine = 'Якорная строка в файле задачи.';
      const taskBody = ['## Source', '', anchorLine, '', '## Proof', '', 'Команда одна.', ''].join(
        '\n',
      );
      const at = scopeLineNumber(taskBody, anchorLine);
      const file = `${changeDir(KEY)}/tasks/stack-on-line.md`.replace(/\\/g, '/');
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'implementing', {openPullRequests: 1, pull: '58'})],
          review: () => ({
            threads: [
              {
                marker: null,
                file,
                line: at,
                lines: ['первый тред', 'ответ в первом'],
                comments: ['первый тред', 'ответ в первом'],
              },
              {
                marker: null,
                file,
                line: at,
                lines: ['второй тред'],
                comments: ['второй тред'],
              },
            ],
          }),
        },
        async (page, window, paths) => {
          writeChange(
            paths.arcadia,
            KEY,
            'tasks.md',
            '- [ ] `stack-on-line` — One line holds more than one comment\n',
          );
          writeChange(paths.arcadia, KEY, 'tasks/stack-on-line.md', taskBody);
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: KEY}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          const tasks = spineOf(html, KEY, 'Tasks');
          const anchor = tasks.indexOf(`data-at="${at}"`);
          assert.ok(anchor >= 0);
          const lineSlice = tasks.slice(anchor, anchor + 1200);
          const firstAt = lineSlice.indexOf('первый тред');
          const replyAt = lineSlice.indexOf('ответ в первом');
          const secondAt = lineSlice.indexOf('второй тред');
          assert.ok(firstAt >= 0 && replyAt > firstAt && secondAt > replyAt);
          assert.equal(lineSlice.match(/class="posted-comment"/g)?.length, 3);
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
