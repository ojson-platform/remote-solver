import type {SpecEntry, SpecGap, SpecRow} from './spec-diff.ts';

import assert from 'node:assert/strict';
import {test} from 'vitest';

import {specDiff, unchangedLabel} from './spec-diff.ts';

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
