import assert from 'node:assert/strict';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {
  MANAGER,
  bare,
  glineOf,
  held,
  hosted,
  pageHtml,
  pool,
  post,
  stationOf,
  writeChange,
} from './page.harness.ts';

spec('auto-gate', () => {
  requirement('A future gate sets or clears one auto label', () => {
    scenario('Gandalf writes one auto label and does not write a phase', async () => {
      const phases: string[] = [];
      const tickets = [held('1', 'proposing')];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => tickets,
          writePhase: (_key, phase) => {
            phases.push(phase);
          },
          editLabels: (_key, add, remove) => {
            const item = tickets[0];
            if (!item) {
              return;
            }
            item.labels = item.labels.filter(label => !remove?.includes(label));
            for (const label of add) {
              if (!item.labels.includes(label)) {
                item.labels = [...item.labels, label];
              }
            }
          },
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const before = stationOf(await pageHtml(page.url), '1', 'designing');
          assert.match(before, /aria-label="Снять гейт designing"/);
          assert.match(before, /M8 0\.4/);
          assert.equal(before.includes('class="tick"'), false);
          const posted = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'gate', key: '1', station: 'designing'}).toString(),
          );
          assert.equal(posted.status, 200);
          assert.ok(tickets[0]?.labels.includes('sdd:auto-design'));
          assert.equal(tickets[0]?.labels.includes('sdd:designed'), false);
          assert.equal(tickets[0]?.labels.includes('sdd:proposed'), false);
          assert.equal(tickets[0]?.labels.includes('sdd:specified'), false);
          assert.equal(tickets[0]?.labels.includes('sdd:accepted'), false);
          assert.deepEqual(phases, []);
          const after = stationOf(await pageHtml(page.url), '1', 'designing');
          assert.match(after, /aria-label="Поставить гейт designing"/);
          assert.match(after, /class="tick"/);
          assert.equal(after.includes('M8 0.4'), false);
        },
      );
    });
    scenario('A circle removes that one label', async () => {
      const tickets = [
        held('1', 'proposing', {
          labels: ['sdd:cycle', 'sdd:proposing', 'sdd:auto-plan', 'sdd:auto-spec'],
        }),
      ];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => tickets,
          editLabels: (_key, add, remove) => {
            const item = tickets[0];
            if (!item) {
              return;
            }
            item.labels = item.labels.filter(label => !remove?.includes(label));
            for (const label of add) {
              if (!item.labels.includes(label)) {
                item.labels = [...item.labels, label];
              }
            }
          },
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const before = stationOf(await pageHtml(page.url), '1', 'specifying');
          assert.match(before, /aria-label="Поставить гейт specifying"/);
          assert.match(before, /class="tick"/);
          assert.equal(before.includes('<svg'), false);
          const posted = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'gate', key: '1', station: 'specifying'}).toString(),
          );
          assert.equal(posted.status, 200);
          assert.equal(tickets[0]?.labels.includes('sdd:auto-spec'), false);
          assert.ok(tickets[0]?.labels.includes('sdd:auto-plan'));
          assert.ok(tickets[0]?.labels.includes('sdd:proposing'));
          const after = stationOf(await pageHtml(page.url), '1', 'specifying');
          assert.match(after, /aria-label="Снять гейт specifying"/);
        },
      );
    });
    scenario('A started phase has no gate button', async () => {
      const tickets = [held('1', 'specifying')];
      const calls: string[][] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => tickets,
          editLabels: (_key, add, remove) => {
            calls.push([...(add ?? []), ...(remove ?? [])]);
          },
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          assert.equal(stationOf(html, '1', 'proposing').includes('гейт'), false);
          assert.equal(stationOf(html, '1', 'specifying').includes('гейт'), false);
          assert.match(stationOf(html, '1', 'specifying'), /class="plaque"/);
          const posted = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'gate', key: '1', station: 'proposing'}).toString(),
          );
          assert.equal(posted.status, 200);
          assert.deepEqual(calls, []);
          assert.equal(tickets[0]?.labels.includes('sdd:auto-plan'), false);
        },
      );
    });
    scenario('A door keeps the gate button in the open row', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing')]},
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'design.md', '# design\n');
          window.chooseAgent('cursor');
          const closed = await pageHtml(page.url);
          const station = stationOf(closed, '1', 'designing');
          assert.match(station, /aria-label="design"/);
          assert.equal(station.includes('гейт'), false);
          const opened = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'open', key: '1'}).toString(),
          );
          assert.equal(opened.status, 200);
          const html = await pageHtml(page.url);
          assert.match(glineOf(html, '1', 'designing'), /aria-label="Снять гейт designing"/);
          assert.match(glineOf(html, '1', 'designing'), /name="where" value="side"/);
          assert.equal(stationOf(html, '1', 'designing').includes('гейт'), false);
        },
      );
    });
    scenario('An auto label does not clear the wait', async () => {
      const tickets = [
        held('1', 'proposing', {
          labels: ['sdd:cycle', 'sdd:proposing', 'sdd:wait-human'],
          comments: [{body: 'Review the proposal and accept it.'}],
        }),
      ];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => tickets,
          editLabels: (_key, add, remove) => {
            const item = tickets[0];
            if (!item) {
              return;
            }
            item.labels = item.labels.filter(label => !remove?.includes(label));
            for (const label of add) {
              if (!item.labels.includes(label)) {
                item.labels = [...item.labels, label];
              }
            }
          },
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const posted = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'gate', key: '1', station: 'specifying'}).toString(),
          );
          assert.equal(posted.status, 200);
          assert.ok(tickets[0]?.labels.includes('sdd:auto-spec'));
          assert.ok(tickets[0]?.labels.includes('sdd:wait-human'));
          const plaque = stationOf(await pageHtml(page.url), '1', 'proposing');
          assert.match(plaque, /<span class="kicker">ask<\/span>/);
        },
      );
    });
    scenario('A station behind the plaque with no file is a dot', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'implementing')]},
        async (page, window) => {
          window.chooseAgent('cursor');
          const station = stationOf(await pageHtml(page.url), '1', 'tasking');
          assert.match(station, /<span class="dot"/);
          assert.equal(station.includes('<button'), false);
          assert.equal(station.includes('<a '), false);
        },
      );
    });
    scenario('A pool cycle sets a gate', async () => {
      const tickets = [bare('1', 'Quiet')];
      const phases: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => tickets,
          writePhase: (_key, phase) => {
            phases.push(phase);
          },
          editLabels: (_key, add, remove) => {
            const item = tickets[0];
            if (!item) {
              return;
            }
            item.labels = item.labels.filter(label => !remove?.includes(label));
            for (const label of add) {
              if (!item.labels.includes(label)) {
                item.labels = [...item.labels, label];
              }
            }
          },
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          assert.match(stationOf(html, '1', 'proposing'), /aria-label="Снять гейт proposing"/);
          assert.match(stationOf(html, '1', 'accepting'), /aria-label="Снять гейт accepting"/);
          assert.match(stationOf(html, '1', 'implementing'), /<span class="dot"/);
          const posted = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'gate', key: '1', station: 'proposing'}).toString(),
          );
          assert.equal(posted.status, 200);
          assert.ok(tickets[0]?.labels.includes('sdd:auto-plan'));
          assert.equal(tickets[0]?.labels.includes('sdd:accepted'), false);
          assert.deepEqual(phases, []);
        },
      );
    });
    scenario('Accepting sets auto-merge', async () => {
      const tickets = [bare('1', 'Quiet')];
      const phases: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => tickets,
          writePhase: (_key, phase) => {
            phases.push(phase);
          },
          editLabels: (_key, add, remove) => {
            const item = tickets[0];
            if (!item) {
              return;
            }
            item.labels = item.labels.filter(label => !remove?.includes(label));
            for (const label of add) {
              if (!item.labels.includes(label)) {
                item.labels = [...item.labels, label];
              }
            }
          },
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const posted = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'gate', key: '1', station: 'accepting'}).toString(),
          );
          assert.equal(posted.status, 200);
          assert.ok(tickets[0]?.labels.includes('sdd:auto-merge'));
          assert.equal(tickets[0]?.labels.includes('sdd:accepted'), false);
          assert.deepEqual(phases, []);
          const station = stationOf(await pageHtml(page.url), '1', 'accepting');
          assert.match(station, /aria-label="Поставить гейт accepting"/);
        },
      );
    });
    scenario('The last gate asks before it clears', async () => {
      const tickets = [
        held('1', 'proposing', {
          labels: [
            'sdd:cycle',
            'sdd:proposing',
            'sdd:auto-plan',
            'sdd:auto-spec',
            'sdd:auto-design',
          ],
        }),
      ];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => tickets,
          editLabels: (_key, add, remove) => {
            const item = tickets[0];
            if (!item) {
              return;
            }
            item.labels = item.labels.filter(label => !remove?.includes(label));
            for (const label of add) {
              if (!item.labels.includes(label)) {
                item.labels = [...item.labels, label];
              }
            }
          },
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const asked = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'gate', key: '1', station: 'accepting'}).toString(),
          );
          assert.equal(asked.status, 200);
          const dialog = await pageHtml(page.url);
          assert.match(dialog, /aria-label="Без контроля"/);
          assert.match(dialog, /Тикет останется без контроля/);
          assert.equal(tickets[0]?.labels.includes('sdd:auto-merge'), false);
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'close-ask'}).toString()))
              .status,
            200,
          );
          const kept = await pageHtml(page.url);
          assert.equal(kept.includes('Без контроля'), false);
          assert.equal(tickets[0]?.labels.includes('sdd:auto-merge'), false);
          assert.equal(
            (
              await post(
                page.url,
                'act',
                new URLSearchParams({
                  act: 'gate',
                  key: '1',
                  station: 'accepting',
                  sure: '1',
                }).toString(),
              )
            ).status,
            200,
          );
          assert.ok(tickets[0]?.labels.includes('sdd:auto-merge'));
          assert.equal(tickets[0]?.labels.includes('sdd:accepted'), false);
        },
      );
    });
  });
});

