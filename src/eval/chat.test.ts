import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chmodSync, cpSync, mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

import {test} from 'vitest';

import {assigneeAgreementAssigns} from '../../eval/chat/assignee-agreement-assigns/score.ts';
import {bareAgreementRunsStep} from '../../eval/chat/bare-agreement-runs-step/score.ts';
import {changePublishesAndUnwaits} from '../../eval/chat/change-publishes-and-unwaits/score.ts';
import {dialogAnswerIsAThread} from '../../eval/chat/dialog-answer-is-a-thread/score.ts';
import {dialogCloseStops} from '../../eval/chat/dialog-close-stops/score.ts';
import {gateAgreementAccepts} from '../../eval/chat/gate-agreement-accepts/score.ts';
import {invocationDoesNotAccept} from '../../eval/chat/invocation-does-not-accept/score.ts';
import {rebaseIsCarriedOut} from '../../eval/chat/rebase-is-carried-out/score.ts';
import {recordDidNotClose} from '../../eval/chat/record-did-not-close/score.ts';
import {skipStops} from '../../eval/chat/skip-stops/score.ts';
import {whereIsTheCycle} from '../../eval/chat/where-is-the-cycle/score.ts';
import {skillMode} from '../machine/skill/mode.ts';

import {prepareSession, sessionPrompt} from './session.ts';

import type {EvalCase} from './cases.ts';
import type {Attempt} from './score.ts';

const root = path.join(import.meta.dirname, '..', '..');
const proposal = 'openspec/changes/issue-1/proposal.md';
const problem =
  'The problem is described with several sentences so the request has something to shorten.';
const opened = `sdd thread open 9 ${proposal} 5 'sdd:layer=proposal → proposing The name is distance' exit=0`;

function attempt(
  trace: string[],
  edited: string[] = [],
  files: Record<string, string> = {},
): Attempt {
  return {text: '', trace, edited, files};
}

function sessionCase(id: string, score: EvalCase['score']): EvalCase {
  return {id, family: 'chat', prompt: 'session', skill: 'sdd-flow', action: 'chat', score};
}

test('the session prompt is the live skill, the printed decision, and the next message', () => {
  const prompt = sessionPrompt(sessionCase('where-is-the-cycle', whereIsTheCycle), root);
  assert.equal(skillMode(prompt), 'judgment');
  assert.doesNotMatch(prompt, /^-/);
  assert.match(prompt, /name: sdd-flow/);
  assert.match(prompt, /A message that only asks where the cycle is/);
  assert.match(prompt, /Что дальше\?/);
  assert.match(prompt, /Which name/);
});

test('the session checkout reprints the decision and names the printed queue', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'eval-session-'));
  try {
    prepareSession(cwd, root, sessionCase('where-is-the-cycle', whereIsTheCycle));
    const stub = path.join(cwd, 'bin/sdd');
    cpSync(path.join(root, 'eval/chat/stub.sh'), stub);
    chmodSync(stub, 0o755);
    const trace = path.join(cwd, 'trace.log');
    const env = {...process.env, EVAL_TRACE: trace};
    const printed = execFileSync(stub, ['step', '1'], {cwd, env, encoding: 'utf8'});
    const gitEnv = {
      ...env,
      GIT_AUTHOR_NAME: 'eval',
      GIT_AUTHOR_EMAIL: 'eval@example.com',
      GIT_COMMITTER_NAME: 'eval',
      GIT_COMMITTER_EMAIL: 'eval@example.com',
    };
    execFileSync('git', ['init', '-b', 'sdd/1'], {cwd, env: gitEnv});
    execFileSync('git', ['commit', '--allow-empty', '-m', 'change'], {cwd, env: gitEnv});
    const before = execFileSync('git', ['rev-parse', 'HEAD'], {cwd, encoding: 'utf8'});
    execFileSync(stub, ['rebase', '1', 'trunk'], {cwd, env, encoding: 'utf8'});
    const after = execFileSync('git', ['rev-parse', 'HEAD'], {cwd, encoding: 'utf8'});
    assert.notEqual(before, after);
    assert.match(printed, /Which name/);
    assert.match(readFileSync(trace, 'utf8'), /sdd step 1 exit=0/);
    assert.match(readFileSync(trace, 'utf8'), /sdd rebase 1 trunk exit=0/);
    assert.match(readFileSync(path.join(cwd, 'openspec/config.yaml'), 'utf8'), /Sandcastle/);
    assert.match(readFileSync(path.join(cwd, 'skills/sdd-flow/CONTEXT.md'), 'utf8'), /sdd rebase/);
  } finally {
    rmSync(cwd, {recursive: true, force: true});
  }
});

