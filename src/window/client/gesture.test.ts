import type {SpecEntry} from '../spec-diff.ts';

import assert from 'node:assert/strict';
import {requirement, scenario, spec} from '@ojson/spec-coverage';
import {test} from 'vitest';

import {scenarioTarget, toggleFold} from './gesture.ts';

test('toggleFold drops an index that is already open and keeps the rest', () => {
  const open = [2, 0, 4];
  assert.deepEqual(toggleFold(open, 0), [2, 4]);
  assert.deepEqual(open, [2, 0, 4]);
});

test('toggleFold adds an index that was closed and keeps the rest', () => {
  const open = [2, 4];
  assert.deepEqual(toggleFold(open, 0), [2, 4, 0]);
  assert.deepEqual(open, [2, 4]);
});

test('scenarioTarget finds a scenario hidden in the first fold', () => {
  const rows: SpecEntry[] = [
    {
      kind: 'gap',
      count: 1,
      hidden: [{kind: 'ctx', text: '#### Scenario: Проверка'}],
    },
  ];
  assert.deepEqual(scenarioTarget(rows, 'case-read', 'Проверка'), {
    capability: 'case-read',
    gap: 0,
    name: 'Проверка',
  });
});

test('scenarioTarget omits the gap when the scenario line is visible', () => {
  const rows: SpecEntry[] = [{kind: 'ctx', text: '#### Scenario: Проверка'}];
  assert.deepEqual(scenarioTarget(rows, 'case-read', 'Проверка'), {
    capability: 'case-read',
    name: 'Проверка',
  });
});

test('scenarioTarget is absent when no line has that name', () => {
  const rows: SpecEntry[] = [
    {
      kind: 'gap',
      count: 1,
      hidden: [{kind: 'ctx', text: '#### Scenario: Проверка'}],
    },
    {kind: 'ctx', text: '#### Scenario: Проверка'},
  ];
  assert.equal(scenarioTarget(rows, 'case-read', 'Другое'), undefined);
});

test('scenarioTarget trims a hidden scenario line and keeps that fold index', () => {
  const rows: SpecEntry[] = [
    {kind: 'ctx', text: 'видно'},
    {
      kind: 'gap',
      count: 1,
      hidden: [{kind: 'del', text: '  #### Scenario: Проверка  '}],
    },
  ];
  assert.deepEqual(scenarioTarget(rows, 'case-read', 'Проверка'), {
    capability: 'case-read',
    gap: 1,
    name: 'Проверка',
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
});
