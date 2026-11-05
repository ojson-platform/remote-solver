import type {SpecEntry} from './spec-diff.ts';

import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {requirement, scenario, spec} from '@ojson/spec-coverage';
import {test} from 'vitest';

import {FocusBlocks} from './client/sidebar.tsx';
import type {WindowSnapshot} from './snapshot.ts';

import {readBranch} from '../machine/change.ts';
import {changeDir} from '../machine/naming.ts';
import {changeFiles} from './change-files.ts';
import {headClickToggles, keptSpineLayer, rowHeadOpens, toggledSpineLayer} from './client/gesture.ts';
import {
  buildSpine,
  focusSpineLines,
  layerForStation,
  linesFromFocus,
  linesFromIssue,
  projectSpine,
} from './spine.ts';
import {
  MANAGER,
  bandOf,
  git,
  held,
  hosted,
  pageHtml,
  post,
  shown,
  spineOf,
  statusOf,
  writeChange,
} from './page.harness.ts';
import {proveAnOpenCycleWhoseOnlySidebarBlockIsFocusShowsThatBlock113} from './window.harness.ts';

function hasPhrase(entries: readonly SpecEntry[] | undefined, phrase: string): boolean {
  if (!entries) {
    return false;
  }
  for (const entry of entries) {
    if (entry.kind === 'gap') {
      if (entry.hidden.some(row => row.text.includes(phrase))) {
        return true;
      }
      continue;
    }
    if (entry.text.includes(phrase)) {
      return true;
    }
  }
  return false;
}

test('the issue mirror fills a layer the focus comment does not name', () => {
  const issue = [
    '<!-- sdd:begin -->',
    'Plan: Вызывающий узнаёт, годен ли кейс к расчёту.',
    'Tasks: 8/8',
    '<!-- sdd:end -->',
  ].join('\n');
  const focus = linesFromFocus('Code src/a.ts:4\nCode solid\nsee src/b.ts:9\n');
  assert.equal(focus.lines[0]?.raw, 'Code src/a.ts:4');
  assert.deepEqual(focus.rest, ['see src/b.ts:9']);
  const spine = buildSpine({
    key: '1',
    station: 'verifying',
    focusBody: 'Code src/a.ts:4\nCode solid\nsee src/b.ts:9\n',
    issueBody: issue,
  });
  assert.equal(layerForStation('verifying'), 'Code');
  assert.equal(spine.open, 'Code');
  assert.equal(
    spine.lines.find(line => line.layer === 'Plan')?.text,
    'Вызывающий узнаёт, годен ли кейс к расчёту.',
  );
  assert.equal(spine.lines.find(line => line.layer === 'Code')?.raw, 'Code src/a.ts:4');
  assert.equal(linesFromIssue('no marker').length, 0);
});

test('a modified sentence is marked and a task names its capability', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'spine-'));
  const checkout = path.join(dir, 'service');
  const change = path.join(checkout, changeDir('1'));
  mkdirSync(path.join(change, 'specs', 'case-read'), {recursive: true});
  mkdirSync(path.join(checkout, 'openspec', 'specs', 'case-read'), {recursive: true});
  writeFileSync(
    path.join(checkout, 'openspec', 'specs', 'case-read', 'spec.md'),
    '### Requirement: Чтение\n\nКейс читается по идентификатору.\n',
  );
  writeFileSync(
    path.join(change, 'specs', 'case-read', 'spec.md'),
    [
      '## MODIFIED Requirements',
      '',
      '### Requirement: Чтение',
      '',
      'Кейс читается по идентификатору. Проверка отсутствующего кейса не находит его.',
      '',
      'Второе предложение требования остаётся в тексте.',
      '',
      '#### Scenario: Проверка отсутствующего кейса не находит его',
      '',
      '- **WHEN** проверяют кейс, которого нет',
      '- **WHEN** справочники не полны',
      '- **THEN** проверка его не находит',
      '- **THEN** список проблем не пуст',
      '',
    ].join('\n'),
  );
  writeFileSync(
    path.join(change, 'tasks.md'),
    '- [x] `missing-case` — «Проверка отсутствующего кейса не находит его»\n',
  );
  const spine = buildSpine({key: '1', checkout, station: 'tasking'});
  const capability = spine.capabilities[0];
  assert.equal(capability?.badge, 'changed');
  assert.equal(hasPhrase(capability?.rows, 'Проверка отсутствующего кейса не находит его.'), true);
  assert.equal('added' in (capability ?? {}), false);
  assert.equal(spine.tasks[0]?.scenarios[0]?.capability, 'case-read');
  assert.equal(spine.open, 'Tasks');
  rmSync(dir, {recursive: true, force: true});
});

