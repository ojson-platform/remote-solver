import type {SpecEntry, SpecGap, SpecRow} from './spec-diff.ts';

import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {requirement, scenario, spec} from '@ojson/spec-coverage';
import {test} from 'vitest';

import {gitFiles} from '../adapters/vcs.ts';
import {specDiff, unchangedLabel} from './spec-diff.ts';
import {buildSpine} from './spine.ts';
import {arcanumOpenThread} from '../adapters/arcanum.ts';
import {activeDiff, changelist, fakeHttp, specPath} from '../adapters/arcanum.harness.ts';
import {githubAdapters} from '../adapters/github.ts';
import {capIsOpen, foldsAfterSpec, revealFold, scenarioTarget} from './client/gesture.ts';
import {renderWindow} from './client/render.ts';
import {
  MANAGER,
  held,
  hosted,
  pageHtml,
  post,
  readSnapshot,
  spineOf,
  statusOf,
  writeChange,
} from './page.harness.ts';
import type {WindowSnapshot} from './snapshot.ts';
import {openWindow} from './window.ts';

const deltaPath = 'openspec/changes/issue-1/specs/case-read/spec.md';

const readingBaseline = '### Requirement: Чтение\n\nКейс читается по идентификатору.\n';

const readingDelta = [
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
].join('\n');

function text(lines: string[]): string {
  return `${lines.join('\n')}\n`;
}

function fileLine(source: string, needle: string): number {
  const lines = source.split('\n');
  const exact = lines.findIndex(line => line === needle);
  const index = exact === -1 ? lines.findIndex(line => line.includes(needle)) : exact;
  assert.notEqual(index, -1);
  return index + 1;
}

function isRow(entry: SpecEntry): entry is SpecRow {
  return entry.kind !== 'gap';
}

function rowsOf(entries: readonly SpecEntry[]): SpecRow[] {
  return entries.filter(isRow);
}

function allRows(entries: readonly SpecEntry[]): SpecRow[] {
  const found: SpecRow[] = [];
  for (const entry of entries) {
    if (entry.kind === 'gap') {
      found.push(...entry.hidden);
      continue;
    }
    found.push(entry);
  }
  return found;
}

function gapsOf(entries: readonly SpecEntry[]): SpecGap[] {
  return entries.filter((entry): entry is SpecGap => entry.kind === 'gap');
}

test('a modified reading sentence is anchored to the delta file', () => {
  const got = specDiff(readingBaseline, readingDelta, deltaPath);
  const rows = rowsOf(got.rows);
  const phrase = 'Проверка отсутствующего кейса не находит его.';
  const green = rows.find(row => row.kind === 'add' && row.text.includes(phrase));
  const header = rows.find(row => row.kind === 'ctx' && row.text === '### Requirement: Чтение');
  const red = rows.find(
    row => row.kind === 'del' && row.text === 'Кейс читается по идентификатору.',
  );
  assert.ok(green);
  assert.equal(green.anchor?.path, deltaPath);
  assert.equal(green.anchor?.side, 'right');
  assert.equal(green.anchor?.line, fileLine(readingDelta, phrase));
  assert.notEqual(green.anchor?.line, green.right);
  assert.equal(green.left, undefined);
  assert.ok(header);
  assert.equal(header.anchor?.line, fileLine(readingDelta, '### Requirement: Чтение'));
  assert.equal(header.anchor?.side, 'right');
  assert.notEqual(header.anchor?.line, header.right);
  assert.ok(red);
  assert.equal(red.anchor, undefined);
  assert.equal(red.right, undefined);
  assert.equal(typeof red.left, 'number');
  assert.equal(
    rows.some(row => row.text.includes('## MODIFIED Requirements')),
    false,
  );
});

test('a modified name missing from the baseline is appended', () => {
  const baseline = text([
    '## Purpose',
    '',
    'Цель.',
    '',
    '## Requirements',
    '',
    '### Requirement: Есть',
    '',
    'Текст.',
  ]);
  const delta = text([
    '## MODIFIED Requirements',
    '',
    '### Requirement: Чужая',
    '',
    'Приписанный текст.',
  ]);
  const got = specDiff(baseline, delta, deltaPath);
  const rows = rowsOf(got.rows);
  assert.equal(got.badge, 'changed');
  assert.equal(
    rows.some(row => row.text === '### Requirement: Чужая'),
    true,
  );
  assert.equal(
    rows.some(row => row.text === 'Приписанный текст.'),
    true,
  );
  const purpose = allRows(got.rows).find(row => row.text === 'Цель.');
  assert.equal(purpose?.kind, 'ctx');
  assert.equal(purpose?.anchor, undefined);
});

test('an added requirement follows the existing one and purpose has no anchor', () => {
  const baseline = text([
    '## Purpose',
    '',
    'Зачем.',
    '',
    '## Requirements',
    '',
    '### Requirement: Есть',
    '',
    'Текст.',
    '',
    '## Notes',
    '',
    'Хвост.',
  ]);
  const delta = text([
    '## ADDED Requirements',
    '',
    '### Requirement: Есть',
    '',
    'Повтор не заменяет.',
    '',
    '### Requirement: Новое',
    '',
    'Дописано.',
  ]);
  const got = specDiff(baseline, delta, deltaPath);
  const rows = rowsOf(got.rows);
  const order = rows.map(row => row.text);
  const existing = order.indexOf('Текст.');
  const duplicate = order.indexOf('Повтор не заменяет.');
  const added = order.indexOf('### Requirement: Новое');
  const notes = order.indexOf('## Notes');
  assert.ok(existing < duplicate);
  assert.ok(duplicate < added);
  assert.ok(added < notes);
  const purpose = allRows(got.rows).find(row => row.text === 'Зачем.');
  assert.equal(purpose?.kind, 'ctx');
  assert.equal(purpose?.anchor, undefined);
  assert.equal(typeof purpose?.left, 'number');
  assert.equal(typeof purpose?.right, 'number');
  const headers = allRows(got.rows).filter(row => row.text === '### Requirement: Есть');
  assert.equal(headers[0]?.kind, 'ctx');
  assert.equal(headers[0]?.anchor, undefined);
  assert.equal(headers[1]?.kind, 'add');
  assert.equal(rows.find(row => row.text === 'Текст.')?.kind, 'ctx');
  const fresh = rows.find(row => row.text === 'Дописано.');
  assert.equal(fresh?.kind, 'add');
  assert.equal(fresh?.anchor?.side, 'right');
  assert.equal(fresh?.anchor?.line, fileLine(delta, 'Дописано.'));
});

test('removed names from a header and a bullet leave purpose and drop anchors', () => {
  const baseline = text([
    '## Purpose',
    '',
    'Цель.',
    '',
    '## Requirements',
    '',
    '### Requirement: Первый',
    '',
    'Тело первого.',
    '',
    '### Requirement: Второй',
    '',
    'Тело второго.',
    '',
    '### Requirement: Третий',
    '',
    'Тело третьего.',
  ]);
  const delta = text([
    '## REMOVED Requirements',
    '',
    '### Requirement: `Первый`',
    '',
    'Тело секции не копируется.',
    '',
    '- `Второй`',
  ]);
  const got = specDiff(baseline, delta, deltaPath);
  const rows = rowsOf(got.rows);
  assert.equal(got.badge, 'changed');
  const purpose = allRows(got.rows).find(row => row.text === 'Цель.');
  assert.equal(purpose?.kind, 'ctx');
  assert.equal(purpose?.anchor, undefined);
  for (const line of ['### Requirement: Первый', 'Тело первого.', 'Тело второго.']) {
    const red = rows.find(row => row.text === line);
    assert.equal(red?.kind, 'del');
    assert.equal(red?.anchor, undefined);
    assert.equal(red?.right, undefined);
    assert.equal(typeof red?.left, 'number');
  }
  assert.equal(
    rows.some(row => row.text.includes('Тело секции не копируется.')),
    false,
  );
  assert.equal(rows.find(row => row.text === 'Тело третьего.')?.kind, 'ctx');
});

