import assert from 'node:assert/strict';

import {requirement, scenario, spec} from '@ojson/spec-coverage';
import {changeDir} from '../machine/change/naming.ts';

import {MANAGER, held, hosted, pageHtml, post, spineOf, writeChange} from './__tests__/page.harness.ts';

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