test('an outcome line carries its file number and a blank line keeps one', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'spine-'));
  const checkout = path.join(dir, 'service');
  const proposal = [
    '# Change',
    '',
    '## Outcome',
    '',
    'Вызывающий узнаёт итог.',
    '',
    'Второй абзац после пустой строки.',
    '',
  ].join('\n');
  const file = path.join(checkout, changeDir('1'), 'proposal.md');
  mkdirSync(path.dirname(file), {recursive: true});
  writeFileSync(file, proposal);
  const spine = buildSpine({key: '1', checkout});
  const outcome = spine.proposal.sections.find(section => section.heading === 'Outcome');
  assert.ok(outcome);
  const second = 'Второй абзац после пустой строки.';
  const fileLine = proposal.split('\n').indexOf(second) + 1;
  const found = outcome.lines.find(line => line.text === second);
  assert.ok(found);
  assert.equal(found.line, fileLine);
  const drawn = outcome.lines.filter(line => line.text.trim() !== '');
  assert.notEqual(found.line, drawn.indexOf(found) + 1);
  const blank = outcome.lines.find(line => line.line === fileLine - 1);
  assert.ok(blank);
  assert.equal(blank.text, '');
  rmSync(dir, {recursive: true, force: true});
});

test('a removed scenario does not name the capability', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'spine-'));
  const checkout = path.join(dir, 'service');
  const change = path.join(checkout, changeDir('1'));
  mkdirSync(path.join(change, 'specs', 'case-read'), {recursive: true});
  mkdirSync(path.join(checkout, 'openspec', 'specs', 'case-read'), {recursive: true});
  writeFileSync(
    path.join(checkout, 'openspec', 'specs', 'case-read', 'spec.md'),
    '### Requirement: Чтение\n\nКейс читается.\n\n#### Scenario: Удалённый сценарий\n',
  );
  writeFileSync(
    path.join(change, 'specs', 'case-read', 'spec.md'),
    [
      '## REMOVED Requirements',
      '',
      '### Requirement: Чтение',
      '',
      '#### Scenario: Удалённый сценарий',
      '',
      '## ADDED Requirements',
      '',
      '### Requirement: Запись',
      '',
      '#### Scenario: Новый сценарий',
      '',
    ].join('\n'),
  );
  writeFileSync(
    path.join(change, 'tasks.md'),
    ['- [ ] `gone` — «Удалённый сценарий»', '- [ ] `kept` — «Новый сценарий»', ''].join('\n'),
  );
  const spine = buildSpine({key: '1', checkout, station: 'tasking'});
  assert.equal(spine.tasks.find(task => task.id === 'gone')?.scenarios[0]?.capability, '');
  assert.equal(spine.tasks.find(task => task.id === 'kept')?.scenarios[0]?.capability, 'case-read');
  rmSync(dir, {recursive: true, force: true});
});