test('a rename then a modify replaces the renamed block', () => {
  const baseline = text(['### Requirement: СтароеИмя', '', 'Старое тело.']);
  const delta = text([
    '## RENAMED Requirements',
    '',
    '- FROM: `### Requirement: СтароеИмя`',
    '- TO: `### Requirement: НовоеИмя`',
    '',
    '## MODIFIED Requirements',
    '',
    '### Requirement: НовоеИмя',
    '',
    'Новое тело.',
  ]);
  const got = specDiff(baseline, delta, deltaPath);
  const rows = rowsOf(got.rows);
  const kept = rows.filter(row => row.kind !== 'del');
  assert.equal(
    kept.some(row => row.text.includes('СтароеИмя')),
    false,
  );
  assert.equal(
    kept.some(row => row.text.includes('Старое тело.')),
    false,
  );
  const header = rows.find(row => row.text === '### Requirement: НовоеИмя');
  const body = rows.find(row => row.text === 'Новое тело.');
  assert.equal(header?.kind, 'add');
  assert.equal(body?.kind, 'add');
  assert.equal(header?.anchor?.line, fileLine(delta, '### Requirement: НовоеИмя'));
  assert.equal(body?.anchor?.line, fileLine(delta, 'Новое тело.'));
  assert.equal(
    rows.some(row => row.anchor?.line === fileLine(delta, '- TO:')),
    false,
  );
});

test('a rename of a missing requirement adds nothing', () => {
  const baseline = text(['### Requirement: Есть', '', 'Текст.']);
  const delta = text([
    '## RENAMED Requirements',
    '',
    '- FROM: `### Requirement: Нет такого`',
    '- TO: `### Requirement: НовоеИмя`',
  ]);
  const got = specDiff(baseline, delta, deltaPath);
  const rows = rowsOf(got.rows);
  assert.equal(got.badge, undefined);
  assert.equal(
    rows.some(row => row.text.includes('НовоеИмя')),
    false,
  );
  assert.deepEqual(
    rows.map(row => row.text),
    ['### Requirement: Есть', '', 'Текст.'],
  );
  assert.ok(rows.every(row => row.kind === 'ctx'));
});

test('a rename alone anchors the new header on the TO line', () => {
  const baseline = text(['### Requirement: СтароеИмя', '', 'Тело остаётся.']);
  const delta = text([
    '## RENAMED Requirements',
    '',
    '- FROM: `### Requirement: СтароеИмя`',
    '- TO: `### Requirement: НовоеИмя`',
  ]);
  const got = specDiff(baseline, delta, deltaPath);
  const rows = rowsOf(got.rows);
  const header = rows.find(row => row.text === '### Requirement: НовоеИмя');
  const body = rows.find(row => row.text === 'Тело остаётся.');
  assert.equal(header?.kind, 'add');
  assert.equal(header?.anchor?.path, deltaPath);
  assert.equal(header?.anchor?.side, 'right');
  assert.equal(header?.anchor?.line, fileLine(delta, '- TO:'));
  assert.notEqual(header?.anchor?.line, header?.right);
  assert.equal(body?.kind, 'ctx');
  assert.equal(body?.anchor, undefined);
});

test('an empty baseline with a result is entirely new', () => {
  const body = Array.from({length: 8}, (_, index) => `строка ${index + 1}`);
  const delta = text(['## MODIFIED Requirements', '', '### Requirement: Чужая', '', ...body]);
  const got = specDiff('', delta, deltaPath);
  assert.equal(got.badge, 'new');
  assert.equal(gapsOf(got.rows).length, 0);
  assert.ok(got.rows.length > 0);
  assert.ok(got.rows.every(row => row.kind === 'add'));
});

test('a baseline that disappears is entirely removed', () => {
  const body = Array.from({length: 8}, (_, index) => `строка ${index + 1}`);
  const baseline = text(['### Requirement: Один', '', ...body]);
  const delta = text(['## REMOVED Requirements', '', '- Один']);
  const got = specDiff(baseline, delta, deltaPath);
  assert.equal(got.badge, 'removed');
  assert.equal(gapsOf(got.rows).length, 0);
  assert.ok(got.rows.length > 0);
  assert.ok(got.rows.every(row => row.kind === 'del'));
});

test('identical text has no badge and only context rows', () => {
  const same = text(['## Purpose', '', 'Одинаково.']);
  const got = specDiff(same, same, deltaPath);
  assert.equal(got.badge, undefined);
  assert.equal(gapsOf(got.rows).length, 0);
  assert.deepEqual(
    rowsOf(got.rows).map(row => row.kind),
    ['ctx', 'ctx', 'ctx'],
  );
  assert.ok(rowsOf(got.rows).every(row => row.left !== undefined && row.right !== undefined));
  assert.ok(rowsOf(got.rows).every(row => row.anchor === undefined));
});

test('an identical modified block keeps anchors on context rows', () => {
  const baseline = readingBaseline;
  const delta = text([
    '## MODIFIED Requirements',
    '',
    '### Requirement: Чтение',
    '',
    'Кейс читается по идентификатору.',
  ]);
  const got = specDiff(baseline, delta, deltaPath);
  const header = rowsOf(got.rows).find(row => row.text === '### Requirement: Чтение');
  assert.equal(got.badge, undefined);
  assert.equal(header?.kind, 'ctx');
  assert.equal(header?.anchor?.line, fileLine(delta, '### Requirement: Чтение'));
  assert.equal(header?.anchor?.side, 'right');
  assert.notEqual(header?.anchor?.line, header?.right);
});

test('two empty texts have no badge and no rows', () => {
  const got = specDiff('', '', deltaPath);
  assert.equal(got.badge, undefined);
  assert.deepEqual(got.rows, []);
});

test('a purpose-only delta against an empty baseline is empty', () => {
  const got = specDiff('', '## Purpose\n\nНет требований.\n', deltaPath);
  assert.equal(got.badge, undefined);
  assert.deepEqual(got.rows, []);
});

test('ten shared lines between edits collapse to one gap of four', () => {
  const shared = Array.from({length: 10}, (_, index) => `общая ${index + 1}`);
  const baseline = text(['### Requirement: Середина', 'верх-было', ...shared, 'низ-было']);
  const delta = text([
    '## MODIFIED Requirements',
    '',
    '### Requirement: Середина',
    'верх-стало',
    ...shared,
    'низ-стало',
  ]);
  const got = specDiff(baseline, delta, deltaPath);
  const gaps = gapsOf(got.rows);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0]?.count, 4);
  assert.deepEqual(
    gaps[0]?.hidden.map(row => row.text),
    ['общая 4', 'общая 5', 'общая 6', 'общая 7'],
  );
  assert.ok(gaps[0]?.hidden.every(row => row.kind === 'ctx'));
});

test('six shared lines between edits stay visible', () => {
  const shared = Array.from({length: 6}, (_, index) => `общая ${index + 1}`);
  const baseline = text(['### Requirement: Середина', 'верх-было', ...shared, 'низ-было']);
  const delta = text([
    '## MODIFIED Requirements',
    '',
    '### Requirement: Середина',
    'верх-стало',
    ...shared,
    'низ-стало',
  ]);
  const got = specDiff(baseline, delta, deltaPath);
  assert.equal(gapsOf(got.rows).length, 0);
  const visible = rowsOf(got.rows).filter(row => shared.includes(row.text));
  assert.deepEqual(
    visible.map(row => row.text),
    shared,
  );
  assert.ok(visible.every(row => row.kind === 'ctx'));
});