test('a recorded answer leaves the question out of the next step', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'eval-dialog-'));
  try {
    prepareSession(cwd, root, sessionCase('dialog-answer-is-a-thread', dialogAnswerIsAThread));
    const stub = path.join(cwd, 'bin/sdd');
    cpSync(path.join(root, 'eval/chat/stub.sh'), stub);
    chmodSync(stub, 0o755);
    execFileSync(stub, ['thread', 'open', '9', proposal, '5', 'answer'], {cwd, encoding: 'utf8'});
    const printed = execFileSync(stub, ['step', '1'], {cwd, encoding: 'utf8'});
    assert.match(printed, /the answer is on the pull/);
    assert.doesNotMatch(printed, /Which name/);
  } finally {
    rmSync(cwd, {recursive: true, force: true});
  }
});

test('a question about the cycle runs step', () => {
  assert.equal(whereIsTheCycle(attempt(['sdd step 1 exit=0'])), 'pass');
});

test('recording that question is forbidden', () => {
  assert.equal(
    whereIsTheCycle(attempt(['sdd thread open 9 proposal.md 5 answer exit=0'])),
    'forbidden',
  );
});

test('silence on where the cycle is misses', () => {
  assert.equal(whereIsTheCycle(attempt([])), 'fail');
});

test('a rebase onto the printed base runs step after it', () => {
  assert.equal(
    rebaseIsCarriedOut(attempt(['sdd rebase 1 trunk exit=0', 'sdd step 1 exit=0'])),
    'pass',
  );
});

test('a rebase onto another base misses', () => {
  assert.equal(
    rebaseIsCarriedOut(attempt(['sdd rebase 1 master exit=0', 'sdd step 1 exit=0'])),
    'fail',
  );
});

test('answering the question instead of rebasing is forbidden', () => {
  assert.equal(rebaseIsCarriedOut(attempt([opened, 'sdd step 1 exit=0'])), 'forbidden');
});

test("an answer is the record with the person's words, then step", () => {
  assert.equal(dialogAnswerIsAThread(attempt([opened, 'sdd step 1 exit=0'])), 'pass');
});

test('the stub trace has no quotes around the answer', () => {
  const line = `sdd thread open 9 ${proposal} 5 sdd:layer=proposal → proposing The name is distance exit=0`;
  assert.equal(dialogAnswerIsAThread(attempt([line, 'sdd step 1 exit=0'])), 'pass');
});

test('editing the change instead of recording the answer is forbidden', () => {
  assert.equal(
    dialogAnswerIsAThread(attempt([opened, 'sdd step 1 exit=0'], [proposal])),
    'forbidden',
  );
});

test("a thread without the person's words misses", () => {
  assert.equal(
    dialogAnswerIsAThread(
      attempt([
        `sdd thread open 9 ${proposal} 5 'sdd:layer=proposal → proposing distance' exit=0`,
        'sdd step 1 exit=0',
      ]),
    ),
    'fail',
  );
});

test('a second thread open misses', () => {
  assert.equal(dialogAnswerIsAThread(attempt([opened, opened, 'sdd step 1 exit=0'])), 'fail');
});

test("the person's words inside a longer answer miss", () => {
  assert.equal(
    dialogAnswerIsAThread(
      attempt([
        `sdd thread open 9 ${proposal} 5 'sdd:layer=proposal → proposing The name is distance today' exit=0`,
        'sdd step 1 exit=0',
      ]),
    ),
    'fail',
  );
});

test('a skip stops without a record', () => {
  assert.equal(skipStops({text: 'Skipped.', trace: [], edited: [], files: {}}), 'pass');
});

test('a silent attempt is not a skip', () => {
  assert.equal(skipStops(attempt([])), 'fail');
});

test('stepping after a skip misses', () => {
  assert.equal(skipStops({text: 'Skipped.', trace: ['sdd step 1 exit=0'], edited: [], files: {}}), 'fail');
});

test('recording a skip misses', () => {
  assert.equal(skipStops({text: 'Skipped.', trace: [opened], edited: [], files: {}}), 'fail');
});

test('editing the change on a skip is forbidden', () => {
  assert.equal(skipStops({text: 'Skipped.', trace: [], edited: [proposal], files: {}}), 'forbidden');
});

test('closing the dialog records nothing', () => {
  assert.equal(dialogCloseStops({text: 'Closed.', trace: [], edited: [], files: {}}), 'pass');
});

test('a silent close is not a stop', () => {
  assert.equal(dialogCloseStops(attempt([])), 'fail');
});

test('recording a closed dialog misses', () => {
  assert.equal(dialogCloseStops({text: 'Closed.', trace: [opened], edited: [], files: {}}), 'fail');
});

test('stepping after a closed dialog misses', () => {
  assert.equal(
    dialogCloseStops({text: 'Closed.', trace: ['sdd step 1 exit=0'], edited: [], files: {}}),
    'fail',
  );
});

test('editing the change when the dialog is closed is forbidden', () => {
  assert.equal(
    dialogCloseStops({text: 'Closed.', trace: [], edited: [proposal], files: {}}),
    'forbidden',
  );
});

test('one record and a step that still lists the entry stops', () => {
  assert.equal(
    recordDidNotClose({
      text: 'The record did not close it.',
      trace: [opened, 'sdd step 1 exit=0'],
      edited: [],
      files: {},
    }),
    'pass',
  );
});