test('the spine is a projection of the branch read', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'spine-'));
  const checkout = path.join(dir, 'service');
  const change = path.join(checkout, changeDir('1'));
  mkdirSync(path.join(change, 'specs', 'case-read'), {recursive: true});
  mkdirSync(path.join(checkout, 'openspec', 'specs', 'case-read'), {recursive: true});
  writeFileSync(
    path.join(change, 'proposal.md'),
    ['# Change', '', '## Outcome', '', 'Итог одного чтения.', '', '## Capabilities', '', '### Modified', '', '- case-read', ''].join('\n'),
  );
  writeFileSync(path.join(checkout, 'openspec', 'specs', 'case-read', 'spec.md'), '### Requirement: Чтение\n\nБыло.\n');
  writeFileSync(
    path.join(change, 'specs', 'case-read', 'spec.md'),
    '## MODIFIED Requirements\n\n### Requirement: Чтение\n\nСтало.\n',
  );
  const read = readBranch('1', changeFiles(checkout, '1'));
  const projected = projectSpine(read.text, {
    key: '1',
    station: 'specifying',
    issueBody: '<!-- sdd:begin -->\nPlan: из задачи\n<!-- sdd:end -->',
    diff: true,
  });
  const built = buildSpine({
    key: '1',
    checkout,
    station: 'specifying',
    issueBody: '<!-- sdd:begin -->\nPlan: из задачи\n<!-- sdd:end -->',
    diff: true,
  });
  assert.equal(read.facts.fingerprint.length > 0, true);
  assert.equal(read.text.baselines.includes('case-read'), true);
  assert.deepEqual(projected, built);
  rmSync(dir, {recursive: true, force: true});
});
const DESIGN_PATH = 'openspec/changes/issue-1/design.md';

