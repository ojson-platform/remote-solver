import assert from 'node:assert/strict';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {
  MANAGER,
  held,
  hosted,
  pageHtml,
  post,
  spineOf,
  writeChange,
} from './__tests__/page.harness.ts';

const KEY = '89';
const TASK_ID = 'task-line-markdown';

const TASK_BODY = [
  '## Source',
  '',
  '# Leaf heading',
  '- list item',
  '**bold**',
  '[link](https://example.com)',
  '`inline`',
  '',
  '## Proof',
  '',
  'Команда.',
  '',
].join('\n');

async function openIssue(page: {url: string}): Promise<void> {
  assert.equal(
    (await post(page.url, 'act', new URLSearchParams({act: 'open', key: KEY}).toString())).status,
    200,
  );
}

function taskDoc(tasksSpine: string): string {
  const start = tasksSpine.indexOf(`<details class="task"`);
  assert.ok(start >= 0);
  const docStart = tasksSpine.indexOf('<div class="doc">', start);
  assert.ok(docStart >= 0);
  const docEnd = tasksSpine.indexOf('</div>', docStart + '<div class="doc">'.length);
  assert.ok(docEnd > docStart);
  return tasksSpine.slice(docStart, docEnd + '</div>'.length);
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

spec('task-line', () => {
  requirement('Each source line renders markdown', () => {
    scenario('Each source line renders headings, lists, emphasis, links, and code', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'implementing', {openPullRequests: 1})],
        },
        async (page, _window, paths) => {
          writeChange(
            paths.arcadia,
            KEY,
            'tasks.md',
            `- [ ] \`${TASK_ID}\` Each source line renders headings, lists, emphasis, links, and code\n`,
          );
          writeChange(paths.arcadia, KEY, `tasks/${TASK_ID}.md`, TASK_BODY);
          await openIssue(page);
          const html = await pageHtml(page.url);
          const doc = taskDoc(spineOf(html, KEY, 'Tasks'));
          const heading = lineButton(doc, '# Leaf heading');
          assert.match(heading, /<span[^>]*>Leaf heading<\/span>/);
          assert.match(lineButton(doc, '- list item'), /<span[^>]*>- list item<\/span>/);
          assert.match(lineButton(doc, '**bold**'), /<strong>bold<\/strong>/);
          assert.match(lineButton(doc, '[link](https://example.com)'), /<a href="https:\/\/example\.com">link<\/a>/);
          assert.match(lineButton(doc, '`inline`'), /<code>inline<\/code>/);
        },
      );
    });
  });
});