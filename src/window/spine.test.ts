import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'vitest';

import {changeDir} from '../machine/naming.ts';
import {buildSpine, layerForStation, linesFromFocus, linesFromIssue} from './spine.ts';

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
      '#### Scenario: Проверка отсутствующего кейса не находит его',
      '',
      '- **WHEN** проверяют кейс, которого нет',
      '- **THEN** проверка его не находит',
      '',
    ].join('\n'),
  );
  writeFileSync(
    path.join(change, 'tasks.md'),
    '- [x] `missing-case` — «Проверка отсутствующего кейса не находит его»\n',
  );
  const spine = buildSpine({key: '1', checkout, station: 'tasking'});
  const requirement = spine.capabilities[0]?.requirements[0];
  assert.equal(requirement?.kind, 'MODIFIED');
  assert.deepEqual(requirement?.added, ['Проверка отсутствующего кейса не находит его.']);
  assert.equal(spine.tasks[0]?.scenarios[0]?.capability, 'case-read');
  assert.equal(spine.open, 'Tasks');
  rmSync(dir, {recursive: true, force: true});
});