test('eight shared lines before the first edit collapse to a gap of five', () => {
  const prefix = Array.from({length: 8}, (_, index) => `до ${index + 1}`);
  const baseline = text([...prefix, '### Requirement: СтароеИмя']);
  const delta = text([
    '## RENAMED Requirements',
    '',
    '- FROM: `### Requirement: СтароеИмя`',
    '- TO: `### Requirement: НовоеИмя`',
  ]);
  const got = specDiff(baseline, delta, deltaPath);
  const gaps = gapsOf(got.rows);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0]?.count, 5);
  assert.deepEqual(
    gaps[0]?.hidden.map(row => row.text),
    ['до 1', 'до 2', 'до 3', 'до 4', 'до 5'],
  );
  assert.deepEqual(
    rowsOf(got.rows)
      .filter(row => row.kind === 'ctx')
      .map(row => row.text),
    ['до 6', 'до 7', 'до 8'],
  );
});

test('a change in a later scenario keeps the requirement heading and folds what precedes it', () => {
  const lines = [
    '### Requirement: Чтение',
    'Тело требования.',
    '#### Scenario: Первый',
    '- **WHEN** первый',
    '- **THEN** первый',
    '#### Scenario: Второй',
    '- **WHEN** второй',
    '- **THEN** было',
  ];
  const baseline = text(lines);
  const delta = text([
    '## MODIFIED Requirements',
    '',
    ...lines.slice(0, -1),
    '- **THEN** стало',
  ]);
  const got = specDiff(baseline, delta, deltaPath);
  const visible = rowsOf(got.rows).map(row => row.text);
  assert.deepEqual(visible, [
    '### Requirement: Чтение',
    '#### Scenario: Второй',
    '- **WHEN** второй',
    '- **THEN** было',
    '- **THEN** стало',
  ]);
  const gaps = gapsOf(got.rows);
  assert.equal(gaps.length, 1);
  assert.deepEqual(
    gaps[0]?.hidden.map(row => row.text),
    ['Тело требования.', '#### Scenario: Первый', '- **WHEN** первый', '- **THEN** первый'],
  );
});

test('a red line paired with a green line carries word bits', () => {
  const baseline = text(['### Requirement: Слова', '', 'альфа бета']);
  const delta = text(['## MODIFIED Requirements', '', '### Requirement: Слова', '', 'альфа гамма']);
  const got = specDiff(baseline, delta, deltaPath);
  const red = rowsOf(got.rows).find(row => row.kind === 'del');
  const green = rowsOf(got.rows).find(row => row.kind === 'add');
  assert.equal(red?.text, 'альфа бета');
  assert.equal(green?.text, 'альфа гамма');
  assert.equal(red?.bits?.map(bit => bit.text).join(''), red?.text);
  assert.equal(green?.bits?.map(bit => bit.text).join(''), green?.text);
  assert.deepEqual(
    red?.bits?.find(bit => bit.text === 'альфа'),
    {text: 'альфа', changed: false},
  );
  assert.deepEqual(
    red?.bits?.find(bit => bit.text === 'бета'),
    {text: 'бета', changed: true},
  );
  assert.deepEqual(
    green?.bits?.find(bit => bit.text === 'гамма'),
    {text: 'гамма', changed: true},
  );
});

test('the first requirement of a repeated name is the one that changes', () => {
  const baseline = text([
    '### Requirement: Повтор',
    '',
    'первое',
    '',
    '### Requirement: Повтор',
    '',
    'второе',
  ]);
  const delta = text(['## MODIFIED Requirements', '', '### Requirement: Повтор', '', 'замена']);
  const got = specDiff(baseline, delta, deltaPath);
  const rows = rowsOf(got.rows);
  assert.equal(
    rows.some(row => row.kind === 'del' && row.text === 'первое'),
    true,
  );
  assert.equal(
    rows.some(row => row.kind === 'add' && row.text === 'замена'),
    true,
  );
  assert.equal(rows.find(row => row.text === 'второе')?.kind, 'ctx');
});

test('unchangedLabel counts lines in Russian', () => {
  assert.equal(unchangedLabel(1), '1 строка без изменений');
  assert.equal(unchangedLabel(2), '2 строки без изменений');
  assert.equal(unchangedLabel(5), '5 строк без изменений');
  assert.equal(unchangedLabel(11), '11 строк без изменений');
  assert.equal(unchangedLabel(21), '21 строка без изменений');
});

spec('spec-diff', () => {
  requirement('A line comment uses a thread when the line has an anchor', () => {
    scenario('A plan line opens a thread', async () => {
      const line = 'Сайдбар читает ветку.';
      const reply = 'Здесь узко.';
      const proposal = '## Scope\n\nСайдбар читает ветку.\n';
      const threads: {key: string; body: string; place: ThreadPlace}[] = [];
      const comments: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'proposing', {openPullRequests: 1})],
          commentPull: (_key, body) => {
            comments.push(body);
          },
          threadPull: async (key, body, place) => {
            threads.push({key, body, place});
          },
        },
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'proposal.md', proposal);
          await showCard(page, window);
          const html = await pageHtml(page.url);
          const button = lineButton(html, line);
          const at = sourceLine(proposal, line);
          assert.equal(at, 3);
          assert.equal(button.includes(`data-path="${PROPOSAL_PATH}"`), true);
          assert.equal(button.includes(`data-at="${at}"`), true);
          assert.equal(button.includes('data-side="right"'), true);
          assert.match(html, /\.spine button\.line:hover/);
          assert.equal(
            (
              await post(
                page.url,
                'act',
                answerFields({
                  line,
                  reply,
                  path: PROPOSAL_PATH,
                  at: String(at),
                  side: 'right',
                }),
              )
            ).status,
            200,
          );
          assert.deepEqual(threads, [
            {key: '1', body: reply, place: {path: PROPOSAL_PATH, line: at, side: 'right'}},
          ]);
          assert.deepEqual(comments, []);
        },
      );
    });
    scenario('A design line opens a thread', async () => {
      const line = 'Один модуль.';
      const reply = 'Здесь узко.';
      const design = '## Approach\n\nОдин модуль.\n';
      const threads: {key: string; body: string; place: ThreadPlace}[] = [];
      const comments: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'designing', {openPullRequests: 1})],
          commentPull: (_key, body) => {
            comments.push(body);
          },
          threadPull: async (key, body, place) => {
            threads.push({key, body, place});
          },
        },
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'design.md', design);
          await showCard(page, window);
          const html = await pageHtml(page.url);
          const button = lineButton(html, line);
          const at = sourceLine(design, line);
          assert.equal(at, 3);
          assert.equal(button.includes(`data-path="${DESIGN_PATH}"`), true);
          assert.equal(button.includes(`data-at="${at}"`), true);
          assert.equal(button.includes('data-side="right"'), true);
          assert.equal(
            (
              await post(
                page.url,
                'act',
                answerFields({
                  line,
                  reply,
                  path: DESIGN_PATH,
                  at: String(at),
                  side: 'right',
                }),
              )
            ).status,
            200,
          );
          assert.equal(threads[0]?.place.path, DESIGN_PATH);
          assert.deepEqual(threads, [
            {key: '1', body: reply, place: {path: DESIGN_PATH, line: at, side: 'right'}},
          ]);
          assert.deepEqual(comments, []);
        },
      );
    });
  });
});

const SPEC_ID = 'case-read';
const DELTA_PATH = 'openspec/changes/issue-1/specs/case-read/spec.md';
const PROPOSAL_PATH = 'openspec/changes/issue-1/proposal.md';
const DESIGN_PATH = 'openspec/changes/issue-1/design.md';