spec('spine', () => {
  requirement('The spine lists the document rows', () => {
    scenario('Change bodies stay out', () => {
      proveAnOpenCycleWhoseOnlySidebarBlockIsFocusShowsThatBlock113();
    });

    scenario('The Change row stays out', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing')]},
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const side = bandOf(await pageHtml(page.url), '1');
          assert.equal(side.includes('id="spine-Change"'), false);
          assert.equal(side.includes('Двери читают'), false);
          const planPick = side.match(/id="spine-Plan"[^>]*/)?.[0] ?? '';
          assert.equal(planPick.includes('checked'), false);
        },
      );
    });
  });
  requirement('A document row keeps its focus sentence', () => {
    scenario('A solid sentence stays off the row', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [
            held('1', 'specifying', {
              comments: [{body: 'sdd:focus\nPlan solid\nSpecify thread 4\nCode solid\n'}],
            }),
          ],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          const planHead = spineOf(html, '1', 'Plan').split('<div class="fold">')[0] ?? '';
          const specifyHead = spineOf(html, '1', 'Specify').split('<div class="fold">')[0] ?? '';
          const codeHead = spineOf(html, '1', 'Code').split('<div class="fold">')[0] ?? '';
          assert.equal(planHead.includes('class="sentence"'), false);
          assert.equal(planHead.includes('solid'), false);
          assert.match(specifyHead, /<span class="sentence">thread 4<\/span>/);
          assert.equal(codeHead.includes('class="sentence"'), false);
          assert.equal(codeHead.includes('solid'), false);
        },
      );
    });
  });
  requirement('A row opens only when it has a fold', () => {
    scenario('An empty row stays closed', async () => {
      const quiet = {getAttribute: (name: string) => (name === 'class' ? 'is-quiet' : null)};
      const openRow = {getAttribute: () => null};
      assert.equal(rowHeadOpens(quiet), false);
      assert.equal(rowHeadOpens(openRow), true);
      assert.equal(rowHeadOpens(null), false);
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing')]},
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          const plan = spineOf(html, '1', 'Plan');
          assert.match(plan, /<section class="is-quiet">/);
          assert.equal(/id="spine-Plan"[^>]*checked/.test(plan), false);
          assert.equal(plan.includes('for="spine-Plan"'), false);
          assert.match(
            html,
            /\.spine > section\.is-quiet \.row,\s*\.spine > section\.is-quiet \.layer,\s*\.spine > section\.is-quiet \.rest\s*\{[^}]*cursor:\s*default/,
          );
        },
      );
    });
    scenario('The row head toggles outside its control', async () => {
      const label = {closest: (selector: string) => (selector === 'label' ? label : null)};
      const acts = {closest: (selector: string) => (selector === '.acts' ? acts : null)};
      assert.equal(headClickToggles(label), false);
      assert.equal(headClickToggles(acts), false);
      assert.equal(headClickToggles({closest: () => null}), true);
      assert.equal(headClickToggles(null), false);
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing')]},
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          assert.match(html, /\.spine \.row\s*\{[^}]*cursor:\s*pointer/);
          assert.match(html, /\.spine \.layer\s*\{[^}]*display:\s*flex[^}]*align-items:\s*center/);
        },
      );
    });
    scenario('The open row head sticks', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing')]},
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          assert.match(
            html,
            /\.spine > section:has\(\.spine-pick:checked\) \.row\s*\{[^}]*position:\s*sticky[^}]*top:\s*0[^}]*width:\s*auto[^}]*max-width:\s*none/,
          );
          assert.match(html, /<div class="side-scroll">/);
          assert.equal(bandOf(html, '1').includes('class="top"'), false);
          assert.match(html, /\.spine \.lead\s*\{[^}]*padding:\s*0/);
        },
      );
    });
    scenario('A second click closes the open row', () => {
      const opened = {key: '1', station: 'proposing', open: 'Plan' as const};
      assert.equal(keptSpineLayer({key: '1', station: 'proposing', layer: 'Plan'}, opened), 'Plan');
      assert.equal(toggledSpineLayer('Plan', 'Plan'), '');
      assert.equal(
        keptSpineLayer({key: '1', station: 'proposing', layer: ''}, opened),
        '',
      );
      assert.equal(toggledSpineLayer('', 'Specify'), 'Specify');
      assert.equal(
        keptSpineLayer({key: '1', station: 'proposing', layer: 'Specify'}, opened),
        'Specify',
      );
      assert.equal(
        keptSpineLayer(
          {key: '1', station: 'proposing', layer: ''},
          {key: '1', station: 'specifying', open: 'Specify'},
        ),
        'Specify',
      );
    });
  });
  requirement('A document row shows its file', () => {
    scenario('The Plan row shows the outcome', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'verifying')]},
        async (page, window, paths) => {
          writeChange(
            paths.arcadia,
            '1',
            'proposal.md',
            '## Outcome\n\nГодность или список проблем.\n\n## Open questions\n\n- [ ] Писать ли имя проверки?\n',
          );
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          const side = bandOf(html, '1');
          assert.match(side, /id="spine-Plan"/);
          assert.match(side, /Годность или список проблем/);
          assert.match(side, /- \[ \] Писать ли имя проверки\?/);
          const codePick = side.match(/id="spine-Code"[^>]*/)?.[0] ?? '';
          assert.equal(codePick.includes('checked'), false);
          assert.equal(
            window.sidebar().some(block => JSON.stringify(block).includes('Годность')),
            false,
          );
        },
      );
    });
    scenario('The Plan row shows every section', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing')]},
        async (page, window, paths) => {
          writeChange(
            paths.arcadia,
            '1',
            'proposal.md',
            [
              '## Scope',
              '',
              'Сайдбар читает план целиком.',
              '',
              'Второй абзац scope остаётся.',
              '',
              '## Out of scope',
              '',
              'Другие слои.',
              '',
            ].join('\n'),
          );
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const side = bandOf(await pageHtml(page.url), '1');
          assert.match(side, /<h3>Scope<\/h3>/);
          assert.match(side, /Сайдбар читает план целиком\./);
          assert.match(side, /Второй абзац scope остаётся\./);
          assert.match(side, /<h3>Out of scope<\/h3>/);
          assert.match(side, /Другие слои\./);
        },
      );
    });
    scenario('A collapsed Plan row shows one outcome line', async () => {
      const proposal = '## Outcome\n\nПервая строка исхода.\n\nВторая строка исхода.\n';
      const focus = {
        comments: [{body: 'sdd:focus\nPlan: Первая строка исхода.\nSpecify: Границы.\n'}],
      };
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'verifying', focus)]},
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'proposal.md', proposal);
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          const side = bandOf(html, '1');
          const planPick = side.match(/id="spine-Plan"[^>]*/)?.[0] ?? '';
          assert.equal(planPick.includes('checked'), false);
          const planHead = spineOf(html, '1', 'Plan').split('<div class="fold">')[0] ?? '';
          assert.match(planHead, /<span class="excerpt">Первая строка исхода\.<\/span>/);
          assert.equal(planHead.includes('class="sentence"'), false);
          assert.equal(planHead.split('Первая строка исхода.').length, 2);
          const specifyHead = spineOf(html, '1', 'Specify').split('<div class="fold">')[0] ?? '';
          assert.match(specifyHead, /<span class="sentence">Границы\.<\/span>/);
          assert.equal(side.includes('<span class="excerpt">Первая строка исхода. Вторая'), false);
          assert.match(side, /Вторая строка исхода\./);
          assert.match(html, /\.spine \.row\s*\{[^}]*align-items:\s*stretch[^}]*max-width:\s*100%/);
          assert.match(html, /\.spine \.excerpt\s*\{[^}]*text-overflow:\s*ellipsis/);
          assert.match(
            html,
            /\.spine > section:has\(\.spine-pick:checked\) \.excerpt\s*\{[^}]*display:\s*none/,
          );
        },
      );
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing', focus)]},
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'proposal.md', proposal);
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const planHead =
            spineOf(await pageHtml(page.url), '1', 'Plan').split(
              '<div class="fold">',
            )[0] ?? '';
          assert.match(planHead, /id="spine-Plan"[^>]*checked/);
          assert.equal(planHead.includes('class="sentence"'), false);
          assert.match(planHead, /<span class="excerpt">Первая строка исхода\.<\/span>/);
        },
      );
    });
    scenario('An empty plan section stays out', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing')]},
        async (page, window, paths) => {
          writeChange(
            paths.arcadia,
            '1',
            'proposal.md',
            '## Scope\n\nСайдбар.\n\n## Constraints\n\n',
          );
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const side = bandOf(await pageHtml(page.url), '1');
          assert.match(side, /<h3>Scope<\/h3>/);
          assert.match(side, /Сайдбар\./);
          assert.equal(side.includes('<h3>Constraints</h3>'), false);
        },
      );
    });
    scenario('Added and Modified are headings', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing')]},
        async (page, window, paths) => {
          writeChange(
            paths.arcadia,
            '1',
            'proposal.md',
            '## Capabilities\n\n### Added\n\n- sidebar План целиком.\n\n### Modified\n\n- board Колонки.\n',
          );
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const side = bandOf(await pageHtml(page.url), '1');
          assert.match(side, /<h4>Added<\/h4>/);
          assert.match(side, /<h4>Modified<\/h4>/);
          assert.equal(side.includes('### Added'), false);
          assert.equal(side.includes('### Modified'), false);
          assert.match(side, /sidebar План целиком\./);
          assert.match(side, /board Колонки\./);
        },
      );
    });
    scenario('An empty Open questions section stays out', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing')]},
        async (page, window, paths) => {
          writeChange(
            paths.arcadia,
            '1',
            'proposal.md',
            '## Outcome\n\nГодность.\n\n## Open questions\n\n',
          );
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const side = bandOf(await pageHtml(page.url), '1');
          assert.match(side, /Годность\./);
          assert.equal(side.includes('Open questions'), false);
        },
      );
    });
    scenario('An open question holds the plan', async () => {
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
          const side = bandOf(await pageHtml(page.url), '1');
          assert.match(side, /План принимается, когда открытых вопросов не останется\./);
          assert.match(side, /data-question="Писать ли имя проверки\?"/);
        },
      );
    });
    scenario('The Design row shows every section', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'designing')]},
        async (page, window, paths) => {
          writeChange(
            paths.arcadia,
            '1',
            'design.md',
            [
              'До секции.',
              '',
              '## Verification boundary',
              '',
              'Одна проверка.',
              '',
              'Лишнее.',
              '',
              '## Approach',
              '',
              'Один модуль.',
              '',
              '## Notes',
              '',
              'Не показывать.',
              '',
              'Отклонено: второй модуль.',
              '',
              '## Open decisions',
              '',
              '- [ ] имя',
              '',
            ].join('\n'),
          );
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const side = bandOf(await pageHtml(page.url), '1');
          assert.match(side, /Одна проверка/);
          assert.match(side, /Лишнее/);
          assert.match(side, /Один модуль/);
          assert.match(side, /Не показывать/);
          assert.match(side, /Отклонено: второй модуль/);
          assert.match(side, /- \[ \] имя/);
          assert.equal(side.includes('До секции.'), false);
          assert.match(side, /<p class="line"/);
          assert.equal(side.includes(`data-path="${DESIGN_PATH}"`), false);
        },
      );
    });
    scenario('The Code row shows that a diff is present', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'verifying', {diff: true})]},
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const side = bandOf(await pageHtml(page.url), '1');
          assert.match(side, /Diff есть/);
          assert.equal(side.includes('class="path"'), false);
          assert.equal(side.includes('diff --git'), false);
        },
      );
    });
    scenario('No reported check is named', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'verifying', {checks: 'none', openPullRequests: 1})],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const side = bandOf(await pageHtml(page.url), '1');
          assert.match(side, /проверок нет/);
        },
      );
    });
    scenario('An open task shows its file', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'tasking')]},
        async (page, window, paths) => {
          writeChange(
            paths.arcadia,
            '1',
            'tasks.md',
            '- [ ] `read-case` — The row shows the section; A second phrase\n',
          );
          writeChange(
            paths.arcadia,
            '1',
            'tasks/read-case.md',
            ['## Source', '', 'Меняется только чтение.', '', '## Proof', '', 'Команда одна.', ''].join(
              '\n',
            ),
          );
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const side = bandOf(await pageHtml(page.url), '1');
          assert.match(side, /The row shows the section/);
          assert.match(side, /A second phrase/);
          assert.match(side, /Меняется только чтение/);
          assert.match(side, /Команда одна/);
          assert.match(side, /<span class="state">открыто<\/span>/);
        },
      );
    });
    scenario('The open mark is a short chip', () => {
      const css = readFileSync(new URL('./face.css', import.meta.url), 'utf8');
      assert.match(css, /\.spine \.fold > \.task:first-child \{[^}]*border-top:\s*0/);
      assert.match(css, /\.spine \.task \.state \{[^}]*border-radius:\s*\d+px/);
      assert.match(css, /\.spine \.task \.state \{[^}]*background:/);
      assert.doesNotMatch(css, /\.spine \.task \.state \{[^}]*border-radius:\s*999px/);
    });
    scenario('An archived proposal shows on the Plan row', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'accepting', {openPullRequests: 1})]},
        async (page, window, paths) => {
          const file = path.join(
            paths.arcadia,
            'services',
            'billing',
            'openspec',
            'changes',
            'archive',
            'issue-1',
            'proposal.md',
          );
          mkdirSync(path.dirname(file), {recursive: true});
          writeFileSync(file, '## Outcome\n\nИз архива.\n');
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const side = bandOf(await pageHtml(page.url), '1');
          assert.match(side, /Из архива/);
          assert.match(side, /data-path="openspec\/changes\/archive\/issue-1\/proposal.md"/);
        },
      );
    });
    scenario('The Plan row reads the issue branch', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing')]},
        async (page, window, paths) => {
          const checkout = path.join(paths.arcadia, 'services', 'billing');
          git(checkout, ['init', '-b', 'master']);
          git(checkout, ['config', 'user.email', 'test@example.com']);
          git(checkout, ['config', 'user.name', 'Test']);
          git(checkout, ['add', 'openspec']);
          git(checkout, ['commit', '-m', 'init']);
          git(checkout, ['checkout', '-b', 'sdd/1']);
          writeChange(paths.arcadia, '1', 'proposal.md', '## Outcome\n\nС ветки тикета.\n');
          git(checkout, ['add', 'openspec']);
          git(checkout, ['commit', '-m', 'plan']);
          git(checkout, ['checkout', 'master']);
          writeChange(paths.arcadia, '1', 'proposal.md', '## Outcome\n\nС рабочего дерева.\n');
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const side = bandOf(await pageHtml(page.url), '1');
          assert.match(side, /id="spine-Plan"/);
          assert.match(side, /С ветки тикета/);
          assert.equal(side.includes('С рабочего дерева'), false);
        },
      );
    });
    scenario('An answer is a review comment', async () => {
      const comments: string[] = [];
      const tickets = [held('1', 'verifying', {openPullRequests: 1})];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => tickets,
          commentPull: (_key, body) => {
            comments.push(body);
          },
        },
        async (page, window, paths) => {
          const file = path.join(
            paths.arcadia,
            'services',
            'billing',
            changeDir('1'),
            'proposal.md',
          );
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
          const empty = await post(
            page.url,
            'act',
            new URLSearchParams({
              act: 'answer',
              key: '1',
              question: 'Писать ли имя проверки?',
              reply: '   ',
            }).toString(),
          );
          assert.equal(empty.status, 200);
          assert.match(statusOf(shown(empty.body)), /Ответ пустой/);
          assert.equal((await pageHtml(page.url)).includes('role="status"'), false);
          assert.equal(
            (
              await post(
                page.url,
                'act',
                new URLSearchParams({
                  act: 'answer',
                  key: '1',
                  question: 'Писать ли имя проверки?',
                  reply: 'Да, короткое имя.',
                }).toString(),
              )
            ).status,
            200,
          );
          assert.deepEqual(comments, ['- [ ] Писать ли имя проверки?\n\nДа, короткое имя.']);
          assert.match(readFileSync(file, 'utf8'), /- \[ \] Писать ли имя проверки\?/);
          assert.equal((await pageHtml(page.url)).includes('role="status"'), false);
        },
      );
    });
  });
});

