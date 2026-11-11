import assert from 'node:assert/strict';

import {requirement, scenario, spec} from '@ojson/spec-coverage';
import {changeDir} from '../machine/change/naming.ts';

import {
  bandOf,
  held,
  hosted,
  MANAGER,
  pageHtml,
  post,
  spineOf,
  writeChange,
} from './__tests__/page.harness.ts';

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
          assert.equal(band.includes('<h3>ревью</h3>'), false);
          assert.match(plan, /замечание на фазу/);
          assert.match(plan, /строка вне документа/);
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
              {
                marker: null,
                file,
                line: null,
                lines: ['замечание к slice tasks'],
                comments: ['замечание к slice tasks'],
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
          const onLine = lineSlice.slice(firstAt, secondAt + 'второй тред'.length + 80);
          assert.equal(onLine.match(/class="posted-comment"/g)?.length, 3);
          assert.match(tasks, /замечание к slice tasks/);
          assert.equal(bandOf(html, KEY).includes('ревью'), false);
        },
      );
    });

    scenario(
      'A reply whose marker is sdd:fixed is a status on the original comment, with the commit when the reply has one',
      async () => {
        const scopeLine = 'Строка со статусом исправления.';
        const nextLine = 'Строка без коммита в статусе.';
        const body = proposalBody(`${scopeLine}\n${nextLine}`);
        const at = scopeLineNumber(body, scopeLine);
        const atNext = scopeLineNumber(body, nextLine);
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
                  lines: ['sdd:fixed cafebabe'],
                  comments: ['замечание до исправления'],
                  fixedCommit: 'cafebabe',
                },
                {
                  marker: 'fixed',
                  file,
                  line: atNext,
                  lines: ['sdd:fixed'],
                  comments: ['без коммита'],
                  fixedCommit: null,
                },
                {
                  marker: 'fixed',
                  file,
                  line: null,
                  lines: ['sdd:fixed phasefeed'],
                  comments: ['на фазе со статусом'],
                  fixedCommit: 'phasefeed',
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
            const withCommit = plan.slice(
              plan.indexOf(`data-at="${at}"`),
              plan.indexOf(`data-at="${at}"`) + 900,
            );
            assert.match(withCommit, /замечание до исправления/);
            assert.match(withCommit, /cafebabe/);
            assert.equal(withCommit.includes('sdd:fixed'), false);
            const withoutCommit = plan.slice(
              plan.indexOf(`data-at="${atNext}"`),
              plan.indexOf(`data-at="${atNext}"`) + 900,
            );
            assert.match(withoutCommit, /без коммита/);
            assert.equal(withoutCommit.match(/cafebabe/g)?.length ?? 0, 0);
            assert.equal(withoutCommit.includes('sdd:fixed'), false);
            const foot = plan.match(/<div class="plan-foot">[\s\S]*?<\/div>\s*<\/div>/)?.[0] ?? '';
            assert.match(foot, /на фазе со статусом/);
            assert.match(foot, /phasefeed/);
            assert.equal(bandOf(html, KEY).includes('ревью'), false);
          },
        );
      },
    );

    scenario('It is not a second comment', async () => {
      const scopeLine = 'Один комментарий и статус.';
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
                lines: ['sdd:fixed abcdef01'],
                comments: ['единственный комментарий'],
                fixedCommit: 'abcdef01',
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
          const lineSlice = plan.slice(plan.indexOf(`data-at="${at}"`), plan.indexOf(`data-at="${at}"`) + 900);
          assert.match(lineSlice, /единственный комментарий/);
          assert.match(lineSlice, /abcdef01/);
          assert.equal(lineSlice.match(/class="posted-comment"/g)?.length, 1);
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
