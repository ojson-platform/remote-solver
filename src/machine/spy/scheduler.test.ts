import assert from 'node:assert/strict';
import {test} from 'vitest';

import type {Decision} from '../decide/policy.ts';
import {exited, tick, type State} from './scheduler.ts';

const empty: State = {running: [], reported: {}};

function agent(over: Partial<Extract<Decision, {kind: 'agent'}>> = {}): Extract<Decision, {kind: 'agent'}> {
  return {
    kind: 'agent',
    issue: '1',
    action: 'create-proposal',
    skill: 'plan',
    phase: 'proposing',
    pr: '',
    reason: 'write proposal.md',
    ...over,
  };
}

test('a running issue is not started again, and a repeated wait is reported once', () => {
  const decision = agent();
  const first = tick(empty, [decision], 1);
  assert.equal(first.start.length, 1);
  const running: State = {...first.state, running: ['1']};
  const busy = tick(running, [decision], 1);
  assert.deepEqual(busy.start, []);
  const left = exited(running, '1');
  const waiting: Decision = {kind: 'wait', issue: '1', reason: 'refused create-proposal: write proposal.md'};
  const again = tick(left, [waiting], 1);
  assert.deepEqual(again.start, []);
  assert.equal(again.report.length, 1);
  assert.match(again.report[0].reason, /^refused create-proposal/);
  const quiet = tick(again.state, [waiting], 1);
  assert.deepEqual(quiet.report, []);
});

test('a different decision starts after the worker exits', () => {
  const left = exited({...empty, running: ['1']}, '1');
  const next = tick(left, [agent({action: 'create-initial-specs', reason: 'write the delta'})], 1);
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