type ThreadPlace = {path: string; line: number; side: 'right' | 'left'};

function specText(lines: readonly string[]): string {
  return `${lines.join('\n')}\n`;
}

function sourceLine(source: string, needle: string): number {
  const index = source.split('\n').findIndex(line => line === needle);
  assert.notEqual(index, -1, needle);
  return index + 1;
}

function writeBaseline(arcadia: string, id: string, body: string): void {
  const file = path.join(arcadia, 'services', 'billing', 'openspec', 'specs', id, 'spec.md');
  mkdirSync(path.dirname(file), {recursive: true});
  writeFileSync(file, body);
}

async function showCard(page: {url: string}, window: ReturnType<typeof openWindow>): Promise<void> {
  window.chooseAgent('cursor');
  assert.equal(
    (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString())).status,
    200,
  );
}

async function drawSpec(
  page: {url: string},
  window: ReturnType<typeof openWindow>,
  arcadia: string,
  delta: string,
  baseline?: string,
): Promise<{shot: WindowSnapshot; html: string}> {
  if (baseline !== undefined) {
    writeBaseline(arcadia, SPEC_ID, baseline);
  }
  writeChange(arcadia, '1', `specs/${SPEC_ID}/spec.md`, delta);
  await showCard(page, window);
  const shot = await readSnapshot(page.url);
  return {shot, html: renderWindow(shot)};
}

function specView(shot: WindowSnapshot, id: string) {
  const cap = shot.opened?.spine.capabilities.find(item => item.id === id);
  assert.ok(cap, id);
  const flat = cap.rows.flatMap(entry => (entry.kind === 'gap' ? entry.hidden : [entry]));
  const gaps = cap.rows.flatMap(entry => (entry.kind === 'gap' ? [entry] : []));
  return {cap, flat, gaps};
}

function capHtml(html: string, id: string): string {
  const marker = `id="cap-${id}"`;
  const at = html.indexOf(marker);
  assert.ok(at >= 0, marker);
  const start = html.lastIndexOf('<details', at);
  const end = html.indexOf('</details>', at);
  assert.ok(end > start);
  return html.slice(start, end);
}

function summaryHtml(html: string, id: string): string {
  const cap = capHtml(html, id);
  const start = cap.indexOf('<summary>');
  const end = cap.indexOf('</summary>');
  assert.ok(end > start);
  return cap.slice(start, end + '</summary>'.length);
}

function assertNoSpineBadge(html: string): void {
  const row = spineOf(html, '1', 'Specify').split('<div class="fold">')[0] ?? '';
  assert.equal(row.includes('class="badge"'), false);
}

function assertBadge(html: string, id: string, badge: string | undefined): void {
  assertNoSpineBadge(html);
  const summary = summaryHtml(html, id);
  if (badge === undefined) {
    assert.equal(summary.includes('class="badge"'), false);
    return;
  }
  assert.match(summary, new RegExp(`<span class="badge">${badge}</span>`));
}

function diffBlock(html: string, id: string, kind: string, text: string): string {
  const chunks = capHtml(html, id).split('<div class="diff-row ').slice(1);
  const found = chunks.find(chunk => chunk.startsWith(kind) && chunk.includes(text));
  assert.ok(found, `${kind} ${text}`);
  return found;
}

function numCells(block: string): string[] {
  return [...block.matchAll(/<span class="num">([^<]*)<\/span>/g)].map(match => match[1] ?? '');
}

function lineButton(html: string, line: string): string {
  const marker = `data-line="${line}"`;
  const at = html.indexOf(marker);
  assert.ok(at >= 0, marker);
  const start = html.lastIndexOf('<button', at);
  return html.slice(start, html.indexOf('>', at) + 1);
}

function answerFields(fields: Record<string, string>): string {
  return new URLSearchParams({act: 'answer', key: '1', ...fields}).toString();
}

function replacedLines(): {baseline: string; delta: string; oldLine: string; newLine: string} {
  const oldLine = 'Старый текст.';
  const newLine = 'Новый текст.';
  return {
    oldLine,
    newLine,
    baseline: specText(['### Requirement: Чтение', '', oldLine]),
    delta: specText(['## MODIFIED Requirements', '', '### Requirement: Чтение', '', newLine]),
  };
}

