import assert from 'node:assert/strict';

import {requirement, scenario, spec} from '@ojson/spec-coverage';
import {changeDir} from '../machine/change/naming.ts';

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
const PAINT_TASK_ID = 'task-line-paint';
const PAINT_TASK_PATH = `${changeDir(KEY)}/tasks/${PAINT_TASK_ID}.md`.replace(/\\/g, '/');

const PAINT_TASK_BODY = [
  '## Source',
  '',
  '### Subsection',
  'Plain line.',
  '',
  '## Proof',
  '',
  'Команда.',
  '',
].join('\n');

async function openPaintTask(page: {url: string}, paths: {arcadia: string}): Promise<string> {
  writeChange(
    paths.arcadia,
    KEY,
    'tasks.md',
    `- [ ] \`${PAINT_TASK_ID}\` paint scenarios\n`,
  );
  writeChange(paths.arcadia, KEY, `tasks/${PAINT_TASK_ID}.md`, PAINT_TASK_BODY);
  await openIssue(page);
  return taskDoc(spineOf(await pageHtml(page.url), KEY, 'Tasks'));
}

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

  requirement('A level-three heading stays a button', () => {
    scenario('A level-three heading stays a button', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'implementing', {openPullRequests: 1, pull: '94'})],
        },
        async (page, _window, paths) => {
          const doc = await openPaintTask(page, paths);
          assert.equal(doc.includes('<h4>Subsection</h4>'), false);
          assert.match(lineButton(doc, '### Subsection'), /^<button\b/);
          assert.match(lineButton(doc, '### Subsection'), /data-line="### Subsection"/);
        },
      );
    });
  });

  requirement('The path stays the task file', () => {
    scenario('The path stays the task file', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'implementing', {openPullRequests: 1, pull: '94'})],
        },
        async (page, _window, paths) => {
          const doc = await openPaintTask(page, paths);
          const button = lineButton(doc, 'Plain line.');
          assert.match(button, new RegExp(`data-path="${PAINT_TASK_PATH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
        },
      );
    });
  });

  requirement('There is no diff row', () => {
    scenario('There is no diff row', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'implementing', {openPullRequests: 1, pull: '94'})],
        },
        async (page, _window, paths) => {
          const doc = await openPaintTask(page, paths);
          assert.equal(doc.includes('class="diff-row'), false);
          assert.equal(doc.includes('button.diff-row'), false);
          const targets = doc.match(/<button[^>]*class="[^"]*\bline\b[^"]*"[^>]*>/g) ?? [];
          assert.ok(targets.length > 0);
          for (const target of targets) {
            assert.equal(/\bdiff-row\b/.test(target), false);
          }
        },
      );
    });
  });

  requirement('The line stays a comment target', () => {
    scenario('The line stays a comment target', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held(KEY, 'implementing', {openPullRequests: 1, pull: '94'})],
        },
        async (page, _window, paths) => {
          const doc = await openPaintTask(page, paths);
          for (const line of ['Plain line.', '### Subsection']) {
            const button = lineButton(doc, line);
            assert.match(button, /^<button\b[^>]*type="button"[^>]*class="[^"]*\bline\b/);
            assert.equal(button.includes('class="diff-row'), false);
          }
        },
      );
    });
  });
});