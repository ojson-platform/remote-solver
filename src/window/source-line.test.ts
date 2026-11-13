import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

import {requirement, scenario, spec} from '@ojson/spec-coverage';
import {changeDir} from '../machine/change/naming.ts';

import {App} from './client/app.tsx';
import {draftsAfterClick} from './page.ts';
import {
  MANAGER,
  held,
  hosted,
  pageHtml,
  post,
  readSnapshot,
  spineOf,
  writeChange,
} from './__tests__/page.harness.ts';

const KEY = '87';

const PROPOSAL_PATH = `${changeDir(KEY)}/proposal.md`.replace(/\\/g, '/');
const DESIGN_PATH = `${changeDir(KEY)}/design.md`.replace(/\\/g, '/');

async function openIssue(page: {url: string}): Promise<void> {
  assert.equal(
    (await post(page.url, 'act', new URLSearchParams({act: 'open', key: KEY}).toString())).status,
    200,
  );
}

function sourceLineNumber(body: string, needle: string): number {
  const lines = body.split('\n');
  const index = lines.findIndex(line => line === needle || line.trimEnd() === needle.trimEnd());
  assert.ok(index >= 0, needle);
  return index + 1;
}

function lineButton(html: string, line: string): string {
  const marker = `data-line="${line}"`;
  const at = html.indexOf(marker);
  assert.ok(at >= 0, marker);
  const start = html.lastIndexOf('<button', at);
  return html.slice(start, html.indexOf('</button>', at) + '</button>'.length);
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function docOf(spine: string): string {
  const start = spine.indexOf('<div class="doc">');
  assert.ok(start >= 0);
  const end = spine.indexOf('</div>', start + '<div class="doc">'.length);
  assert.ok(end > start);
  return spine.slice(start, end + '</div>'.length);
}

const MARKDOWN_PROPOSAL = [
  '## Scope',
  '',
  '### Notes',
  '',
  '# Leaf heading',
  '#### Deep heading',
  '- list item',
  '- **bold**, *em*, `inline`, and [link](https://example.com)',
  '```fence',
  '',
].join('\n');

const MARKDOWN_DESIGN = [
  '## Approach',
  '',
  '### Detail',
  '',
  'Пункт с *курсивом*.',
  '',
].join('\n');

const GAP_PROPOSAL = ['## Outcome', '', 'Первая строка.', '', '', '', 'Вторая строка.', ''].join(
  '\n',
);

spec('source-line', () => {
  requirement('On each surface, every source line the leaf paints renders markdown', () => {
    scenario(
      'On each surface, every source line the leaf paints renders markdown (headings, lists, emphasis, links, and code)',
      async () => {
        await hosted(
          {
            login: () => MANAGER,
            tickets: () => [held(KEY, 'proposing', {openPullRequests: 1})],
          },
          async (page, _window, paths) => {
            writeChange(paths.arcadia, KEY, 'proposal.md', MARKDOWN_PROPOSAL);
            writeChange(paths.arcadia, KEY, 'design.md', MARKDOWN_DESIGN);
            await openIssue(page);
            const html = await pageHtml(page.url);
            const plan = docOf(spineOf(html, KEY, 'Plan'));
            assert.match(plan, /<span[^>]*>Leaf heading<\/span>/);
            assert.match(plan, /<span[^>]*>Deep heading<\/span>/);
            assert.match(plan, /<span[^>]*>- list item<\/span>/);
            assert.match(plan, /<strong>bold<\/strong>/);
            assert.match(plan, /<em>em<\/em>/);
            assert.match(plan, /<code>inline<\/code>/);
            assert.match(plan, /<a href="https:\/\/example\.com">link<\/a>/);
            assert.match(plan, /<code>```fence<\/code>/);

            const design = docOf(spineOf(html, KEY, 'Design'));
            assert.match(design, /<em>курсивом<\/em>/);
          },
        );
      },
    );
  });

  requirement('PlanLines stays the leaf', () => {
    scenario('PlanLines stays the leaf', async () => {
      const line = '- list item';
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'proposing', {openPullRequests: 1})],
        },
        async (page, _window, paths) => {
          writeChange(paths.arcadia, KEY, 'proposal.md', MARKDOWN_PROPOSAL);
          await openIssue(page);
          const plan = docOf(spineOf(await pageHtml(page.url), KEY, 'Plan'));
          assert.match(plan, new RegExp(`<button[^>]*class="[^"]*line[^"]*"[^>]*data-line="${line}"`));
          assert.equal(plan.includes('class="diff-row'), false);
        },
      );
    });
  });

  requirement('data-line is the source line with trailing space removed and stays the draft key', () => {
    scenario('data-line is the source line with trailing space removed and stays the draft key', async () => {
      const raw = 'Строка с хвостом.   ';
      const proposal = ['## Scope', '', '### Body', '', raw, ''].join('\n');
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'proposing', {openPullRequests: 1})],
        },
        async (page, _window, paths) => {
          writeChange(paths.arcadia, KEY, 'proposal.md', proposal);
          await openIssue(page);
          const html = await pageHtml(page.url);
          const trimmed = raw.trimEnd();
          assert.ok(html.includes(`data-line="${trimmed}"`));
          assert.equal(html.includes(`data-line="${raw}"`), false);
          const button = lineButton(html, trimmed);
          assert.match(button, new RegExp(`data-line="${trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
        },
      );
    });
  });

  requirement('data-path is proposal.md or design.md under the change read path', () => {
    scenario('data-path is proposal.md or design.md under the change read path', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'designing', {openPullRequests: 1})],
        },
        async (page, _window, paths) => {
          writeChange(paths.arcadia, KEY, 'proposal.md', '## Outcome\n\nГотово.\n');
          writeChange(paths.arcadia, KEY, 'design.md', MARKDOWN_DESIGN);
          await openIssue(page);
          const html = await pageHtml(page.url);
          assert.ok(html.includes(`data-path="${PROPOSAL_PATH}"`));
          assert.ok(html.includes(`data-path="${DESIGN_PATH}"`));
        },
      );
    });
  });

  requirement('data-at is the source line number sectionsOf already assigns', () => {
    scenario('data-at is the source line number sectionsOf already assigns', async () => {
      const line = 'Пункт с *курсивом*.';
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'designing', {openPullRequests: 1})],
        },
        async (page, _window, paths) => {
          writeChange(paths.arcadia, KEY, 'design.md', MARKDOWN_DESIGN);
          await openIssue(page);
          const at = sourceLineNumber(MARKDOWN_DESIGN, line);
          const button = lineButton(await pageHtml(page.url), line.trimEnd());
          assert.match(button, new RegExp(`data-at="${at}"`));
        },
      );
    });
  });

  requirement('data-side is right', () => {
    scenario('data-side is right', async () => {
      const line = '- list item';
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'proposing', {openPullRequests: 1})],
        },
        async (page, _window, paths) => {
          writeChange(paths.arcadia, KEY, 'proposal.md', MARKDOWN_PROPOSAL);
          await openIssue(page);
          const button = lineButton(await pageHtml(page.url), line);
          assert.match(button, /data-side="right"/);
        },
      );
    });
  });

  requirement('The line stays a comment target', () => {
    scenario('The line stays a comment target', async () => {
      const line = '- list item';
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'proposing', {openPullRequests: 1, pull: '91'})],
        },
        async (page, _window, paths) => {
          writeChange(paths.arcadia, KEY, 'proposal.md', MARKDOWN_PROPOSAL);
          writeChange(paths.arcadia, KEY, 'design.md', MARKDOWN_DESIGN);
          await openIssue(page);
          for (const layer of ['Plan', 'Design'] as const) {
            const doc = docOf(spineOf(await pageHtml(page.url), KEY, layer));
            const button = lineButton(doc, layer === 'Plan' ? line : 'Пункт с *курсивом*.'.trimEnd());
            assert.match(button, /^<button\b[^>]*type="button"[^>]*class="[^"]*\bline\b/);
            assert.equal(button.includes('class="diff-row'), false);
          }
        },
      );
    });
  });

  requirement('A click opens the remark draft on that line', () => {
    scenario('A click opens the remark draft on that line', async () => {
      const line = '- **bold**, *em*, `inline`, and [link](https://example.com)';
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'proposing', {openPullRequests: 1, pull: '91'})],
        },
        async (page, _window, paths) => {
          writeChange(paths.arcadia, KEY, 'proposal.md', MARKDOWN_PROPOSAL);
          await openIssue(page);
          const shot = await readSnapshot(page.url);
          const drafts = draftsAfterClick([], line);
          const html = renderToStaticMarkup(createElement(App, {snapshot: shot, drafts}));
          const plan = docOf(spineOf(html, KEY, 'Plan'));
          const button = lineButton(plan, line);
          assert.match(button, /<a href="https:\/\/example\.com">link<\/a>/);
          assert.match(
            plan,
            new RegExp(
              `${escapeRe(button)}[\\s\\S]*<form[^>]*class="line-note"[\\s\\S]*name="line"[^>]*value="${escapeRe(line)}"`,
            ),
          );
          const main = readFileSync(new URL('./client/main.tsx', import.meta.url), 'utf8');
          const lineClick = main.slice(
            main.indexOf("target?.closest('button.line, button.diff-row')"),
            main.indexOf('memory.drafts = next.map', main.indexOf("target?.closest('button.line, button.diff-row')")),
          );
          assert.match(lineClick, /preventDefault\(\)/);
          assert.match(lineClick, /button\.line/);
        },
      );
    });
  });

  requirement('There is no diff row', () => {
    scenario('There is no diff row', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'designing', {openPullRequests: 1, pull: '91'})],
        },
        async (page, _window, paths) => {
          writeChange(paths.arcadia, KEY, 'proposal.md', MARKDOWN_PROPOSAL);
          writeChange(paths.arcadia, KEY, 'design.md', MARKDOWN_DESIGN);
          await openIssue(page);
          const html = await pageHtml(page.url);
          for (const layer of ['Plan', 'Design'] as const) {
            const doc = docOf(spineOf(html, KEY, layer));
            assert.equal(doc.includes('class="diff-row'), false);
            assert.equal(doc.includes('button.diff-row'), false);
          }
        },
      );
    });
  });

  requirement('LineNote and posted line comments stay on that path and line', () => {
    scenario('LineNote and posted line comments stay on that path and line', async () => {
      const line = '- list item';
      const body = 'замечание на строке плана';
      const at = sourceLineNumber(MARKDOWN_PROPOSAL, line);
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'proposing', {openPullRequests: 1, pull: '91'})],
          review: () => ({
            threads: [
              {
                marker: null,
                file: PROPOSAL_PATH,
                line: at,
                lines: [body],
                comments: [body],
              },
            ],
          }),
        },
        async (page, _window, paths) => {
          writeChange(paths.arcadia, KEY, 'proposal.md', MARKDOWN_PROPOSAL);
          await openIssue(page);
          const plain = spineOf(await pageHtml(page.url), KEY, 'Plan');
          const onLine = plain.slice(plain.indexOf(`data-at="${at}"`), plain.indexOf(`data-at="${at}"`) + 1600);
          assert.match(onLine, /class="posted-comment"[\s\S]*замечание на строке плана/);
          assert.match(onLine, new RegExp(`data-path="${escapeRe(PROPOSAL_PATH)}"`));
          assert.match(onLine, new RegExp(`data-at="${at}"`));
          const shot = await readSnapshot(page.url);
          const drafts = [{line, text: 'черновик', question: ''}];
          const plan = spineOf(renderToStaticMarkup(createElement(App, {snapshot: shot, drafts})), KEY, 'Plan');
          const button = lineButton(plan, line);
          assert.match(button, new RegExp(`data-path="${escapeRe(PROPOSAL_PATH)}"`));
          assert.match(button, new RegExp(`data-at="${at}"`));
          const slice = plan.slice(plan.indexOf(`data-at="${at}"`), plan.indexOf(`data-at="${at}"`) + 1200);
          assert.match(slice, /class="line-note"/);
          assert.match(slice, new RegExp(`name="path"[^>]*value="${escapeRe(PROPOSAL_PATH)}"`));
          assert.match(slice, new RegExp(`name="at"[^>]*value="${at}"`));
          assert.equal(slice.match(/class="diff-row/g)?.length ?? 0, 0);
          assert.equal(plain.includes('class="diff-row'), false);
        },
      );
    });
  });

  requirement('A run of blank lines stays one span.gap', () => {
    scenario('A run of blank lines stays one span.gap', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'proposing', {openPullRequests: 1})],
        },
        async (page, _window, paths) => {
          writeChange(paths.arcadia, KEY, 'proposal.md', GAP_PROPOSAL);
          await openIssue(page);
          const doc = docOf(spineOf(await pageHtml(page.url), KEY, 'Plan'));
          const gaps = doc.match(/<span class="gap"/g) ?? [];
          assert.equal(gaps.length, 1);
        },
      );
    });
  });
});