function takenCycleIssueBody(): string {
  return [
    'Author text belongs in the pool description block only.',
    '<!-- sdd:begin -->',
    'Plan: Mirror-driven plan for a taken cycle',
    'Specify: Capabilities from the mirror',
    'Tasks: 3/4',
    '<!-- sdd:end -->',
  ].join('\n');
}

function proveTheSpineOfATakenCycleStaysAsItIs(): void {
  const issueBody = takenCycleIssueBody();
  const author = 'Author text belongs in the pool description block only.';
  const mirrorOnly = issueBody.slice(issueBody.indexOf('<!-- sdd:begin -->'));
  const baseline = buildSpine({
    key: '33',
    station: 'implementing',
    issueBody: mirrorOnly,
  });
  const spine = buildSpine({
    key: '33',
    station: 'implementing',
    issueBody,
  });
  assert.deepEqual(spine.lines, baseline.lines);
  assert.equal(spine.lines.find(line => line.layer === 'Plan')?.text, 'Mirror-driven plan for a taken cycle');
  assert.equal(spine.lines.find(line => line.layer === 'Specify')?.text, 'Capabilities from the mirror');
  assert.equal(spine.lines.find(line => line.layer === 'Tasks')?.text, '3/4');
  assert.equal(spine.lines.some(line => line.text.includes(author)), false);
  assert.equal(linesFromIssue(issueBody).every(line => !line.text.includes(author)), true);
}

