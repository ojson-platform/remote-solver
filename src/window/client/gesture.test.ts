import type {SpecEntry} from '../spec-diff.ts';

import assert from 'node:assert/strict';
import {requirement, scenario, spec} from '@ojson/spec-coverage';
import {test} from 'vitest';

import {draftsAfterClick} from '../page.ts';
import {capIsOpen, dragLeavesSelection, foldsAfterSpec, revealFold, scenarioTarget} from './gesture.ts';

function mockSelection(
  text: string,
  anchor: Node,
  focus: Node,
  collapsed = false,
): {anchorNode: Node; focusNode: Node; isCollapsed: boolean; toString: () => string} {
  return {
    anchorNode: anchor,
    focusNode: focus,
    isCollapsed: collapsed,
    toString: () => text,
  };
}

function lineContains(inside: Node): {contains: (node: Node) => boolean} {
  return {contains: node => node === inside};
}

/** Same draft rule as the line click listener when a drag leaves selected text. */
function draftsAfterLineClick(
  open: readonly {line: string; text: string}[],
  targetLine: string,
  line: {contains: (node: Node) => boolean},
  selection: Parameters<typeof dragLeavesSelection>[1],
): {line: string; text: string}[] {
  if (dragLeavesSelection(line, selection)) {
    return [...open];
  }
  return draftsAfterClick(open, targetLine);
}

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

spec('line-select', () => {
  requirement('A sidebar line can be selected and copied', () => {
    scenario('A drag that leaves selected text is not a click', () => {
      const text = {} as Node;
      const line = lineContains(text);
      const drag = mockSelection('фрагмент', text, text);
      assert.equal(dragLeavesSelection(line, drag), true);
      const click = mockSelection('', text, text, true);
      assert.equal(dragLeavesSelection(line, click), false);
      const outside = {} as Node;
      const miss = mockSelection('фрагмент', outside, outside);
      assert.equal(dragLeavesSelection(line, miss), false);
    });
    scenario(
      "The drag does not open the line's comment and does not close one that is already open",
      () => {
      const text = {} as Node;
      const line = lineContains(text);
      const drag = mockSelection('строка', text, text);
      const closed = draftsAfterLineClick([], 'первая', line, drag);
      assert.deepEqual(closed, []);
      const open = draftsAfterLineClick([{line: 'первая', text: ''}], 'первая', line, drag);
      assert.deepEqual(open, [{line: 'первая', text: ''}]);
      },
    );
    scenario('The field stays as it was', () => {
      const text = {} as Node;
      const line = lineContains(text);
      const drag = mockSelection('черновик', text, text);
      const typed = draftsAfterLineClick([{line: 'первая', text: 'черновик'}], 'первая', line, drag);
      assert.deepEqual(typed, [{line: 'первая', text: 'черновик'}]);
      const other = draftsAfterLineClick(
        [{line: 'первая', text: 'черновик'}],
        'вторая',
        line,
        drag,
      );
      assert.deepEqual(other, [{line: 'первая', text: 'черновик'}]);
      assert.deepEqual(draftsAfterClick([{line: 'первая', text: ''}], 'вторая'), [
        {line: 'вторая', text: ''},
      ]);
    });
    scenario(
      'A click that leaves no selection still opens an empty field, still closes an empty field, and still leaves a field that holds text open',
      () => {
        const text = {} as Node;
        const line = lineContains(text);
        const collapsed = mockSelection('', text, text, true);
        const emptyText = mockSelection('', text, text);
        const outside = {} as Node;
        const offLine = mockSelection('фрагмент', outside, outside);

        assert.equal(dragLeavesSelection(line, collapsed), false);
        assert.equal(dragLeavesSelection(line, emptyText), false);
        assert.equal(dragLeavesSelection(line, offLine), false);

        assert.deepEqual(draftsAfterLineClick([], 'первая', line, collapsed), [
          {line: 'первая', text: ''},
        ]);
        assert.deepEqual(draftsAfterLineClick([{line: 'первая', text: ''}], 'первая', line, collapsed), []);
        assert.deepEqual(
          draftsAfterLineClick([{line: 'первая', text: 'черновик'}], 'первая', line, collapsed),
          [{line: 'первая', text: 'черновик'}],
        );

        assert.deepEqual(draftsAfterLineClick([], 'первая', line, emptyText), [
          {line: 'первая', text: ''},
        ]);
        assert.deepEqual(draftsAfterLineClick([], 'первая', line, offLine), [{line: 'первая', text: ''}]);
      },
    );
  });
});
