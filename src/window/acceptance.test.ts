import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {requirement, scenario, spec} from '@ojson/spec-coverage';
import {emptyHold, holdGesture, paintFrame} from './client/frame.ts';
import {renderWindow} from './client/render.ts';
import {
  MANAGER,
  bandOf,
  deltaRequirement,
  glineOf,
  held,
  hosted,
  pageHtml,
  post,
  readSnapshot,
  spineOf,
  writeChange,
} from './__tests__/page.harness.ts';

function acceptControl(html: string, name: string): string {
  const found = (html.match(/<button\b[^>]*>/g) ?? []).find(button =>
    button.includes(`aria-label="Принять ${name}"`),
  );
  assert.ok(found, name);
  return found;
}

spec('acceptance', () => {
  requirement('The current phase offers acceptance in place of its gate', () => {
    scenario('The current phase shows acceptance instead of its gate', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing', {openPullRequests: 1})]},
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'proposal.md', '## Outcome\n\nГодность.\n');
          writeChange(paths.arcadia, '1', 'design.md', '# design\n');
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          const plan = spineOf(html, '1', 'Plan');
          assert.match(plan, /aria-label="Принять Plan"/);
          const accept = html.match(/\.spine form\.accept \.cmd\s*\{[^}]*border-radius:\s*([^;]+)/);
          const plaque = html.match(/\.plaque\s*\{[^}]*border-radius:\s*([^;]+)/);
          assert.ok(accept && plaque);
          assert.equal(accept[1], plaque[1]);
          assert.equal(plan.includes('data-gate="proposing"'), false);
          assert.match(glineOf(html, '1', 'designing'), /гейт designing/);
        },
      );
    });
    scenario("An open question leaves the current gate's place empty", async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing', {openPullRequests: 1})]},
        async (page, window, paths) => {
          writeChange(
            paths.arcadia,
            '1',
            'proposal.md',
            '## Open questions\n\n- [ ] Писать ли имя проверки?\n',
          );
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const plan = spineOf(await pageHtml(page.url), '1', 'Plan');
          assert.equal(plan.includes('Принять Plan'), false);
          assert.equal(plan.includes('data-gate="proposing"'), false);
        },
      );
    });
    scenario('An empty delta offers acceptance', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying', {openPullRequests: 1})]},
        async (page, window, paths) => {
          writeChange(
            paths.arcadia,
            '1',
            'specs/section-text/spec.md',
            '## Purpose\n\nNo requirement yet.\n',
          );
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const specify = spineOf(await pageHtml(page.url), '1', 'Specify');
          assert.match(specify, /aria-label="Принять Specify"/);
          assert.equal(specify.includes('data-gate="specifying"'), false);
        },
      );
    });
    scenario('A spec turn hides acceptance', async () => {
      for (const action of ['restore-baseline', 'create-initial-specs', 'improve-specs']) {
        await hosted(
          {
            login: () => MANAGER,
            tickets: () => [held('1', 'specifying', {openPullRequests: 1})],
            turn: () => action,
          },
          async (page, window, paths) => {
            writeChange(paths.arcadia, '1', 'specs/section-text/spec.md', deltaRequirement());
            window.chooseAgent('cursor');
            assert.equal(
              (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
                .status,
              200,
            );
            const specify = spineOf(await pageHtml(page.url), '1', 'Specify');
            assert.equal(specify.includes('Принять Specify'), false, action);
            assert.equal(specify.includes('data-gate="specifying"'), false, action);
          },
        );
      }
    });
    scenario('A proposal with no capability offers acceptance', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying', {openPullRequests: 1})]},
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'proposal.md', '## Outcome\n\nНичего менять не нужно.\n');
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const specify = spineOf(await pageHtml(page.url), '1', 'Specify');
          assert.match(specify, /aria-label="Принять Specify"/);
          assert.equal(specify.includes('data-gate="specifying"'), false);
        },
      );
    });
    scenario('A named capability without a delta leaves the place empty', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying', {openPullRequests: 1})]},
        async (page, window, paths) => {
          const baseline = path.join(
            paths.arcadia,
            'services',
            'billing',
            'openspec',
            'specs',
            'section-text',
            'spec.md',
          );
          mkdirSync(path.dirname(baseline), {recursive: true});
          writeFileSync(baseline, deltaRequirement());
          writeChange(
            paths.arcadia,
            '1',
            'proposal.md',
            '## Capabilities\n\n### Added\n\n- section-text the row\n',
          );
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const specify = spineOf(await pageHtml(page.url), '1', 'Specify');
          assert.equal(specify.includes('Принять Specify'), false);
          assert.equal(specify.includes('data-gate="specifying"'), false);
        },
      );
    });
    scenario('A missing baseline leaves the place empty', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying', {openPullRequests: 1})]},
        async (page, window, paths) => {
          writeChange(
            paths.arcadia,
            '1',
            'proposal.md',
            '## Capabilities\n\n### Modified\n\n- section-text the row\n',
          );
          writeChange(paths.arcadia, '1', 'specs/section-text/spec.md', deltaRequirement());
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const specify = spineOf(await pageHtml(page.url), '1', 'Specify');
          assert.equal(specify.includes('Принять Specify'), false);
          assert.equal(specify.includes('data-gate="specifying"'), false);
        },
      );
    });
  });
  requirement('A settled decision that is not the review gate hides acceptance', () => {
    scenario('The review gate still offers acceptance', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'proposing', {openPullRequests: 1})],
          decision: () => ({
            kind: 'wait',
            issue: '1',
            reason: 'review the proposal',
            gate: {artifact: 'proposal', from: 'proposing', to: 'proposed'},
          }),
        },
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'proposal.md', '## Outcome\n\nГодность.\n');
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const plan = spineOf(await pageHtml(page.url), '1', 'Plan');
          assert.match(plan, /aria-label="Принять Plan"/);
        },
      );
    });
    scenario('An agent decision hides acceptance', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'specifying', {openPullRequests: 1})],
          decision: () => ({
            kind: 'agent',
            issue: '1',
            action: 'create-initial-specs',
            skill: 'specify',
            phase: 'specifying',
            pr: '1',
            reason: 'the proposal revision is not the stamp',
          }),
        },
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'proposal.md', '## Outcome\n\nГодность.\n');
          writeChange(paths.arcadia, '1', 'specs/section-text/spec.md', deltaRequirement());
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const specify = spineOf(await pageHtml(page.url), '1', 'Specify');
          assert.equal(specify.includes('Принять Specify'), false);
          assert.equal(specify.includes('data-gate="specifying"'), false);
        },
      );
    });
  });
  requirement('Accepting a writing phase adds its label', () => {
    scenario('Accepting the plan adds proposed', async () => {
      const tickets = [held('1', 'proposing', {openPullRequests: 1})];
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
        async (page, window, paths) => {
          writeChange(
            paths.arcadia,
            '1',
            'proposal.md',
            '## Open questions\n\n- [ ] Писать ли имя проверки?\n',
          );
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const asking = bandOf(await pageHtml(page.url), '1');
          assert.match(asking, /<label class="draft">Комментарий/);
          assert.equal(asking.includes('Принять Plan'), false);
          writeChange(paths.arcadia, '1', 'proposal.md', '## Outcome\n\nГодность.\n');
          page.note();
          const side = bandOf(await pageHtml(page.url), '1');
          assert.match(side, /aria-label="Принять Plan"/);
          assert.equal(
            (
              await post(
                page.url,
                'act',
                new URLSearchParams({act: 'accept-review', key: '1'}).toString(),
              )
            ).status,
            200,
          );
          assert.ok(tickets[0]?.labels.includes('sdd:proposed'));
          assert.ok(tickets[0]?.labels.includes('sdd:proposing'));
          assert.deepEqual(phases, []);
          assert.equal((await pageHtml(page.url)).includes('role="status"'), false);
        },
      );
    });
    scenario('Accepting the spec adds specified', async () => {
      const tickets = [held('1', 'specifying', {openPullRequests: 1})];
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
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'specs/section-text/spec.md', deltaRequirement());
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          assert.match(bandOf(await pageHtml(page.url), '1'), /Принять Specify/);
          assert.equal(
            (
              await post(
                page.url,
                'act',
                new URLSearchParams({act: 'accept-review', key: '1'}).toString(),
              )
            ).status,
            200,
          );
          assert.ok(tickets[0]?.labels.includes('sdd:specified'));
          assert.ok(tickets[0]?.labels.includes('sdd:specifying'));
        },
      );
    });
    scenario('Accepting the design adds designed', async () => {
      const tickets = [held('1', 'designing', {openPullRequests: 1})];
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
        async (page, window, paths) => {
          writeChange(
            paths.arcadia,
            '1',
            'design.md',
            '## Approach\n\nОдин модуль.\n\n## Open decisions\n',
          );
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          assert.match(bandOf(await pageHtml(page.url), '1'), /Принять Design/);
          assert.equal(
            (
              await post(
                page.url,
                'act',
                new URLSearchParams({act: 'accept-review', key: '1'}).toString(),
              )
            ).status,
            200,
          );
          assert.ok(tickets[0]?.labels.includes('sdd:designed'));
          assert.ok(tickets[0]?.labels.includes('sdd:designing'));
        },
      );
    });
    scenario('The click disables acceptance before the answer', async () => {
      const tickets = [held('1', 'designing', {openPullRequests: 1})];
      await hosted(
        {login: () => MANAGER, tickets: () => tickets},
        async (page, window, paths) => {
          writeChange(
            paths.arcadia,
            '1',
            'design.md',
            '## Approach\n\nОдин модуль.\n\n## Open decisions\n',
          );
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const before = await readSnapshot(page.url);
          assert.equal(acceptControl(renderWindow(before), 'Design').includes('disabled'), false);
          const heldFrame = paintFrame(
            before,
            holdGesture(
              emptyHold(),
              1,
              'accept-review',
              new URLSearchParams({act: 'accept-review', key: '1'}),
              before,
            ),
          );
          const html = renderWindow(heldFrame);
          assert.match(
            html,
            /<button\b(?=[^>]*disabled)(?=[^>]*aria-label="Принять Design")[^>]*>Принять<\/button>/,
          );
          assert.equal(html.includes('Принято'), false);
        },
      );
    });
    scenario('A recorded consent ignores another acceptance', async () => {
      const tickets = [held('1', 'designing', {openPullRequests: 1})];
      let writes = 0;
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => tickets,
          editLabels: (_key, add, remove) => {
            writes += 1;
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
        async (page, window, paths) => {
          writeChange(
            paths.arcadia,
            '1',
            'design.md',
            '## Approach\n\nОдин модуль.\n\n## Open decisions\n',
          );
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const accept = new URLSearchParams({act: 'accept-review', key: '1'}).toString();
          assert.equal((await post(page.url, 'act', accept)).status, 200);
          assert.equal(writes, 1);
          const html = await pageHtml(page.url);
          assert.match(
            html,
            /<button\b(?=[^>]*disabled)(?=[^>]*aria-label="Принять Design")[^>]*>Принять<\/button>/,
          );
          assert.equal(html.includes('Принято'), false);
          assert.equal((await post(page.url, 'act', accept)).status, 200);
          assert.equal(writes, 1);
        },
      );
    });
    scenario('A removed consent enables acceptance', async () => {
      const tickets = [held('1', 'designing', {openPullRequests: 1})];
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
        async (page, window, paths) => {
          writeChange(
            paths.arcadia,
            '1',
            'design.md',
            '## Approach\n\nОдин модуль.\n\n## Open decisions\n',
          );
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          assert.equal(
            (
              await post(
                page.url,
                'act',
                new URLSearchParams({act: 'accept-review', key: '1'}).toString(),
              )
            ).status,
            200,
          );
          const item = tickets[0];
          assert.ok(item);
          item.labels = item.labels.filter(label => label !== 'sdd:designed');
          assert.equal(
            acceptControl(await pageHtml(page.url), 'Design').includes('disabled'),
            false,
          );
        },
      );
    });
  });
});