spec('issue-description', () => {
  requirement('A pool cycle shows its issue description in the sidebar', () => {
    scenario('The spine of a taken cycle stays as it is', () => {
      proveTheSpineOfATakenCycleStaysAsItIs();
    });
  });
});

function mirrorIssueBody(): string {
  return [
    '<!-- sdd:begin -->',
    'Plan: Mirror plan line.',
    'Specify: Mirror specify line.',
    'Design: Mirror design line.',
    'Tasks: 1/6',
    'Code: Mirror code line.',
    '<!-- sdd:end -->',
  ].join('\n');
}

function spineRowSentence(html: string, key: string, layer: string): string {
  const head = spineOf(html, key, layer).split('<div class="fold">')[0] ?? '';
  const sentence = head.match(/<span class="sentence">([^<]*)<\/span>/)?.[1];
  if (sentence) {
    return sentence;
  }
  const excerpt = head.match(/<span class="excerpt">([^<]*)<\/span>/)?.[1];
  return excerpt ?? '';
}

function focusPagerHtml(snapshot: WindowSnapshot, pageIndex: number): string {
  const opened = snapshot.opened;
  if (!opened) {
    return '';
  }
  return renderToStaticMarkup(
    createElement(FocusBlocks, {blocks: opened.blocks, pageIndex}),
  );
}