spec('spec-diff', () => {
  requirement('A capability carries one badge', () => {
    scenario('A modified requirement is changed', async () => {
      const {baseline, delta} = replacedLines();
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying')]},
        async (page, window, paths) => {
          const {shot, html} = await drawSpec(page, window, paths.arcadia, delta, baseline);
          assert.equal(specView(shot, SPEC_ID).cap.badge, 'changed');
          assertBadge(html, SPEC_ID, 'changed');
        },
      );
    });
    scenario('A spec with no baseline is new', async () => {
      const lines = ['### Requirement: Чтение', '', 'Текст.'];
      const delta = specText(['## ADDED Requirements', '', ...lines]);
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying')]},
        async (page, window, paths) => {
          const {shot, html} = await drawSpec(page, window, paths.arcadia, delta);
          const view = specView(shot, SPEC_ID);
          assert.equal(view.cap.badge, 'new');
          assert.deepEqual(
            view.flat.map(row => row.text),
            lines,
          );
          assert.ok(view.flat.every(row => row.kind === 'add'));
          assertBadge(html, SPEC_ID, 'new');
        },
      );
    });
    scenario('An empty fold is removed', async () => {
      const lines = ['### Requirement: Чтение', '', 'Текст.'];
      const baseline = specText(lines);
      const delta = specText(['## REMOVED Requirements', '', '### Requirement: Чтение']);
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying')]},
        async (page, window, paths) => {
          const {shot, html} = await drawSpec(page, window, paths.arcadia, delta, baseline);
          const view = specView(shot, SPEC_ID);
          assert.equal(view.cap.badge, 'removed');
          assert.deepEqual(
            view.flat.map(row => row.text),
            lines,
          );
          assert.ok(view.flat.every(row => row.kind === 'del'));
          assertBadge(html, SPEC_ID, 'removed');
        },
      );
    });
    scenario('The same text has no badge', async () => {
      const lines = ['### Requirement: Чтение', '', 'Текст.'];
      const baseline = specText(lines);
      const delta = specText(['## MODIFIED Requirements', '', ...lines]);
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying')]},
        async (page, window, paths) => {
          const {shot, html} = await drawSpec(page, window, paths.arcadia, delta, baseline);
          const view = specView(shot, SPEC_ID);
          assert.equal(view.cap.badge, undefined);
          assert.ok(view.flat.length > 0);
          assert.ok(view.flat.every(row => row.kind === 'ctx'));
          const cap = capHtml(html, SPEC_ID);
          assert.equal(cap.includes('class="diff-row add"'), false);
          assert.equal(cap.includes('class="diff-row del"'), false);
          assertBadge(html, SPEC_ID, undefined);
        },
      );
    });
  });

  requirement('The drawer shows the folded spec', () => {
    scenario('A changed line shows both numbers and the changed words', async () => {
      const oldLine = 'Старый текст требования.';
      const newLine = 'Новый текст требования.';
      const baseline = specText(['### Requirement: Чтение', '', oldLine]);
      const folded = specText(['### Requirement: Чтение', '', newLine]);
      const delta = specText([
        '## MODIFIED Requirements',
        '',
        '### Requirement: Чтение',
        '',
        newLine,
      ]);
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying')]},
        async (page, window, paths) => {
          const {html} = await drawSpec(page, window, paths.arcadia, delta, baseline);
          const left = String(sourceLine(baseline, oldLine));
          const right = String(sourceLine(folded, newLine));
          const deletion = diffBlock(html, SPEC_ID, 'del', 'class="bit">Старый');
          const addition = diffBlock(html, SPEC_ID, 'add', 'class="bit">Новый');
          assert.deepEqual(numCells(deletion).slice(0, 2), [left, '']);
          assert.deepEqual(numCells(addition).slice(0, 2), ['', right]);
          assert.match(deletion, /<span class="bit">Старый<\/span>/);
          assert.match(addition, /<span class="bit">Новый<\/span>/);
          assert.match(deletion, /<span>текст<\/span>/);
          assert.match(addition, /<span>текст<\/span>/);
        },
      );
    });
    scenario('An unchanged spec shows one line number', async () => {
      const lines = ['### Requirement: Чтение', '', 'Текст.'];
      const baseline = specText(lines);
      const delta = specText(['## MODIFIED Requirements', '', ...lines]);
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying')]},
        async (page, window, paths) => {
          const {html} = await drawSpec(page, window, paths.arcadia, delta, baseline);
          const rows = [...capHtml(html, SPEC_ID).matchAll(/<(div|button) class="diff-row[^"]*"[\s\S]*?<\/\1>/g)];
          assert.ok(rows.length > 0);
          for (const row of rows) {
            assert.equal([...(row[0].matchAll(/<span class="num">/g))].length, 1);
          }
        },
      );
    });
    scenario('Unchanged lines between hunks sit in the gap', async () => {
      const between = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9', 'u10'];
      const baseline = specText(['### Requirement: Чтение', 'head-old', ...between, 'tail-old']);
      const delta = specText([
        '## MODIFIED Requirements',
        '',
        '### Requirement: Чтение',
        'head-new',
        ...between,
        'tail-new',
      ]);
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying')]},
        async (page, window, paths) => {
          const {shot} = await drawSpec(page, window, paths.arcadia, delta, baseline);
          const {gaps} = specView(shot, SPEC_ID);
          assert.equal(gaps.length, 1);
          const gap = gaps[0];
          assert.ok(gap);
          assert.deepEqual(
            gap.hidden.map(row => row.text),
            ['u4', 'u5', 'u6', 'u7'],
          );
        },
      );
    });
    scenario('Lines before the first change sit in a gap', async () => {
      const baseline = specText([
        '### Requirement: Чтение',
        'k1',
        'k2',
        'k3',
        'k4',
        'k5',
        'k6',
        'k7',
        'old-end',
      ]);
      const delta = specText([
        '## MODIFIED Requirements',
        '',
        '### Requirement: Чтение',
        'k1',
        'k2',
        'k3',
        'k4',
        'k5',
        'k6',
        'k7',
        'new-end',
      ]);
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying')]},
        async (page, window, paths) => {
          const {shot} = await drawSpec(page, window, paths.arcadia, delta, baseline);
          const {cap, gaps} = specView(shot, SPEC_ID);
          assert.equal(gaps.length, 1);
          const gap = gaps[0];
          assert.ok(gap);
          assert.deepEqual(
            gap.hidden.map(row => row.text),
            ['### Requirement: Чтение', 'k1', 'k2', 'k3', 'k4'],
          );
          const visible: string[] = [];
          for (const entry of cap.rows) {
            if (entry.kind === 'gap') {
              continue;
            }
            visible.push(entry.text);
          }
          assert.equal(visible.includes('k5'), true);
          assert.equal(visible.includes('k6'), true);
          assert.equal(visible.includes('k7'), true);
          assert.equal(visible.includes('k1'), false);
          assert.equal(visible.includes('k4'), false);
        },
      );
    });
    scenario('Added text keeps the purpose and drops the delta heading', async () => {
      const baseline = specText([
        '## Purpose',
        '',
        'Зачем эта возможность.',
        '',
        '## Requirements',
        '',
        '### Requirement: Есть',
        '',
        'Текст.',
      ]);
      const delta = specText([
        '## ADDED Requirements',
        '',
        '### Requirement: Новое',
        '',
        'Дописано.',
      ]);
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying')]},
        async (page, window, paths) => {
          const {shot, html} = await drawSpec(page, window, paths.arcadia, delta, baseline);
          const texts = specView(shot, SPEC_ID).flat.map(row => row.text);
          assert.equal(texts.includes('Зачем эта возможность.'), true);
          assert.equal(texts.includes('### Requirement: Новое'), true);
          assert.equal(texts.includes('Дописано.'), true);
          assert.equal(
            texts.some(text => text.includes('ADDED')),
            false,
          );
          assert.equal(capHtml(html, SPEC_ID).includes('ADDED'), false);
        },
      );
    });
  });

  requirement('The drawer shows the folded spec', () => {
    scenario('Earlier scenarios fold up to the requirement heading', async () => {
      const body = [
        '### Requirement: Чтение',
        'Тело требования.',
        '#### Scenario: Первый',
        '- **WHEN** первый',
        '- **THEN** первый',
        '#### Scenario: Второй',
        '- **WHEN** второй',
        '- **THEN** было',
      ];
      const baseline = specText(body);
      const delta = specText([
        '## MODIFIED Requirements',
        '',
        ...body.slice(0, -1),
        '- **THEN** стало',
      ]);
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying')]},
        async (page, window, paths) => {
          const {shot} = await drawSpec(page, window, paths.arcadia, delta, baseline);
          const {cap, gaps} = specView(shot, SPEC_ID);
          const visible = cap.rows.flatMap(entry => (entry.kind === 'gap' ? [] : [entry.text]));
          assert.deepEqual(visible, [
            '### Requirement: Чтение',
            '#### Scenario: Второй',
            '- **WHEN** второй',
            '- **THEN** было',
            '- **THEN** стало',
          ]);
          assert.equal(gaps.length, 1);
          assert.deepEqual(gaps[0]?.hidden.map(row => row.text), [
            'Тело требования.',
            '#### Scenario: Первый',
            '- **WHEN** первый',
            '- **THEN** первый',
          ]);
        },
      );
    });
  });

  requirement('The fold control sits apart from the spec text', () => {
    scenario('The fold control is centered and the list has no rule above it', () => {
      const css = readFileSync(new URL('./face.css', import.meta.url), 'utf8');
      assert.match(css, /\.spine button\.fold-bar \{[^}]*text-align: center/);
      assert.match(css, /\.spine \.fold > \.cap:first-child \{[^}]*border-top: 0/);
      assert.match(css, /\.spine button\.diff-row:hover/);
    });
    scenario('A diff row hover has no left bar', () => {
      const css = readFileSync(new URL('./face.css', import.meta.url), 'utf8');
      assert.match(
        css,
        /\.spine button\.diff-row:hover,\s*\.spine button\.diff-row\.is-on\s*\{[^}]*background-image:/,
      );
      assert.doesNotMatch(
        css,
        /\.spine button\.diff-row:hover,\s*\.spine button\.diff-row\.is-on\s*\{[^}]*inset\s+3px/,
      );
    });
  });

  requirement('A line comment uses a thread when the line has an anchor', () => {
    scenario('A line copied from the delta opens a thread', async () => {
      const {baseline, delta, newLine} = replacedLines();
      const reply = 'Смотрите сюда.';
      const threads: {key: string; body: string; place: ThreadPlace}[] = [];
      const comments: string[] = [];
      const spoken: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'specifying', {openPullRequests: 1})],
          commentPull: (_key, body) => {
            comments.push(body);
          },
          threadPull: async (key, body, place) => {
            threads.push({key, body, place});
          },
          speakPull: async (_key, body) => {
            spoken.push(body);
          },
        },
        async (page, window, paths) => {
          const {shot, html} = await drawSpec(page, window, paths.arcadia, delta, baseline);
          const added = specView(shot, SPEC_ID).flat.find(
            row => row.kind === 'add' && row.text === newLine,
          );
          assert.ok(added);
          assert.ok(added.anchor);
          assert.equal(added.anchor.path, DELTA_PATH);
          assert.equal(added.anchor.side, 'right');
          assert.equal(added.anchor.line, sourceLine(delta, newLine));
          assert.notEqual(added.anchor.line, added.right);
          const button = lineButton(html, newLine);
          assert.equal(button.includes(`data-path="${DELTA_PATH}"`), true);
          assert.equal(button.includes(`data-at="${added.anchor.line}"`), true);
          assert.equal(button.includes('data-side="right"'), true);
          const rowStart = html.lastIndexOf('<button', html.indexOf(`data-line="${newLine}"`));
          const row = html.slice(rowStart, html.indexOf('</button>', rowStart));
          assert.match(row, /class="diff-row /);
          assert.match(row, /class="num"/);
          assert.equal(
            (
              await post(
                page.url,
                'act',
                answerFields({
                  line: newLine,
                  reply,
                  path: added.anchor.path,
                  at: String(added.anchor.line),
                  side: added.anchor.side,
                }),
              )
            ).status,
            200,
          );
          assert.deepEqual(threads, [
            {
              key: '1',
              body: reply,
              place: {path: DELTA_PATH, line: added.anchor.line, side: 'right'},
            },
          ]);
          assert.deepEqual(comments, []);
          assert.deepEqual(spoken, []);
        },
      );
    });
    scenario('A baseline line quotes the pull request', async () => {
      const {baseline, delta, oldLine} = replacedLines();
      const reply = 'Здесь узко.';
      const threads: ThreadPlace[] = [];
      const comments: string[] = [];
      const spoken: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'specifying', {openPullRequests: 1})],
          commentPull: (_key, body) => {
            comments.push(body);
          },
          threadPull: async (_key, _body, place) => {
            threads.push(place);
          },
          speakPull: async (_key, body) => {
            spoken.push(body);
          },
        },
        async (page, window, paths) => {
          const {shot, html} = await drawSpec(page, window, paths.arcadia, delta, baseline);
          const visible = specView(shot, SPEC_ID).flat.find(
            row => row.kind === 'del' && row.text === oldLine,
          );
          assert.ok(visible);
          assert.equal(visible.anchor, undefined);
          const button = lineButton(html, oldLine);
          assert.equal(button.includes('data-path='), false);
          assert.equal(
            (
              await post(
                page.url,
                'act',
                answerFields({
                  line: oldLine,
                  reply,
                }),
              )
            ).status,
            200,
          );
          assert.deepEqual([...comments, ...spoken], [`> ${oldLine}\n\n${reply}`]);
          assert.deepEqual(threads, []);
        },
      );
    });
    scenario('A refused thread is quoted', async () => {
      const {baseline, delta, newLine} = replacedLines();
      const reply = 'Смотрите сюда.';
      const spoken: string[] = [];
      let threadCalls = 0;
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'specifying', {openPullRequests: 1})],
          threadPull: async () => {
            threadCalls += 1;
            throw new Error('host refused the thread');
          },
          speakPull: async (_key, body) => {
            spoken.push(body);
          },
        },
        async (page, window, paths) => {
          const {shot} = await drawSpec(page, window, paths.arcadia, delta, baseline);
          const added = specView(shot, SPEC_ID).flat.find(
            row => row.kind === 'add' && row.text === newLine,
          );
          assert.ok(added);
          const anchor = added.anchor;
          assert.ok(anchor);
          const posted = await post(
            page.url,
            'act',
            answerFields({
              line: newLine,
              reply,
              path: anchor.path,
              at: String(anchor.line),
              side: anchor.side,
            }),
          );
          assert.equal(posted.status, 200);
          const next = JSON.parse(posted.body) as WindowSnapshot;
          assert.equal(threadCalls, 1);
          assert.deepEqual(spoken, [`> ${newLine}\n\n${reply}`]);
          assert.equal(next.status, undefined);
          assert.equal(JSON.stringify(next).includes('host refused the thread'), false);
        },
      );
    });
    scenario('Both writes failing leave the comment unrecorded', async () => {
      const {baseline, delta, newLine} = replacedLines();
      const reply = 'Смотрите сюда.';
      let threadCalls = 0;
      let speakCalls = 0;
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'specifying', {openPullRequests: 1})],
          threadPull: async () => {
            threadCalls += 1;
            throw new Error('host refused the thread');
          },
          speakPull: async () => {
            speakCalls += 1;
            throw new Error('host refused the quote');
          },
        },
        async (page, window, paths) => {
          const {shot} = await drawSpec(page, window, paths.arcadia, delta, baseline);
          const added = specView(shot, SPEC_ID).flat.find(
            row => row.kind === 'add' && row.text === newLine,
          );
          assert.ok(added);
          const anchor = added.anchor;
          assert.ok(anchor);
          const posted = await post(
            page.url,
            'act',
            answerFields({
              line: newLine,
              reply,
              path: anchor.path,
              at: String(anchor.line),
              side: anchor.side,
            }),
          );
          assert.equal(posted.status, 200);
          const next = JSON.parse(posted.body) as WindowSnapshot;
          assert.equal(threadCalls, 1);
          assert.equal(speakCalls, 1);
          assert.equal(next.status, 'комментарий не записан');
          assert.equal(statusOf(renderWindow(next)), 'комментарий не записан');
          assert.equal(JSON.stringify(next).includes('host refused'), false);
        },
      );
    });
    scenario('A plan line opens a thread on proposal.md', async () => {
      const line = 'Годность проверки.';
      const reply = 'Сначала сократить.';
      const proposal = specText(['## Outcome', '', line]);
      const threads: {key: string; body: string; place: ThreadPlace}[] = [];
      const comments: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'proposing', {openPullRequests: 1})],
          commentPull: (_key, body) => {
            comments.push(body);
          },
          threadPull: async (key, body, place) => {
            threads.push({key, body, place});
          },
        },
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'proposal.md', proposal);
          await showCard(page, window);
          const html = renderWindow(await readSnapshot(page.url));
          const button = lineButton(html, line);
          const at = sourceLine(proposal, line);
          assert.equal(button.includes(`data-path="${PROPOSAL_PATH}"`), true);
          assert.equal(button.includes(`data-at="${at}"`), true);
          assert.equal(button.includes('data-side="right"'), true);
          assert.equal(
            (
              await post(
                page.url,
                'act',
                answerFields({
                  line,
                  reply,
                  path: PROPOSAL_PATH,
                  at: String(at),
                  side: 'right',
                }),
              )
            ).status,
            200,
          );
          assert.deepEqual(threads, [
            {key: '1', body: reply, place: {path: PROPOSAL_PATH, line: at, side: 'right'}},
          ]);
          assert.deepEqual(comments, []);
        },
      );
    });
    scenario('A design line opens a thread on design.md', async () => {
      const line = 'Один модуль.';
      const reply = 'Сначала сократить.';
      const design = '## Approach\n\nОдин модуль.\n';
      const threads: {key: string; body: string; place: ThreadPlace}[] = [];
      const comments: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'designing', {openPullRequests: 1})],
          commentPull: (_key, body) => {
            comments.push(body);
          },
          threadPull: async (key, body, place) => {
            threads.push({key, body, place});
          },
        },
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'design.md', design);
          await showCard(page, window);
          const html = renderWindow(await readSnapshot(page.url));
          const button = lineButton(html, line);
          const at = sourceLine(design, line);
          assert.equal(button.includes(`data-path="${DESIGN_PATH}"`), true);
          assert.equal(button.includes(`data-at="${at}"`), true);
          assert.equal(button.includes('data-side="right"'), true);
          assert.equal(
            (
              await post(
                page.url,
                'act',
                answerFields({
                  line,
                  reply,
                  path: DESIGN_PATH,
                  at: String(at),
                  side: 'right',
                }),
              )
            ).status,
            200,
          );
          assert.equal(threads.length, 1);
          assert.equal(threads[0]?.place.path, DESIGN_PATH);
          assert.deepEqual(comments, []);
        },
      );
    });
    scenario('An open question stays a conversation reply', async () => {
      const question = 'Писать ли имя проверки?';
      const reply = 'Да, короткое имя.';
      const line = `- [ ] ${question}`;
      const proposal = specText(['## Open questions', '', line]);
      const threads: ThreadPlace[] = [];
      const comments: string[] = [];
      const spoken: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'proposing', {openPullRequests: 1})],
          commentPull: (_key, body) => {
            comments.push(body);
          },
          threadPull: async (_key, _body, place) => {
            threads.push(place);
          },
          speakPull: async (_key, body) => {
            spoken.push(body);
          },
        },
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'proposal.md', proposal);
          await showCard(page, window);
          const html = renderWindow(await readSnapshot(page.url));
          const button = lineButton(html, line);
          const at = sourceLine(proposal, line);
          assert.equal(button.includes(`data-question="${question}"`), true);
          assert.equal(button.includes(`data-path="${PROPOSAL_PATH}"`), true);
          assert.equal(button.includes(`data-at="${at}"`), true);
          assert.equal(
            (
              await post(
                page.url,
                'act',
                answerFields({
                  question,
                  line,
                  reply,
                  path: PROPOSAL_PATH,
                  at: String(at),
                  side: 'right',
                }),
              )
            ).status,
            200,
          );
          assert.deepEqual([...comments, ...spoken], [`- [ ] ${question}\n\n${reply}`]);
          assert.deepEqual(threads, []);
        },
      );
    });
    scenario('An open design question stays a conversation reply', async () => {
      const question = 'Имя модуля?';
      const reply = 'Да.';
      const line = `- [ ] ${question}`;
      const design = specText(['## Open questions', '', line]);
      const threads: ThreadPlace[] = [];
      const comments: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'designing', {openPullRequests: 1})],
          commentPull: (_key, body) => {
            comments.push(body);
          },
          threadPull: async (_key, _body, place) => {
            threads.push(place);
          },
        },
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'design.md', design);
          await showCard(page, window);
          const html = renderWindow(await readSnapshot(page.url));
          const button = lineButton(html, line);
          assert.equal(button.includes(`data-question="${question}"`), true);
          assert.equal(
            (
              await post(
                page.url,
                'act',
                answerFields({
                  question,
                  line,
                  reply,
                  path: DESIGN_PATH,
                  at: String(sourceLine(design, line)),
                  side: 'right',
                }),
              )
            ).status,
            200,
          );
          assert.deepEqual(comments, [`- [ ] ${question}\n\n${reply}`]);
          assert.deepEqual(threads, []);
        },
      );
    });
    scenario('A design checkbox outside Open questions opens a thread', async () => {
      const line = '- [ ] не вопрос';
      const reply = 'Это заметка.';
      const design = '## Notes\n\n- [ ] не вопрос\n';
      const threads: {key: string; body: string; place: ThreadPlace}[] = [];
      const comments: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'designing', {openPullRequests: 1})],
          commentPull: (_key, body) => {
            comments.push(body);
          },
          threadPull: async (key, body, place) => {
            threads.push({key, body, place});
          },
        },
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'design.md', design);
          await showCard(page, window);
          const html = renderWindow(await readSnapshot(page.url));
          const button = lineButton(html, line);
          assert.equal(button.includes('data-question'), false);
          const at = sourceLine(design, line);
          assert.equal(
            (
              await post(
                page.url,
                'act',
                answerFields({
                  line,
                  reply,
                  path: DESIGN_PATH,
                  at: String(at),
                  side: 'right',
                }),
              )
            ).status,
            200,
          );
          assert.deepEqual(threads, [
            {key: '1', body: reply, place: {path: DESIGN_PATH, line: at, side: 'right'}},
          ]);
          assert.deepEqual(comments, []);
        },
      );
    });
    scenario('A repeated design checkbox outside Open questions opens a thread', async () => {
      const question = 'Имя модуля?';
      const line = `- [ ] ${question}`;
      const reply = 'Это заметка.';
      const design = specText(['## Open questions', '', line, '', '## Notes', '', line]);
      const threads: {key: string; body: string; place: ThreadPlace}[] = [];
      const comments: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'designing', {openPullRequests: 1})],
          commentPull: (_key, body) => {
            comments.push(body);
          },
          threadPull: async (key, body, place) => {
            threads.push({key, body, place});
          },
        },
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'design.md', design);
          await showCard(page, window);
          const html = renderWindow(await readSnapshot(page.url));
          const button = lineButton(html, line);
          assert.equal(button.includes(`data-question="${question}"`), true);
          const notesHeading = html.indexOf('<h3>Notes</h3>');
          assert.ok(notesHeading >= 0);
          const notesButton = lineButton(html.slice(notesHeading), line);
          assert.equal(notesButton.includes('data-question'), false);
          const openAt = sourceLine(design, line);
          const notesAt =
            design.split('\n').findIndex((row, index) => index >= openAt && row === line) + 1;
          assert.ok(notesAt > openAt);
          assert.equal(
            (
              await post(
                page.url,
                'act',
                answerFields({
                  line,
                  reply,
                  path: DESIGN_PATH,
                  at: String(notesAt),
                  side: 'right',
                }),
              )
            ).status,
            200,
          );
          assert.deepEqual(threads, [
            {key: '1', body: reply, place: {path: DESIGN_PATH, line: notesAt, side: 'right'}},
          ]);
          assert.deepEqual(comments, []);
        },
      );
    });
  });
});

