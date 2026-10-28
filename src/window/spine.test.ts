import type {SpecEntry} from './spec-diff.ts';

import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {requirement, scenario, spec} from '@ojson/spec-coverage';
import {test} from 'vitest';

import {readBranch} from '../machine/change.ts';
import {changeDir} from '../machine/naming.ts';
import {changeFiles} from './change-files.ts';
import {buildSpine, layerForStation, linesFromFocus, linesFromIssue, projectSpine} from './spine.ts';

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

spec('live-frame', () => {
  requirement('A comment leaves the plan section', () => {
    scenario('A new focus keeps the plan revision', () => {
      const text = {
        proposal: '## Outcome\n\nИтог одного чтения.\n',
        design: '',
        tasks: '',
        specs: [],
        baselines: [],
      };
      const first = projectSpine(text, {key: '1', focusBody: 'Plan: было'});
      const second = projectSpine(text, {key: '1', focusBody: 'Plan: стало'}, first);
      assert.equal(second.proposal, first.proposal);
      assert.equal(second.sections.plan, first.sections.plan);
      assert.notEqual(second.sections.focus, first.sections.focus);
      assert.notEqual(second.lines, first.lines);
    });
  });
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