function proveEachSpineRowKeepsTheFirstSentenceOfTheLatestWrittenFocusOfThatPhase(): void {
  const issueBody = mirrorIssueBody();
  const comments = [
    {body: 'sdd:focus:plan\nOlder plan sentence. Older tail.\n'},
    {body: 'sdd:focus:plan\nLatest plan sentence. Latest tail.\n'},
    {body: 'sdd:focus:spec\nSpecify holds the boundary. More spec prose.\n'},
    {body: 'sdd:focus:design\nDesign is bounded. Extra design.\n'},
    {body: 'sdd:focus:tasks\nTasks are three of six. More tasks.\n'},
    {body: 'sdd:focus:code\nCode slice landed. More code.\n'},
    {body: 'sdd:focus:accept\nAccept gate is ready. Not a spine row.\n'},
    {body: 'sdd:focus\nPlan: Ledger plan must stay off rows.\nSpecify: Ledger specify.\n'},
  ];
  const {lines} = focusSpineLines(comments, issueBody);
  assert.equal(lines.find(line => line.layer === 'Plan')?.text, 'Latest plan sentence.');
  assert.equal(lines.find(line => line.layer === 'Specify')?.text, 'Specify holds the boundary.');
  assert.equal(lines.find(line => line.layer === 'Design')?.text, 'Design is bounded.');
  assert.equal(lines.find(line => line.layer === 'Tasks')?.text, 'Tasks are three of six.');
  assert.equal(lines.find(line => line.layer === 'Code')?.text, 'Code slice landed.');
  assert.equal(lines.some(line => line.text.includes('Ledger')), false);
  assert.equal(lines.some(line => line.text.includes('Accept gate')), false);
}