spec('spec-diff', () => {
  requirement('A task opens its scenario', () => {
    scenario('A task opens the scenario inside a gap', () => {
      const name = 'Скрытый сценарий';
      const rows: SpecEntry[] = [
        {kind: 'ctx', text: 'видно'},
        {
          kind: 'gap',
          count: 1,
          hidden: [{kind: 'ctx', text: `#### Scenario: ${name}`}],
        },
      ];
      assert.deepEqual(scenarioTarget(rows, 'case-read', name), {
        capability: 'case-read',
        gap: 1,
        name,
      });
    });
  });

  requirement('An opened gap stays open until the capability closes', () => {
    scenario('A second click leaves the gap open', () => {
      assert.deepEqual(revealFold([1], 1), [1]);
      assert.deepEqual(revealFold([1], 2), [1, 2]);
    });
    scenario('Closing the capability hides the lines again', () => {
      const folds = [{id: 'case-read', open: [1, 2]}];
      assert.deepEqual(foldsAfterSpec(folds, 'case-read', true), [...folds]);
      assert.deepEqual(foldsAfterSpec(folds, 'case-read', false), []);
      assert.equal(capIsOpen('case-read', 0, [{id: 'case-read', open: false}], []), false);
      assert.equal(capIsOpen('case-read', 0, [], []), true);
    });
  });
});