spec('auto-gate', () => {
  requirement('The open row shows three gate lines', () => {
    scenario('A passed gate is controlled from the sidebar', async () => {
      const tickets = [
        held('1', 'implementing', {
          labels: ['sdd:cycle', 'sdd:implementing', 'sdd:auto-plan'],
        }),
      ];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => tickets,
          editLabels: (_key, add, remove) => {
            const item = tickets[0];
            if (!item) {
              return;
            }
            item.labels = item.labels.filter(label => !remove?.includes(label));
            for (const label of add) {
              if (!item.labels.includes(label)) {
                item.labels = [...item.labels, label];
              }
            }
          },
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const closed = await pageHtml(page.url);
          assert.match(stationOf(closed, '1', 'proposing'), /<span class="dot"/);
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          const line = glineOf(html, '1', 'proposing');
          assert.match(line, /aria-label="Поставить гейт proposing"/);
          assert.match(line, /class="tick"/);
          const tick = html.match(/\.tick\s*\{[^}]*width:\s*(\d+)px/);
          const stop = html.match(/\.stop\s*\{[^}]*width:\s*(\d+)px/);
          assert.ok(tick && stop);
          assert.ok(Number(tick[1]) < Number(stop[1]));
          assert.equal(line.includes('>Поставить'), false);
          assert.equal(line.includes('>Снять'), false);
          const posted = await post(
            page.url,
            'act',
            new URLSearchParams({
              act: 'gate',
              key: '1',
              station: 'proposing',
              where: 'side',
            }).toString(),
          );
          assert.equal(posted.status, 200);
          assert.equal(tickets[0]?.labels.includes('sdd:auto-plan'), false);
        },
      );
    });
    scenario('A future gate repeats the station button', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing')]},
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'design.md', '# design\n');
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          const line = glineOf(html, '1', 'designing');
          assert.match(line, /гейт designing/);
          assert.match(line, /class="stop"/);
          assert.match(stationOf(html, '1', 'designing'), /aria-label="design"/);
          assert.equal(stationOf(html, '1', 'designing').includes('гейт'), false);
        },
      );
    });
  });
});
