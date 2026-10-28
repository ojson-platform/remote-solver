import type {SpecEntry} from '../spec-diff.ts';

import assert from 'node:assert/strict';
import {requirement, scenario, spec} from '@ojson/spec-coverage';
import {test} from 'vitest';

import {keptSpineLayer, scenarioTarget, toggledSpineLayer, revealFold, foldsAfterSpec, capIsOpen} from './gesture.ts';

test('revealFold keeps an index that is already open', () => {
  const open = [2, 0, 4];
  assert.deepEqual(revealFold(open, 0), [2, 0, 4]);
  assert.deepEqual(open, [2, 0, 4]);
});

test('revealFold adds an index that was closed and keeps the rest', () => {
  const open = [2, 4];
  assert.deepEqual(revealFold(open, 0), [2, 4, 0]);
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

spec('spine', () => {
  requirement('A row opens only when it has a fold', () => {
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
});