spec('written-focus-page', () => {
  requirement(
    'Each spine row keeps the first sentence of the latest written focus of that phase',
    () => {
      scenario(
        'Each spine row keeps the first sentence of the latest written focus of that phase',
        async () => {
          proveEachSpineRowKeepsTheFirstSentenceOfTheLatestWrittenFocusOfThatPhase();
          await hosted(
            {
              login: () => MANAGER,
              tickets: () => [
                held('1', 'implementing', {
                  body: mirrorIssueBody(),
                  comments: [
                    {body: 'sdd:focus:plan\nOlder plan sentence. Older tail.\n'},
                    {body: 'sdd:focus:plan\nLatest plan sentence. Latest tail.\n'},
                    {body: 'sdd:focus:spec\nSpecify holds the boundary. More spec prose.\n'},
                    {body: 'sdd:focus:design\nDesign is bounded. Extra design.\n'},
                    {body: 'sdd:focus:tasks\nTasks are three of six. More tasks.\n'},
                    {body: 'sdd:focus:code\nCode slice landed. More code.\n'},
                    {body: 'sdd:focus\nPlan: Ledger plan must stay off rows.\n'},
                  ],
                }),
              ],
            },
            async (page, window) => {
              window.chooseAgent('cursor');
              assert.equal(
                (
                  await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString())
                ).status,
                200,
              );
              const snapshot = (await (
                await fetch(new URL('/snapshot', page.url))
              ).json()) as WindowSnapshot;
              const spineLines = snapshot.opened?.spine.lines ?? [];
              assert.equal(
                spineLines.find(line => line.layer === 'Plan')?.text,
                'Latest plan sentence.',
              );
              assert.equal(
                spineLines.find(line => line.layer === 'Specify')?.text,
                'Specify holds the boundary.',
              );
              assert.equal(
                spineLines.find(line => line.layer === 'Design')?.text,
                'Design is bounded.',
              );
              assert.equal(
                spineLines.find(line => line.layer === 'Tasks')?.text,
                'Tasks are three of six.',
              );
              assert.equal(
                spineLines.find(line => line.layer === 'Code')?.text,
                'Code slice landed.',
              );
              const html = await pageHtml(page.url);
              assert.equal(spineRowSentence(html, '1', 'Plan'), 'Latest plan sentence.');
              const onOlderPlan = focusPagerHtml(snapshot, 6);
              assert.match(onOlderPlan, />sdd:focus:plan</);
              assert.match(onOlderPlan, /Older plan sentence\./);
              assert.match(onOlderPlan, /Older tail\./);
              assert.equal(spineRowSentence(html, '1', 'Plan'), 'Latest plan sentence.');
            },
          );
        },
      );
    },
  );
});
