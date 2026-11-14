import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Fragment, createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

import {requirement, scenario, spec} from '@ojson/spec-coverage';
import {changeDir} from '../machine/change/naming.ts';

import {App} from './client/app.tsx';
import {paintSourceDocument} from './client/source-line.tsx';
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
  requirement('The document renders as one markdown document', () => {
    scenario('Plan and Design render the source as one markdown document', async () => {
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

    scenario('Every covered line of a fenced code block renders inside code', () => {
      const painted = paintSourceDocument(['```fence', '', 'x']);
      assert.match(renderToStaticMarkup(createElement(Fragment, null, painted[0].paint)), /<code>```fence<\/code>/);
      assert.match(renderToStaticMarkup(createElement(Fragment, null, painted[1].paint)), /<code><\/code>/);
      assert.match(renderToStaticMarkup(createElement(Fragment, null, painted[2].paint)), /<code>x<\/code>/);
    });

    scenario('A source line is not wrapped as its own markdown document', async () => {
      const renderer = readFileSync(new URL('./client/source-line.tsx', import.meta.url), 'utf8');
      assert.equal(renderer.includes('@mdx-js/mdx'), false);
      assert.equal(renderer.includes('evaluateSync'), false);
      assert.match(renderer, /remark/);
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'proposing', {openPullRequests: 1})],
        },
        async (page, _window, paths) => {
          writeChange(paths.arcadia, KEY, 'proposal.md', MARKDOWN_PROPOSAL);
          await openIssue(page);
          const doc = docOf(spineOf(await pageHtml(page.url), KEY, 'Plan'));
          const buttons = doc.match(/<button[^>]*class="[^"]*line/g) ?? [];
          for (const button of buttons) {
            assert.equal(button.includes('<div class="doc">'), false);
          }
        },
      );
    });
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

  requirement('data-at is the source line number the rendered place came from', () => {
    scenario('data-at is the source line number the rendered place came from', async () => {
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
            const lineKey = layer === 'Plan' ? line : 'Пункт с *курсивом*.'.trimEnd();
            const button = lineButton(doc, lineKey);
            assert.match(button, /^<button\b[^>]*type="button"[^>]*class="[^"]*\bline\b/);
            assert.equal(button.includes('class="diff-row'), false);
            if (layer === 'Design') {
              assert.match(button, /<em>курсивом<\/em>/);
            } else {
              assert.match(button, />- list item<\/span>/);
              assert.equal(button.includes('data-question='), false);
            }
          }
        },
      );
    });
  });

  requirement('A click opens the remark draft on that line', () => {
    scenario('A click opens the remark draft on the source line', async () => {
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
          const other = '- list item';
          const drafts = draftsAfterClick([], line);
          assert.equal(drafts.length, 1);
          assert.equal(drafts[0]?.line, line);
          assert.equal(drafts[0]?.line, lineButton(await pageHtml(page.url), line).match(/data-line="([^"]*)"/)?.[1]);
          const html = renderToStaticMarkup(createElement(App, {snapshot: shot, drafts}));
          const plan = docOf(spineOf(html, KEY, 'Plan'));
          const button = lineButton(plan, line);
          assert.equal(lineButton(plan, other).includes('is-on'), false);
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
            const targets = doc.match(/<button[^>]*class="[^"]*\bline\b[^"]*"[^>]*>/g) ?? [];
            assert.ok(targets.length > 0);
            for (const target of targets) {
              assert.equal(/\bdiff-row\b/.test(target), false);
            }
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

  requirement('On Design, model.design.questions is passed only for Open questions', () => {
    scenario(
      'On Design, model.design.questions is passed only for Open questions, and a checkbox outside Open questions stays a line comment',
      async () => {
        const question = 'Имя модуля?';
        const line = `- [ ] ${question}`;
        const outside = '- [ ] не вопрос';
        const design = ['## Open questions', '', line, '', '## Notes', '', outside, ''].join('\n');
        await hosted(
          {
            login: () => MANAGER,
            tickets: () => [held(KEY, 'designing', {openPullRequests: 1, pull: '91'})],
          },
          async (page, _window, paths) => {
            writeChange(paths.arcadia, KEY, 'design.md', design);
            await openIssue(page);
            const designDoc = docOf(spineOf(await pageHtml(page.url), KEY, 'Design'));
            const openButton = lineButton(designDoc, line);
            assert.match(openButton, new RegExp(`data-question="${escapeRe(question)}"`));
            const notesAt = designDoc.indexOf('<h3>Notes</h3>');
            assert.ok(notesAt >= 0);
            const outsideButton = lineButton(designDoc.slice(notesAt), outside);
            assert.equal(outsideButton.includes('data-question'), false);
            assert.match(outsideButton, /^<button\b/);
          },
        );
      },
    );
  });

  requirement('A ## line stays the section h3, not a button', () => {
    scenario('A ## line stays the section h3, not a button', async () => {
      const proposal = ['## Scope', '', 'Текст.', '', '## Outcome', '', 'Готово.', ''].join('\n');
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'proposing', {openPullRequests: 1, pull: '91'})],
        },
        async (page, _window, paths) => {
          writeChange(paths.arcadia, KEY, 'proposal.md', proposal);
          await openIssue(page);
          const plan = spineOf(await pageHtml(page.url), KEY, 'Plan');
          assert.match(plan, /<h3>Scope<\/h3>/);
          assert.match(plan, /<h3>Outcome<\/h3>/);
          assert.equal(plan.includes('data-line="## Scope"'), false);
          assert.equal(plan.includes('data-line="## Outcome"'), false);
        },
      );
    });
  });

  requirement('A ### line stays the h4 from partsOf, not a button', () => {
    scenario('A ### line stays the h4 from partsOf, not a button', async () => {
      const proposal = ['## Scope', '', '### Detail', '', 'Строка.', ''].join('\n');
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'proposing', {openPullRequests: 1, pull: '91'})],
        },
        async (page, _window, paths) => {
          writeChange(paths.arcadia, KEY, 'proposal.md', proposal);
          await openIssue(page);
          const plan = docOf(spineOf(await pageHtml(page.url), KEY, 'Plan'));
          assert.match(plan, /<h4>Detail<\/h4>/);
          assert.equal(plan.includes('data-line="### Detail"'), false);
          const button = lineButton(plan, 'Строка.');
          assert.match(button, /^<button\b/);
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

  requirement('With no pull request, the document is not a comment target', () => {
    scenario('With no pull request, the document is not a comment target', async () => {
      const proposal = ['## Scope', '', 'Строка **bold**.', ''].join('\n');
      const design = ['## Approach', '', 'Пункт *курсив*.', ''].join('\n');
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'proposing', {openPullRequests: 0})],
        },
        async (page, _window, paths) => {
          writeChange(paths.arcadia, KEY, 'proposal.md', proposal);
          writeChange(paths.arcadia, KEY, 'design.md', design);
          await openIssue(page);
          const html = await pageHtml(page.url);
          const plan = docOf(spineOf(html, KEY, 'Plan'));
          assert.match(plan, /<p class="line">/);
          assert.match(plan, /<strong>bold<\/strong>/);
          assert.equal(plan.includes('<button'), false);
          assert.equal(plan.includes('data-line'), false);
          const designDoc = docOf(spineOf(html, KEY, 'Design'));
          assert.match(designDoc, /<p class="line">/);
          assert.match(designDoc, /<em>курсив<\/em>/);
          assert.equal(designDoc.includes('<button'), false);
          assert.equal(designDoc.includes('data-path'), false);
        },
      );
    });
  });

  requirement('The phase foot stays outside the document', () => {
    scenario('The phase foot stays outside the document', async () => {
      const minimal = ['## Scope', '', 'Строка.', ''].join('\n');
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'proposing', {openPullRequests: 1, pull: '91'})],
        },
        async (page, _window, paths) => {
          writeChange(paths.arcadia, KEY, 'proposal.md', minimal);
          writeChange(paths.arcadia, KEY, 'design.md', minimal);
          await openIssue(page);
          const html = await pageHtml(page.url);
          for (const layer of ['Plan', 'Design'] as const) {
            const spine = spineOf(html, KEY, layer);
            const doc = docOf(spine);
            assert.equal(doc.includes('plan-foot'), false);
            const fold = spine.slice(spine.indexOf('<div class="fold">'));
            const docOpen = fold.indexOf('<div class="doc">');
            assert.ok(docOpen >= 0);
            const docClose = fold.indexOf('</div>', docOpen + '<div class="doc">'.length);
            const footAt = fold.indexOf('class="plan-foot"');
            assert.ok(footAt > docClose);
          }
        },
      );
    });
  });
});