spec('spec-diff', () => {
  requirement('GitHub sends the side of the thread', () => {
    scenario('A plain right-side thread is unmarked', async () => {
      const calls: string[][] = [];
      const {review} = githubAdapters({
        run: async args => {
          calls.push(args);
          return '';
        },
      });
      await review.openThread('15', {
        commit: 'abc',
        path: 'src/a.ts',
        line: 4,
        body: 'смотрите сюда',
        plain: true,
        side: 'right',
      });
      await review.openThread('15', {
        commit: 'abc',
        path: 'src/a.ts',
        line: 4,
        body: 'смотрите сюда',
        plain: true,
        side: 'left',
      });
      await review.openThread('15', {
        commit: 'abc',
        path: 'src/a.ts',
        line: 1,
        body: 'sdd:note baseline',
      });
      const right = calls[0] ?? [];
      const left = calls[1] ?? [];
      const marked = calls[2] ?? [];
      assert.equal(right.includes('side=RIGHT'), true);
      assert.equal(right.includes('body=смотрите сюда'), true);
      assert.equal(
        right.some(arg => arg.includes('🤖')),
        false,
      );
      assert.equal(left.includes('side=LEFT'), true);
      assert.equal(marked.includes('body=🤖 sdd:note baseline'), true);
      assert.equal(
        marked.some(arg => arg.startsWith('side=')),
        false,
      );
    });
  });
});

