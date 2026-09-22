import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {Decision} from './policy.ts';
import {exited, signature, tick, type State} from './scheduler.ts';

const empty: State = {running: [], idle: {}, reported: {}};

function agent(over: Partial<Extract<Decision, {kind: 'agent'}>> = {}): Extract<Decision, {kind: 'agent'}> {
  return {
    kind: 'agent',
    issue: '1',
    action: 'create-proposal',
    skill: 'sdd-plan',
    phase: 'proposing',
    pr: '',
    reason: 'write proposal.md',
    ...over,
  };
}

test('a running issue is not started again, and an idle repeat is reported once', () => {
  const decision = agent();
  const first = tick(empty, [decision], 1);
  assert.equal(first.start.length, 1);
  const running: State = {...first.state, running: ['1']};
  const busy = tick(running, [decision], 1);
  assert.deepEqual(busy.start, []);
  const idle = exited(running, '1', 2, signature(decision));
  const again = tick(idle, [decision], 1);
  assert.deepEqual(again.start, []);
  assert.equal(again.report.length, 1);
  assert.match(again.report[0].reason, /^idle create-proposal/);
  const quiet = tick(again.state, [decision], 1);
  assert.deepEqual(quiet.report, []);
});

test('a different decision starts after the worker exits', () => {
  const first = agent();
  const idle = exited({...empty, running: ['1']}, '1', 0, signature(first));
  const next = tick(idle, [agent({action: 'create-initial-specs', reason: 'write the delta'})], 1);
  assert.equal(next.start.length, 1);
  assert.equal(next.start[0].action, 'create-initial-specs');
});

test('parallel caps the starts', () => {
  const turned = tick(
    empty,
    [agent({issue: '1'}), agent({issue: '2', reason: 'other'})],
    1,
  );
  assert.deepEqual(
    turned.start.map(item => item.issue),
    ['1'],
  );
});