test('the stub trace without quotes stops when the entry stays', () => {
  const line = `sdd thread open 9 ${proposal} 5 sdd:layer=proposal → proposing The name is distance exit=0`;
  assert.equal(
    recordDidNotClose({
      text: 'The record did not close it.',
      trace: [line, 'sdd step 1 exit=0'],
      edited: [],
      files: {},
    }),
    'pass',
  );
});

test('a second record misses when the entry stays', () => {
  assert.equal(
    recordDidNotClose({
      text: 'The record did not close it.',
      trace: [opened, 'sdd step 1 exit=0', opened],
      edited: [],
      files: {},
    }),
    'fail',
  );
});

test('posting the answer another way misses', () => {
  assert.equal(
    recordDidNotClose({
      text: 'The record did not close it.',
      trace: [opened, 'sdd step 1 exit=0', 'sdd thread say 9 still open exit=0'],
      edited: [],
      files: {},
    }),
    'fail',
  );
});

test('stopping before the step misses', () => {
  assert.equal(
    recordDidNotClose({text: 'The record did not close it.', trace: [opened], edited: [], files: {}}),
    'fail',
  );
});

test('a silent record is not the stop', () => {
  assert.equal(recordDidNotClose(attempt([opened, 'sdd step 1 exit=0'])), 'fail');
});

test('editing the change when the entry stays is forbidden', () => {
  assert.equal(
    recordDidNotClose({
      text: 'The record did not close it.',
      trace: [opened, 'sdd step 1 exit=0'],
      edited: [proposal],
      files: {},
    }),
    'forbidden',
  );
});

test('a step after the record still prints the question when no later decision is copied', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'eval-still-open-'));
  try {
    prepareSession(cwd, root, sessionCase('record-did-not-close', recordDidNotClose));
    const stub = path.join(cwd, 'bin/sdd');
    cpSync(path.join(root, 'eval/chat/stub.sh'), stub);
    chmodSync(stub, 0o755);
    execFileSync(stub, ['thread', 'open', '9', proposal, '5', 'answer'], {cwd, encoding: 'utf8'});
    const printed = execFileSync(stub, ['step', '1'], {cwd, encoding: 'utf8'});
    assert.match(printed, /Which name/);
  } finally {
    rmSync(cwd, {recursive: true, force: true});
  }
});

test('agreement on a gate accepts and then runs step', () => {
  assert.equal(gateAgreementAccepts(attempt(['sdd accept 1 exit=0', 'sdd step 1 exit=0'])), 'pass');
});

test('step alone does not accept a gate', () => {
  assert.equal(gateAgreementAccepts(attempt(['sdd step 1 exit=0'])), 'fail');
});

test('agreement with no signal runs step', () => {
  assert.equal(bareAgreementRunsStep(attempt(['sdd step 1 exit=0'])), 'pass');
});

test('accepting a wait that has no gate is forbidden', () => {
  assert.equal(
    bareAgreementRunsStep(attempt(['sdd accept 1 exit=0', 'sdd step 1 exit=0'])),
    'forbidden',
  );
});

test('a later invocation runs step and does not accept', () => {
  assert.equal(invocationDoesNotAccept(attempt(['sdd step 1 exit=0'])), 'pass');
});

test('accepting from a later invocation is forbidden', () => {
  assert.equal(invocationDoesNotAccept(attempt(['sdd accept 1 exit=0'])), 'forbidden');
});

test('agreement to take the issue assigns it and then runs step', () => {
  assert.equal(
    assigneeAgreementAssigns(attempt(['sdd assign 1 exit=0', 'sdd step 1 exit=0'])),
    'pass',
  );
});

test('taking the issue without step misses', () => {
  assert.equal(assigneeAgreementAssigns(attempt(['sdd assign 1 exit=0'])), 'fail');
});

test('a change is published, the wait is cleared, and step runs', () => {
  const body = '# Proposal\n\n## Problem\n\nThe distance has a name.\n';
  const trace = [
    'sdd commit 1 "#1: shorter" exit=0',
    'sdd publish 1 "#1: shorter" exit=0',
    'sdd unwait 1 exit=0',
    'sdd step 1 exit=0',
  ];
  assert.equal(changePublishesAndUnwaits(attempt(trace, [proposal], {[proposal]: body})), 'pass');
});

test('leaving the problem and answering the question is forbidden', () => {
  assert.equal(
    changePublishesAndUnwaits(attempt([opened], [], {[proposal]: problem})),
    'forbidden',
  );
});

test('an edit that keeps the old problem misses', () => {
  const trace = [
    'sdd commit 1 "#1: shorter" exit=0',
    'sdd publish 1 "#1: shorter" exit=0',
    'sdd unwait 1 exit=0',
    'sdd step 1 exit=0',
  ];
  assert.equal(
    changePublishesAndUnwaits(
      attempt(trace, [proposal], {[proposal]: `# Proposal\n\n## Problem\n\n${problem}\n`}),
    ),
    'fail',
  );
});