spec('spec-diff', () => {
  requirement('Arcanum posts a published thread on the active diff', () => {
    scenario('A published thread uses the changelist entry', async () => {
      const {get, post, gets, posts} = fakeHttp();
      const body = 'смотрите сюда';
      await arcanumOpenThread({get, post}, '42', {
        commit: 'abc',
        path: specPath,
        line: 12,
        body,
        side: 'right',
      });
      assert.deepEqual(gets, [activeDiff, changelist]);
      assert.deepEqual(posts, [
        {
          path: '/v2/public/diff/7/comment',
          body: {
            entry_id: 'e1',
            is_draft: false,
            side: 'new',
            line: 12,
            size: 1,
            content: body,
          },
        },
      ]);
    });
    scenario('A missing file fails the thread', async () => {
      const {get, post, posts} = fakeHttp();
      await assert.rejects(
        arcanumOpenThread({get, post}, '42', {
          commit: 'abc',
          path: 'src/missing.ts',
          line: 12,
          body: 'смотрите сюда',
          side: 'right',
        }),
      );
      assert.deepEqual(posts, []);
    });
  });
});

function gitQuiet(root: string, args: string[]): void {
  execFileSync('git', args, {cwd: root, stdio: 'ignore'});
}

function issueRepo(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'sandcastle-spec-diff-'));
  gitQuiet(root, ['init', '-b', 'master']);
  gitQuiet(root, ['config', 'user.email', 'test@example.com']);
  gitQuiet(root, ['config', 'user.name', 'Test']);
  writeFileSync(path.join(root, 'README.md'), 'root\n');
  gitQuiet(root, ['add', 'README.md']);
  gitQuiet(root, ['commit', '-m', 'init']);
  gitQuiet(root, ['checkout', '-b', 'sdd/7']);
  return root;
}

function save(root: string, subject: string, body?: string): void {
  gitQuiet(root, body ? ['commit', '-m', subject, '-m', body] : ['commit', '-m', subject]);
}

function copies(value: unknown, needle: string): number {
  return JSON.stringify(value).split(needle).length - 1;
}

function addedArchive(): string {
  const root = issueRepo();
  const change = path.join(root, 'openspec', 'changes', 'issue-7', 'specs', 'fresh');
  mkdirSync(change, {recursive: true});
  writeFileSync(path.join(root, 'openspec', 'changes', 'issue-7', 'proposal.md'), '## Outcome\n\nИз родителя.\n');
  writeFileSync(
    path.join(change, 'spec.md'),
    ['## ADDED Requirements', '', '### Requirement: Новое', '', 'Текст.', ''].join('\n'),
  );
  gitQuiet(root, ['add', 'openspec']);
  save(root, 'plan');
  mkdirSync(path.join(root, 'openspec', 'changes', 'archive'), {recursive: true});
  gitQuiet(root, ['mv', 'openspec/changes/issue-7', 'openspec/changes/archive/issue-7']);
  mkdirSync(path.join(root, 'openspec', 'specs', 'fresh'), {recursive: true});
  writeFileSync(
    path.join(root, 'openspec', 'specs', 'fresh', 'spec.md'),
    ['## Purpose', '', 'Зачем.', '', '## Requirements', '', '### Requirement: Новое', '', 'Текст.', ''].join('\n'),
  );
  gitQuiet(root, ['add', 'openspec']);
  save(root, 'archive', 'Sdd-Archive: issue-7');
  return root;
}

function modifiedArchive(): string {
  const root = issueRepo();
  const change = path.join(root, 'openspec', 'changes', 'issue-7', 'specs', 'fresh');
  mkdirSync(change, {recursive: true});
  mkdirSync(path.join(root, 'openspec', 'specs', 'fresh'), {recursive: true});
  writeFileSync(path.join(root, 'openspec', 'changes', 'issue-7', 'proposal.md'), '## Outcome\n\nИз родителя.\n');
  writeFileSync(
    path.join(root, 'openspec', 'specs', 'fresh', 'spec.md'),
    ['## Purpose', '', 'Зачем.', '', '## Requirements', '', '### Requirement: Новое', '', 'Старое.', ''].join('\n'),
  );
  writeFileSync(
    path.join(change, 'spec.md'),
    ['## MODIFIED Requirements', '', '### Requirement: Новое', '', 'Новое.', ''].join('\n'),
  );
  gitQuiet(root, ['add', 'openspec']);
  save(root, 'plan');
  mkdirSync(path.join(root, 'openspec', 'changes', 'archive'), {recursive: true});
  gitQuiet(root, ['mv', 'openspec/changes/issue-7', 'openspec/changes/archive/issue-7']);
  writeFileSync(
    path.join(root, 'openspec', 'specs', 'fresh', 'spec.md'),
    ['## Purpose', '', 'Зачем.', '', '## Requirements', '', '### Requirement: Новое', '', 'Новое.', ''].join('\n'),
  );
  gitQuiet(root, ['add', 'openspec']);
  save(root, 'archive', 'Sdd-Archive: issue-7');
  return root;
}

function freshCapability(root: string) {
  const spine = buildSpine({key: '7', checkout: root, files: gitFiles(root, '7', 'sdd')});
  return spine.capabilities.find(item => item.id === 'fresh');
}

spec('spec-diff', () => {
  requirement('An archived change folds the baseline from before the archive commit', () => {
    scenario('An archived addition is new once', () => {
      const root = addedArchive();
      try {
        const capability = freshCapability(root);
        assert.ok(capability);
        assert.equal(capability.badge, 'new');
        assert.equal(copies(capability.rows, '### Requirement: Новое'), 1);
      } finally {
        rmSync(root, {recursive: true, force: true});
      }
    });
  });

  requirement('An archived modification folds the parent baseline', () => {
    scenario('An archived modification is changed once', () => {
      const root = modifiedArchive();
      try {
        const capability = freshCapability(root);
        assert.ok(capability);
        assert.equal(capability.badge, 'changed');
        assert.equal(copies(capability.rows, '### Requirement: Новое'), 1);
      } finally {
        rmSync(root, {recursive: true, force: true});
      }
    });
  });
});

spec('spec-archive', () => {
  requirement('One commit holds the fold', () => {
    scenario('The machine, the window, review, and unarchive keep reading archive/issue-<key>', () => {
      const root = addedArchive();
      try {
        const files = gitFiles(root, '7', 'sdd');
        assert.ok(files.exists('openspec/changes/archive/issue-7/specs/fresh/spec.md'));
        assert.equal(files.exists('openspec/changes/archive/2025-11-05-issue-7/specs/fresh/spec.md'), false);
        const capability = freshCapability(root);
        assert.ok(capability);
        assert.doesNotMatch(JSON.stringify(capability), /\d{4}-\d{2}-\d{2}-issue-7/);
      } finally {
        rmSync(root, {recursive: true, force: true});
      }
    });
  });
});
