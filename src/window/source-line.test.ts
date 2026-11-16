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
  const escaped = line
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const marker = `data-line="${escaped}"`;
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
  '- > alpha',
  '  beta',
  '  - nested inner',
  '- **bold**, *em*, `inline`, and [link](https://example.com)',
  '  ```',
  '  list code',
  '  ```',
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
            const listQuoteAlpha = lineButton(plan, '- > alpha');
            const listQuoteAlphaInner = listQuoteAlpha.slice(
              listQuoteAlpha.indexOf('>') + 1,
              listQuoteAlpha.lastIndexOf('</button>'),
            );
            assert.match(listQuoteAlphaInner, /<span>- alpha<\/span>/);
            const listQuoteBeta = lineButton(plan, '  beta');
            const listQuoteBetaInner = listQuoteBeta.slice(
              listQuoteBeta.indexOf('>') + 1,
              listQuoteBeta.lastIndexOf('</button>'),
            );
            assert.equal(listQuoteBetaInner, 'beta');
            assert.match(plan, /<span>\s*- nested inner<\/span>/);
            assert.match(plan, /<code>list code<\/code>/);
            assert.match(plan, /<strong>bold<\/strong>/);
            assert.match(plan, /<em>em<\/em>/);
            assert.match(plan, /<code>inline<\/code>/);
            assert.match(plan, /<a href="https:\/\/example\.com">link<\/a>/);
            const fenceOpen = lineButton(plan, '```fence');
            assert.match(fenceOpen, /<code><\/code>/);
            assert.equal(fenceOpen.includes('<code>```fence</code>'), false);

            const design = docOf(spineOf(html, KEY, 'Design'));
            assert.match(design, /<em>курсивом<\/em>/);
          },
        );
      },
    );

    scenario('Every covered line of a fenced code block renders inside code', async () => {
      const renderer = readFileSync(new URL('./client/source-line.tsx', import.meta.url), 'utf8');
      const slice = renderer.slice(renderer.indexOf('function paintBlockSlice'), renderer.indexOf('function paintOneLine'));
      const covered = slice.indexOf('lineInPlace(block.position, line)');
      const code = slice.indexOf("block.type === 'code'");
      assert.ok(covered >= 0 && code >= 0 && covered < code);

      const unclosed = paintSourceDocument(['```fence', '', 'x']);
      assert.match(renderToStaticMarkup(createElement(Fragment, null, unclosed[0].paint)), /<code><\/code>/);
      assert.doesNotMatch(
        renderToStaticMarkup(createElement(Fragment, null, unclosed[0].paint)),
        /```fence/,
      );
      assert.match(renderToStaticMarkup(createElement(Fragment, null, unclosed[1].paint)), /<code><\/code>/);
      assert.match(renderToStaticMarkup(createElement(Fragment, null, unclosed[2].paint)), /<code>x<\/code>/);

      const trailing = paintSourceDocument(['```', 'line  ', '```']);
      assert.match(
        renderToStaticMarkup(createElement(Fragment, null, trailing[1].paint)),
        /<code>line  <\/code>/,
      );
      const indented = paintSourceDocument(['```', '  indented', '```']);
      assert.match(
        renderToStaticMarkup(createElement(Fragment, null, indented[1].paint)),
        /<code>  indented<\/code>/,
      );

      const listFence = paintSourceDocument(['- ```js', '  line', '  indent', '```']);
      assert.match(renderToStaticMarkup(createElement(Fragment, null, listFence[0].paint)), /<code><\/code>/);
      assert.match(renderToStaticMarkup(createElement(Fragment, null, listFence[1].paint)), /<code>line<\/code>/);
      assert.match(renderToStaticMarkup(createElement(Fragment, null, listFence[2].paint)), /<code>indent<\/code>/);
      assert.doesNotMatch(
        renderToStaticMarkup(createElement(Fragment, null, listFence[1].paint)),
        /  line/,
      );
      assert.match(renderToStaticMarkup(createElement(Fragment, null, listFence[3].paint)), /<code><\/code>/);

      const proposal = ['## Scope', '', '```js', 'const x = 1', '  indented', '```', ''].join('\n');
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'proposing', {openPullRequests: 1, pull: '91'})],
        },
        async (page, _window, paths) => {
          writeChange(paths.arcadia, KEY, 'proposal.md', proposal);
          await openIssue(page);
          const plan = docOf(spineOf(await pageHtml(page.url), KEY, 'Plan'));
          assert.match(lineButton(plan, '```js'), /<code><\/code>/);
          assert.match(lineButton(plan, 'const x = 1'), /<code>const x = 1<\/code>/);
          assert.match(lineButton(plan, '  indented'), /<code>  indented<\/code>/);
          assert.match(lineButton(plan, '```'), /<code><\/code>/);
          assert.equal(plan.includes('<span class="gap"/>'), false);
        },
      );
    });

    scenario('Each covered line of a block paints only that line slice', async () => {
      const continuation = 'continuation';
      const proposal = ['## Scope', '', '### Body', '', '- item **one**', continuation, ''].join('\n');
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'proposing', {openPullRequests: 1})],
        },
        async (page, _window, paths) => {
          writeChange(paths.arcadia, KEY, 'proposal.md', proposal);
          await openIssue(page);
          const plan = docOf(spineOf(await pageHtml(page.url), KEY, 'Plan'));
          const head = lineButton(plan, '- item **one**');
          assert.match(head, /<strong>one<\/strong>/);
          assert.equal(head.includes('continuation'), false);
          const tail = lineButton(plan, continuation);
          assert.match(tail, />continuation</);
          assert.equal(tail.includes('<strong>'), false);
        },
      );
    });

    scenario("A covered line shows the node's value", async () => {
      const source = [
        '## Scope',
        '',
        '    indented-first',
        '    indented-second',
        '',
        '```js',
        'const x = 1',
        '```',
        '',
        '> ```',
        '> alpha',
        '> ```',
        '',
      ].join('\n');
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'designing', {openPullRequests: 1, pull: '91'})],
        },
        async (page, _window, paths) => {
          writeChange(paths.arcadia, KEY, 'proposal.md', source);
          writeChange(paths.arcadia, KEY, 'design.md', source);
          await openIssue(page);
          const html = await pageHtml(page.url);
          for (const layer of ['Plan', 'Design'] as const) {
            const doc = docOf(spineOf(html, KEY, layer));
            const indentedFirst = lineButton(doc, '    indented-first');
            assert.match(indentedFirst, /<code>indented-first<\/code>/);
            assert.equal(indentedFirst.includes('<code>    indented-first</code>'), false);
            const indentedSecond = lineButton(doc, '    indented-second');
            assert.match(indentedSecond, /<code>indented-second<\/code>/);
            assert.equal(indentedSecond.includes('indented-first'), false);
            const body = lineButton(doc, 'const x = 1');
            assert.match(body, /<code>const x = 1<\/code>/);
            assert.equal(body.includes('const x = 1</button>'), false);
            const open = lineButton(doc, '```js');
            assert.match(open, /<code><\/code>/);
            const close = lineButton(doc, '```');
            assert.match(close, /<code><\/code>/);
            const quoteAlpha = lineButton(doc, '> alpha');
            assert.match(quoteAlpha, /<code>alpha<\/code>/);
            assert.doesNotMatch(quoteAlpha, /<code>&gt; alpha<\/code>/);
            assert.doesNotMatch(quoteAlpha, /<code>> alpha<\/code>/);
          }
        },
      );
    });

    scenario('A fenced code block set in a nested blockquote shows alpha and does not show the raw source', async () => {
      const source = ['## Scope', '', '> > ```', '> > alpha', '> > ```', ''].join('\n');
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'designing', {openPullRequests: 1, pull: '91'})],
        },
        async (page, _window, paths) => {
          writeChange(paths.arcadia, KEY, 'proposal.md', source);
          writeChange(paths.arcadia, KEY, 'design.md', source);
          await openIssue(page);
          const html = await pageHtml(page.url);
          for (const layer of ['Plan', 'Design'] as const) {
            const doc = docOf(spineOf(html, KEY, layer));
            const alpha = lineButton(doc, '> > alpha');
            assert.match(alpha, /<code>alpha<\/code>/);
            assert.doesNotMatch(alpha, /<code>&gt; alpha<\/code>/);
            assert.doesNotMatch(alpha, /<code>> alpha<\/code>/);
            const closeAt = source.split('\n').lastIndexOf('> > ```') + 1;
            const closeMarker = doc.match(
              new RegExp(`<button[^>]*data-at="${closeAt}"[^>]*>[\\s\\S]*?</button>`),
            )?.[0];
            assert.ok(closeMarker);
            const closeInner = closeMarker!.slice(
              closeMarker!.indexOf('>') + 1,
              closeMarker!.lastIndexOf('</button>'),
            );
            assert.match(closeInner, /<code><\/code>/);
            assert.equal(closeInner.includes('```'), false);
            assert.equal(closeInner.includes('&gt;'), false);
          }
        },
      );
    });

    scenario('An indented code block set in a blockquote shows the node value and each later line slice', async () => {
      const source = ['## Scope', '', '>     ```', '>     body', '>     tail', ''].join('\n');
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'designing', {openPullRequests: 1, pull: '91'})],
        },
        async (page, _window, paths) => {
          writeChange(paths.arcadia, KEY, 'proposal.md', source);
          writeChange(paths.arcadia, KEY, 'design.md', source);
          await openIssue(page);
          const html = await pageHtml(page.url);
          for (const layer of ['Plan', 'Design'] as const) {
            const doc = docOf(spineOf(html, KEY, layer));
            const open = lineButton(doc, '>     ```');
            assert.match(open, /<code>```<\/code>/);
            assert.doesNotMatch(open, /<code><\/code>/);
            const body = lineButton(doc, '>     body');
            assert.match(body, /<code>body<\/code>/);
            assert.equal(body.includes('```'), false);
            const tail = lineButton(doc, '>     tail');
            assert.match(tail, /<code>tail<\/code>/);
            assert.equal(tail.includes('body'), false);
          }
        },
      );
    });

    scenario('A closed tilde fence shows that line slice and not the raw marker', async () => {
      const source = ['## Scope', '', '~~~', 'alpha', 'beta', '~~~', ''].join('\n');
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'designing', {openPullRequests: 1, pull: '91'})],
        },
        async (page, _window, paths) => {
          writeChange(paths.arcadia, KEY, 'proposal.md', source);
          writeChange(paths.arcadia, KEY, 'design.md', source);
          await openIssue(page);
          const html = await pageHtml(page.url);
          for (const layer of ['Plan', 'Design'] as const) {
            const doc = docOf(spineOf(html, KEY, layer));
            const alpha = lineButton(doc, 'alpha');
            assert.match(alpha, /<code>alpha<\/code>/);
            assert.equal(alpha.includes('beta'), false);
            const beta = lineButton(doc, 'beta');
            assert.match(beta, /<code>beta<\/code>/);
            assert.equal(beta.includes('alpha'), false);
            const closeAt = source.split('\n').lastIndexOf('~~~') + 1;
            const closeMarker = doc.match(
              new RegExp(
                `<button[^>]*data-at="${closeAt}"[^>]*>[\\s\\S]*?</button>`,
              ),
            )?.[0];
            assert.ok(closeMarker);
            assert.match(closeMarker!, /<code><\/code>/);
            assert.equal(closeMarker!.includes('<code>~~~</code>'), false);
          }
        },
      );
    });

    scenario('An unclosed fence line the value does not contain does not show the raw source', async () => {
      const source = ['## Scope', '', '```fence', '', 'x', ''].join('\n');
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'designing', {openPullRequests: 1, pull: '91'})],
        },
        async (page, _window, paths) => {
          writeChange(paths.arcadia, KEY, 'proposal.md', source);
          writeChange(paths.arcadia, KEY, 'design.md', source);
          await openIssue(page);
          const html = await pageHtml(page.url);
          for (const layer of ['Plan', 'Design'] as const) {
            const doc = docOf(spineOf(html, KEY, layer));
            const open = lineButton(doc, '```fence');
            assert.match(open, /<code><\/code>/);
            assert.equal(open.includes('<code>```fence</code>'), false);
            assert.match(lineButton(doc, 'x'), /<code>x<\/code>/);
          }
        },
      );
    });

    scenario('A link reference definition does not show the raw source', async () => {
      const source = [
        '## Scope',
        '',
        '[ref]: https://example.com',
        '  "title"',
        '',
        'See [ref].',
        '',
      ].join('\n');
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'designing', {openPullRequests: 1, pull: '91'})],
        },
        async (page, _window, paths) => {
          writeChange(paths.arcadia, KEY, 'proposal.md', source);
          writeChange(paths.arcadia, KEY, 'design.md', source);
          await openIssue(page);
          const html = await pageHtml(page.url);
          for (const layer of ['Plan', 'Design'] as const) {
            const doc = docOf(spineOf(html, KEY, layer));
            const def = lineButton(doc, '[ref]: https://example.com');
            const defInner = def.slice(def.indexOf('>') + 1, def.lastIndexOf('</button>'));
            assert.equal(defInner, '');
            const title = lineButton(doc, '  "title"');
            const titleInner = title.slice(title.indexOf('>') + 1, title.lastIndexOf('</button>'));
            assert.equal(titleInner, '');
            assert.match(lineButton(doc, 'See [ref].'), /<a[^>]*>ref<\/a>/);
          }
        },
      );
    });

    scenario('A four-backtick fence line and a fence-shaped indented block show that line slice', async () => {
      const source = [
        '## Scope',
        '',
        '````',
        '```',
        '````',
        '',
        '    ```',
        '    body',
        '',
      ].join('\n');
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'designing', {openPullRequests: 1, pull: '91'})],
        },
        async (page, _window, paths) => {
          writeChange(paths.arcadia, KEY, 'proposal.md', source);
          writeChange(paths.arcadia, KEY, 'design.md', source);
          await openIssue(page);
          const html = await pageHtml(page.url);
          for (const layer of ['Plan', 'Design'] as const) {
            const doc = docOf(spineOf(html, KEY, layer));
            const inner = lineButton(doc, '```');
            assert.match(inner, /<code>```<\/code>/);
            assert.doesNotMatch(inner, /<code><\/code>/);
            const indentedOpen = lineButton(doc, '    ```');
            assert.match(indentedOpen, /<code>```<\/code>/);
            const indentedBody = lineButton(doc, '    body');
            assert.match(indentedBody, /<code>body<\/code>/);
            assert.equal(indentedBody.includes('```'), false);
          }
        },
      );
    });

    scenario('A reference link whose label spans two source lines shows the node value', async () => {
      const source = ['## Scope', '', '[long', 'label][ref]', '', '[ref]: u', ''].join('\n');
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'designing', {openPullRequests: 1, pull: '91'})],
        },
        async (page, _window, paths) => {
          writeChange(paths.arcadia, KEY, 'proposal.md', source);
          writeChange(paths.arcadia, KEY, 'design.md', source);
          await openIssue(page);
          const html = await pageHtml(page.url);
          for (const layer of ['Plan', 'Design'] as const) {
            const doc = docOf(spineOf(html, KEY, layer));
            const first = lineButton(doc, '[long');
            const firstInner = first.slice(first.indexOf('>') + 1, first.lastIndexOf('</button>'));
            assert.equal(firstInner, 'long');
            assert.doesNotMatch(first, /<code><\/code>/);
            const second = lineButton(doc, 'label][ref]');
            assert.match(second, /label/);
            assert.match(second, /<a[^>]*href="u"[^>]*>[\s\S]*label/);
            assert.doesNotMatch(second, /<code><\/code>/);
          }
        },
      );
    });

    scenario('A source line is not parsed as its own markdown document', async () => {
      const renderer = readFileSync(new URL('./client/source-line.tsx', import.meta.url), 'utf8');
      assert.equal(renderer.includes('@mdx-js/mdx'), false);
      assert.equal(renderer.includes('evaluateSync'), false);
      assert.match(renderer, /remark/);
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'designing', {openPullRequests: 1})],
        },
        async (page, _window, paths) => {
          writeChange(paths.arcadia, KEY, 'proposal.md', MARKDOWN_PROPOSAL);
          writeChange(paths.arcadia, KEY, 'design.md', MARKDOWN_DESIGN);
          await openIssue(page);
          const html = await pageHtml(page.url);
          for (const layer of ['Plan', 'Design'] as const) {
            const doc = docOf(spineOf(html, KEY, layer));
            const buttons = doc.match(/<button[^>]*class="[^"]*line/g) ?? [];
            for (const button of buttons) {
              assert.equal(button.includes('<div class="doc">'), false);
            }
            assert.ok(buttons.length > 0);
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

  requirement('data-at is the source line number sectionsOf already assigns', () => {
    scenario('data-at is the source line number sectionsOf already assigns', async () => {
      const proposalLine = '- list item';
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'designing', {openPullRequests: 1})],
        },
        async (page, _window, paths) => {
          writeChange(paths.arcadia, KEY, 'proposal.md', MARKDOWN_PROPOSAL);
          writeChange(paths.arcadia, KEY, 'design.md', MARKDOWN_DESIGN);
          await openIssue(page);
          const html = await pageHtml(page.url);
          const planAt = sourceLineNumber(MARKDOWN_PROPOSAL, proposalLine);
          assert.match(lineButton(docOf(spineOf(html, KEY, 'Plan')), proposalLine), new RegExp(`data-at="${planAt}"`));
          const designLine = 'Пункт с *курсивом*.';
          const designAt = sourceLineNumber(MARKDOWN_DESIGN, designLine);
          assert.match(
            lineButton(docOf(spineOf(html, KEY, 'Design')), designLine.trimEnd()),
            new RegExp(`data-at="${designAt}"`),
          );
        },
      );
    });

    scenario('data-at follows each spine line of a place that spans several source lines', async () => {
      const continuation = 'continuation';
      const proposal = ['## Scope', '', '### Body', '', '- item **one**', continuation, ''].join('\n');
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'proposing', {openPullRequests: 1})],
        },
        async (page, _window, paths) => {
          writeChange(paths.arcadia, KEY, 'proposal.md', proposal);
          await openIssue(page);
          const at = sourceLineNumber(proposal, continuation);
          const button = lineButton(await pageHtml(page.url), continuation);
          assert.match(button, new RegExp(`data-at="${at}"`));
        },
      );
    });

    scenario('data-at is read from the spine line, not remark placeAt', () => {
      const sidebar = readFileSync(new URL('./client/sidebar.tsx', import.meta.url), 'utf8');
      assert.doesNotMatch(sidebar, /placeAt - 1/);
      assert.match(sidebar, /const at = line\.line;/);
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

  requirement('A level-two heading stays the section h3, not a button', () => {
    scenario('A level-two heading stays the section h3, not a button', async () => {
      const proposal = ['## Scope', '', 'Текст.', '', '## Outcome', '', 'Готово.', ''].join('\n');
      const design = ['## Approach', '', 'Описание.', '', '## Open decisions', '', 'Решено.', ''].join('\n');
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'designing', {openPullRequests: 1, pull: '91'})],
        },
        async (page, _window, paths) => {
          writeChange(paths.arcadia, KEY, 'proposal.md', proposal);
          writeChange(paths.arcadia, KEY, 'design.md', design);
          await openIssue(page);
          const html = await pageHtml(page.url);
          for (const [layer, surface] of [
            ['Plan', spineOf(html, KEY, 'Plan')],
            ['Design', spineOf(html, KEY, 'Design')],
          ] as const) {
            if (layer === 'Plan') {
              assert.match(surface, /<h3>Scope<\/h3>/);
              assert.match(surface, /<h3>Outcome<\/h3>/);
              assert.equal(surface.includes('data-line="## Scope"'), false);
              assert.equal(surface.includes('data-line="## Outcome"'), false);
            } else {
              assert.match(surface, /<h3>Approach<\/h3>/);
              assert.match(surface, /<h3>Open decisions<\/h3>/);
              assert.equal(surface.includes('data-line="## Approach"'), false);
              assert.equal(surface.includes('data-line="## Open decisions"'), false);
            }
          }
        },
      );
    });
  });

  requirement('A level-three heading stays the h4 from partsOf, not a button', () => {
    scenario('A level-three heading stays the h4 from partsOf, not a button', async () => {
      const proposal = ['## Scope', '', '### Detail', '', 'Строка плана.', ''].join('\n');
      const design = ['## Approach', '', '### Detail', '', 'Строка дизайна.', ''].join('\n');
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'designing', {openPullRequests: 1, pull: '91'})],
        },
        async (page, _window, paths) => {
          writeChange(paths.arcadia, KEY, 'proposal.md', proposal);
          writeChange(paths.arcadia, KEY, 'design.md', design);
          await openIssue(page);
          const html = await pageHtml(page.url);
          for (const [layer, line] of [
            ['Plan', 'Строка плана.'],
            ['Design', 'Строка дизайна.'],
          ] as const) {
            const doc = docOf(spineOf(html, KEY, layer));
            assert.match(doc, /<h4>Detail<\/h4>/);
            assert.equal(doc.includes('data-line="### Detail"'), false);
            assert.match(lineButton(doc, line), /^<button\b/);
          }
        },
      );
    });
  });

  requirement('A run of blank lines stays one span.gap', () => {
    scenario('A covered blank line stays the slice of the value', async () => {
      const source = ['## Scope', '```js', 'before', '', 'after', '```'].join('\n');
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'designing', {openPullRequests: 1, pull: '91'})],
        },
        async (page, _window, paths) => {
          writeChange(paths.arcadia, KEY, 'proposal.md', source);
          writeChange(paths.arcadia, KEY, 'design.md', source);
          await openIssue(page);
          const html = await pageHtml(page.url);
          const lines = source.split('\n');
          const openFence = lines.indexOf('```js');
          const closeFence = lines.lastIndexOf('```');
          const fenceBlank =
            lines.findIndex((line, index) => line === '' && index > openFence && index < closeFence) + 1;
          assert.ok(fenceBlank > 0);
          for (const layer of ['Plan', 'Design'] as const) {
            const doc = docOf(spineOf(html, KEY, layer));
            const marker = `data-at="${fenceBlank}"`;
            const atPos = doc.indexOf(marker);
            assert.ok(atPos >= 0, marker);
            const start = doc.lastIndexOf('<button', atPos);
            const button = doc.slice(start, doc.indexOf('</button>', atPos) + '</button>'.length);
            assert.match(button, /^<button\b[^>]*class="[^"]*\bline\b/);
            assert.match(button, /<code><\/code>/);
            const fence = doc.slice(doc.indexOf('```js'), doc.indexOf('after'));
            assert.equal(fence.includes('class="gap"'), false);
            assert.equal(doc.match(/<span class="gap"/g)?.length ?? 0, 0);
          }
        },
      );
    });

    scenario('A run of blank lines stays one span.gap', async () => {
      const gapDesign = ['## Approach', '', 'Первая.', '', '', '', 'Вторая.', ''].join('\n');
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'designing', {openPullRequests: 1})],
        },
        async (page, _window, paths) => {
          writeChange(paths.arcadia, KEY, 'proposal.md', GAP_PROPOSAL);
          writeChange(paths.arcadia, KEY, 'design.md', gapDesign);
          await openIssue(page);
          const html = await pageHtml(page.url);
          for (const layer of ['Plan', 'Design'] as const) {
            const doc = docOf(spineOf(html, KEY, layer));
            const gaps = doc.match(/<span class="gap"/g) ?? [];
            assert.equal(gaps.length, 1);
          }
        },
      );
    });
  });

  requirement('With no pull request, the line stays a p.line and is not a comment target', () => {
    scenario('With no pull request, the line stays a p.line and is not a comment target', async () => {
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
