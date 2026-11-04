import assert from 'node:assert/strict';
import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {MANAGER, held, hosted, pageHtml, post, spineOf, writeChange} from './page.harness.ts';

function tasksSummary(html: string, key: string): string {
  const section = spineOf(html, key, 'Tasks');
  const start = section.indexOf('<label class="rest"');
  if (start < 0) {
    return '';
  }
  const end = section.indexOf('</label>', start);
  assert.ok(end > start);
  return section.slice(start, end);
}

async function openImplementing(
  page: {url: string},
  key: string,
): Promise<void> {
  assert.equal(
    (await post(page.url, 'act', new URLSearchParams({act: 'open', key}).toString())).status,
    200,
  );
}

spec('hammer', () => {
  requirement('The impl task wears the hammer while the issue is in the running set', () => {
    scenario('The task that wears impl wears the hammer while the issue is in the running set', async () => {
      let leading = false;
      await hosted(
        {
          login: () => MANAGER,
          leading: () => leading,
          tickets: () => [held('1', 'implementing')],
        },
        async (page, _window, paths) => {
          writeChange(
            paths.arcadia,
            '1',
            'tasks.md',
            '- [ ] `impl-a` first task\n- [ ] `impl-b` second\n',
          );
          leading = true;
          page.note();
          await openImplementing(page, '1');
          const html = await pageHtml(page.url);
          const summary = tasksSummary(html, '1');
          assert.match(summary, /impl-a/);
          assert.match(summary, /<span class="badge">impl<\/span>/);
          assert.match(summary, /class="hammer mark"/);
        },
      );
    });

    scenario('The hammer goes and the impl badge stays when the agent leaves the issue', async () => {
      let leading = true;
      await hosted(
        {
          login: () => MANAGER,
          leading: () => leading,
          tickets: () => [held('1', 'implementing')],
        },
        async (page, _window, paths) => {
          writeChange(paths.arcadia, '1', 'tasks.md', '- [ ] `impl-a` open task\n');
          await openImplementing(page, '1');
          leading = false;
          page.note();
          const html = await pageHtml(page.url);
          const summary = tasksSummary(html, '1');
          assert.match(summary, /<span class="badge">impl<\/span>/);
          assert.equal(summary.includes('class="hammer'), false);
        },
      );
    });

    scenario('An issue in the running set with no impl task shows no hammer', async () => {
      await hosted(
        {
          login: () => MANAGER,
          leading: () => true,
          tickets: () => [held('1', 'implementing')],
        },
        async (page, _window, paths) => {
          writeChange(
            paths.arcadia,
            '1',
            'tasks.md',
            '- [x] `done-a` finished\n- [x] `done-b` also done\n',
          );
          await openImplementing(page, '1');
          const html = await pageHtml(page.url);
          const summary = tasksSummary(html, '1');
          assert.equal(summary.includes('class="badge">impl'), false);
          assert.equal(summary.includes('class="hammer'), false);
        },
      );
    });
  });
});
