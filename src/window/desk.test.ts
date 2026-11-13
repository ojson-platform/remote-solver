import assert from 'node:assert/strict';

import {test} from 'vitest';

import type {Decision} from '../machine/decide/types.ts';
import type {BranchFacts, BranchText} from '../machine/change/types.ts';
import type {WindowTicket} from './types.ts';
import {createDesk} from './desk.ts';

function ticket(key: string, labels: readonly string[]): WindowTicket {
  return {key, title: `#${key}`, labels};
}

function agent(action: 'create-tasks' | 'implement-next-task', phase: 'tasking' | 'implementing'): Decision {
  return {
    kind: 'agent',
    issue: '8',
    action,
    skill: action === 'create-tasks' ? 'tasks' : 'implement',
    phase,
    pr: '',
    reason: action,
  };
}

const gate: Decision = {
  kind: 'wait',
  issue: '8',
  reason: 'review the design',
  gate: {artifact: 'design', from: 'designing', to: 'designed'},
};

const facts = (fingerprint: string): BranchFacts => ({
  fingerprint,
  questions: 0,
  decisions: 0,
  specs: [],
});

const text: BranchText = {
  proposal: '',
  design: 'the design',
  tasks: '',
  specs: [],
  baselines: [],
};

test('a running step keeps its action when a later decision arrives', () => {
  const desk = createDesk();
  desk.noteWork('8', {kind: 'running', phase: 'implementing', action: 'implement-next-task'});
  desk.noteWork('8', {kind: 'settled', decision: agent('create-tasks', 'tasking')});
  const screen = desk.project('8');
  assert.equal(screen?.activity?.action, 'implement-next-task');
  assert.equal(screen?.reading, undefined);
});

test('a cleared step shows the settled review gate', () => {
  const desk = createDesk();
  desk.admit({id: 2, tickets: [ticket('8', ['sdd:designing'])]});
  desk.noteWork('8', {kind: 'clear'});
  desk.noteWork('8', {kind: 'settled', decision: gate});
  const screen = desk.project('8');
  assert.equal(screen?.activity, undefined);
  assert.equal(screen?.reading?.kind, 'wait');
  assert.equal(screen?.plaqueDecision, screen?.reading);
  assert.equal(screen?.station, 'designing');
});

test('hold does not cover a running key, and the header lists only running', () => {
  const desk = createDesk();
  desk.noteWork('6', {kind: 'running', phase: 'proposing', action: 'create-proposal'});
  desk.hold([
    {key: '6', phase: 'tasking', action: 'create-tasks'},
    {key: '7', phase: 'proposing', action: 'create-proposal'},
  ]);
  assert.equal(desk.project('6')?.activity?.action, 'create-proposal');
  assert.equal(desk.project('6')?.activity?.phase, 'proposing');
  assert.equal(desk.project('7')?.activity?.kind, 'held');
  const header = desk.projectHeader();
  assert.match(header, /#6 proposing → create-proposal/);
  assert.equal(header.includes('#7'), false);
  desk.noteWork('7', {
    kind: 'settled',
    decision: {
      kind: 'agent',
      issue: '7',
      action: 'create-tasks',
      skill: 'tasks',
      phase: 'tasking',
      pr: '',
      reason: 'write tasks',
    },
  });
  assert.equal(desk.project('7')?.activity?.kind, 'held');
  assert.equal(desk.project('7')?.activity?.action, 'create-proposal');
  assert.equal(desk.project('7')?.reading, undefined);
});

test('an older host packet and a failed branch read do not replace newer facts', () => {
  const desk = createDesk();
  desk.admit({id: 3, tickets: [ticket('8', ['sdd:implementing'])]});
  desk.noteBranch('8', {token: 4, fingerprint: 'new', facts: facts('new'), text});
  const before = desk.spineRevision('8');
  desk.admit({id: 2, tickets: [ticket('8', ['sdd:proposing'])]});
  desk.noteBranch('8', {token: 1, fingerprint: 'old', facts: facts('old')});
  desk.noteBranch('8', {token: 5, failed: true});
  assert.equal(desk.project('8')?.station, 'implementing');
  assert.equal(desk.project('8')?.facts?.fingerprint, 'new');
  assert.equal(desk.project('8')?.text?.design, 'the design');
  desk.noteWork('8', {kind: 'running', phase: 'implementing', action: 'implement-next-task'});
  assert.equal(desk.spineRevision('8'), before);
});

test('a wish labels the station until the host already has that label', () => {
  const desk = createDesk();
  desk.admit({id: 1, tickets: [ticket('8', [])]});
  desk.wish('8', {token: 1, key: '8', label: 'sdd:designing', on: true});
  assert.equal(desk.project('8')?.station, 'designing');
  desk.admit({id: 2, tickets: [ticket('8', ['sdd:designing'])]});
  desk.admit({id: 3, tickets: [ticket('8', [])]});
  assert.equal(desk.project('8')?.station, undefined);
});

test('a review gate stays on the plaque while a worker runs', () => {
  const desk = createDesk();
  desk.admit({id: 1, tickets: [ticket('8', ['sdd:designing'])]});
  desk.noteWork('8', {kind: 'settled', decision: gate});
  desk.noteWork('8', {kind: 'running', phase: 'designing', action: 'create-design'});
  const screen = desk.project('8');
  assert.equal(screen?.activity?.action, 'create-design');
  assert.equal(screen?.reading, undefined);
  assert.equal(screen?.plaqueDecision, gate);
});
