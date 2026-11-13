import assert from 'node:assert/strict';

import {test} from 'vitest';

import {machine, turn} from '../adapters/compose.ts';
import {memoryPorts} from '../adapters/tracker/github.ts';
import {planFiles, planIssue} from '../machine/__tests__/harness.ts';
import {phaseOf} from '../machine/phase/phase.ts';
import {createDesk} from './desk.ts';

test('a closed reading is the decision step prints', async () => {
  const {tracker, review} = memoryPorts({
    issues: [planIssue('1', ['Sandcastle', 'sdd:cycle', 'sdd:proposed'])],
  });
  const box = machine(process.cwd(), {
    config: {queues: [{name: 'Sandcastle'}]},
    tracker,
    review,
    vcs: {
      filesAt: planFiles,
      compare: () => null,
      push() {},
      head: () => '',
      published: () => true,
      dirty: () => [],
      tipMessage: async () => '',
    },
    runtime: {
      async run() {
        return {commits: 0};
      },
      async ask() {
        return {text: ''};
      },
    },
  });
  const decision = await turn(box, '1');
  const labels = await tracker.labels('1');
  const desk = createDesk();
  assert.equal(
    desk.admit({id: 1, tickets: [{key: '1', title: 'One', labels}], reviews: new Map()}),
    true,
  );
  desk.noteWork('1', {kind: 'settled', decision});
  const screen = desk.project('1');
  assert.deepEqual(screen?.reading, decision);
  assert.equal(screen?.activity, undefined);
  assert.equal(screen?.station, phaseOf([...labels]) ?? undefined);
});

test('a running step keeps an older decision off the reading', () => {
  const desk = createDesk();
  desk.admit({
    id: 1,
    tickets: [{key: '1', title: 'One', labels: ['sdd:implementing']}],
    reviews: new Map(),
  });
  desk.noteWork('1', {kind: 'running', phase: 'implementing', action: 'implement-next-task'});
  desk.noteWork('1', {
    kind: 'settled',
    decision: {
      kind: 'agent',
      issue: '1',
      action: 'create-tasks',
      skill: 'tasks',
      phase: 'tasking',
      pr: '',
      reason: 'write tasks',
    },
  });
  const screen = desk.project('1');
  assert.equal(screen?.reading, undefined);
  assert.equal(screen?.activity?.action, 'implement-next-task');
});
