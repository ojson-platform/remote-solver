import assert from 'node:assert/strict';
import {test} from 'vitest';

import {orphans, parseProcessTable} from './reap.ts';

test('a process table row is a pid and its parent', () => {
  assert.deepEqual(parseProcessTable('  10  1\n20 10\n\n'), [
    {pid: 10, ppid: 1},
    {pid: 20, ppid: 10},
  ]);
});

test('a process that left the tree is reaped and one that remains is kept', () => {
  const seen = new Set<number>();
  const alive = [
    {pid: 10, ppid: 1},
    {pid: 20, ppid: 10},
    {pid: 30, ppid: 20},
    {pid: 99, ppid: 1},
  ];
  assert.deepEqual(orphans(10, alive, seen), []);
  assert.deepEqual([...seen].sort(), [20, 30]);
  assert.deepEqual(
    orphans(
      10,
      [
        {pid: 10, ppid: 1},
        {pid: 20, ppid: 10},
        {pid: 30, ppid: 1},
        {pid: 99, ppid: 1},
      ],
      seen,
    ),
    [30],
  );
});
