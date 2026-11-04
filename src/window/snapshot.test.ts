import assert from 'node:assert/strict';
import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {
  MANAGER,
  held,
  hosted,
  pageHtml,
  post,
  spineOf,
  stationOf,
  writeChange,
} from './page.harness.ts';

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

function plaqueButton(stationHtml: string): string {
  const match = stationHtml.match(/<button class="plaque"[\s\S]*?<\/button>/);
  assert.ok(match, 'plaque button');
  return match[0];
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
  requirement('The plaque of the phase a worker is in wears the hammer', () => {
    scenario('The Tasks-row hammer does not stay beside the plaque', async () => {
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
          assert.equal(summary.includes('class="hammer'), false);
          const plaque = stationOf(html, '1', 'implementing');
          assert.match(plaqueButton(plaque), /<svg class="hammer mark"/);
        },
      );
    });

    scenario('The hammer goes and the impl badge stays when the worker leaves', async () => {
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
          const plaque = stationOf(html, '1', 'implementing');
          assert.equal(plaqueButton(plaque).includes('hammer mark'), false);
        },
      );
    });
  });
});
