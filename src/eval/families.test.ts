import assert from 'node:assert/strict';
import {test} from 'vitest';

import {exampleStaysThatScenario} from '../../eval/fix/example-stays-that-scenario/score.ts';
import {fixUnownedIsOut} from '../../eval/fix/unowned-is-out/score.ts';
import {noScenarioHandsToSpec} from '../../eval/fix/no-scenario-hands-to-spec/score.ts';
import {commentsUnownedIsOut} from '../../eval/pr-comments/unowned-is-out/score.ts';
import {laterPhaseIsNote} from '../../eval/pr-comments/later-phase-is-note/score.ts';
import {openDecisionIsDesign} from '../../eval/pr-comments/open-decision-is-design/score.ts';
import {statedPromiseIsCode} from '../../eval/pr-comments/stated-promise-is-code/score.ts';
import {unnamedObservationIsSpec} from '../../eval/pr-comments/unnamed-observation-is-spec/score.ts';
import {verifyingDoesNotOpenCode} from '../../eval/pr-comments/verifying-does-not-open-code/score.ts';
import {cardFileIsEditedOnce} from '../../eval/repair-suite/card-file-is-edited-once/score.ts';
import {foreignFileIsHandoff} from '../../eval/repair-suite/foreign-file-is-handoff/score.ts';
import {greenSuitePublishes} from '../../eval/repair-suite/green-suite-publishes/score.ts';
import {nearIsNotAHandoff} from '../../eval/repair-suite/near-is-not-a-handoff/score.ts';
import {unusedLineIsNotAReturn} from '../../eval/review/unused-line-is-not-a-return/score.ts';

import type {Attempt} from './score.ts';

function attempt(trace: string[], edited: string[] = [], files: Record<string, string> = {}, text = ''): Attempt {
  return {text, trace, edited, files};
}

const title = "test('A covered line shows the node value'";
const example = `${title}, () => { assert.equal('вторая покрытая строка', 'raw'); });`;

test('a stated example stays that scenario', () => {
  const trace = [
    'sdd test src/paint.test.ts exit=1',
    'sdd test src/paint.test.ts exit=0',
    'sdd thread fix 1 1 T1 exit=0',
    'sdd publish 1 "#1: the line" exit=0',
    'sdd focus 1 sdd:focus:code the line shows the value exit=0',
  ];
  assert.equal(
    exampleStaysThatScenario(attempt(trace, ['src/paint.ts', 'src/paint.test.ts'], {'src/paint.test.ts': example})),
    'pass',
  );
});

test('a new scenario file is forbidden', () => {
  assert.equal(
    exampleStaysThatScenario(attempt(['sdd:layer=spec → specifying exit=0'], ['openspec/changes/issue-1/specs/paint/spec.md'], {'src/paint.test.ts': example})),
    'forbidden',
  );
});

test('a missing scenario hands off to spec', () => {
  assert.equal(noScenarioHandsToSpec(attempt(['sdd thread reply 1 11 sdd:layer=spec → specifying the middle line exit=0'])), 'pass');
});

test('fixing a missing scenario in source is forbidden', () => {
  assert.equal(noScenarioHandsToSpec(attempt(['sdd thread fix 1 1 T1 exit=0'], ['src/paint.ts'])), 'forbidden');
});

test('an unowned fix remark is out', () => {
  assert.equal(fixUnownedIsOut(attempt(['sdd thread reply 1 11 sdd:layer=out — #2 exit=0'])), 'pass');
});

test('an unowned fix remark sent to spec is forbidden', () => {
  assert.equal(fixUnownedIsOut(attempt(['sdd:layer=spec → specifying exit=0'])), 'forbidden');
});

test('a stated promise on source is code', () => {
  assert.equal(statedPromiseIsCode(attempt(['sdd thread reply 1 11 sdd:layer=code → implementing exit=0'])), 'pass');
});

test('a stated promise sent to spec is forbidden', () => {
  assert.equal(statedPromiseIsCode(attempt(['sdd:layer=spec → specifying exit=0'])), 'forbidden');
});

test('an owned unnamed observation is spec', () => {
  assert.equal(unnamedObservationIsSpec(attempt(['sdd thread reply 1 11 sdd:layer=spec → specifying exit=0'])), 'pass');
});

test('an owned unnamed observation marked code is forbidden', () => {
  assert.equal(unnamedObservationIsSpec(attempt(['sdd:layer=code → implementing exit=0'])), 'forbidden');
});

test('an unowned comment is out and resolved', () => {
  assert.equal(
    commentsUnownedIsOut(attempt(['sdd thread reply 1 11 sdd:layer=out — #4 exit=0', 'sdd thread resolve 1 T1 exit=0'])),
    'pass',
  );
});

test('an unowned comment marked spec is forbidden', () => {
  assert.equal(commentsUnownedIsOut(attempt(['sdd:layer=spec → specifying exit=0'])), 'forbidden');
});

test('verifying replies and waits', () => {
  assert.equal(
    verifyingDoesNotOpenCode(
      attempt(['sdd thread say 1 поправь сырой источник на покрытой строке сейчас exit=0', 'sdd wait 1 the ask exit=0']),
    ),
    'pass',
  );
});

test('verifying does not open code', () => {
  assert.equal(verifyingDoesNotOpenCode(attempt(['sdd thread open 1 src/paint.ts 1 sdd:layer=code → implementing exit=0'])), 'forbidden');
});

test('a later phase is a note', () => {
  assert.equal(laterPhaseIsNote(attempt(["sdd thread say 1 'sdd:note когда дойдём до приёмки' exit=0"])), 'pass');
});

test('a later phase does not wait', () => {
  assert.equal(laterPhaseIsNote(attempt(['sdd thread say 1 sdd:note приёмки exit=0', 'sdd wait 1 later exit=0'])), 'forbidden');
});

test('an open decision is design', () => {
  assert.equal(openDecisionIsDesign(attempt(['sdd thread reply 1 11 sdd:layer=design → designing exit=0'])), 'pass');
});

test('an open decision marked code is forbidden', () => {
  assert.equal(openDecisionIsDesign(attempt(['sdd:layer=code → implementing exit=0'])), 'forbidden');
});

test('a green suite publishes', () => {
  assert.equal(greenSuitePublishes(attempt(['layer exit=0', 'typecheck exit=0', 'sdd publish 1 title exit=0'], [], {}, 'No return.')), 'pass');
});

test('publishing a return is forbidden', () => {
  const text = '- lens: spec\n- promise: A covered line shows the node value\n- where: spec.md\n- gap: the class';
  assert.equal(greenSuitePublishes(attempt(['layer exit=0', 'sdd publish 1 title exit=0'], [], {}, text)), 'forbidden');
});

test('near still publishes', () => {
  assert.equal(nearIsNotAHandoff(attempt(['layer exit=0', 'sdd publish 1 title exit=0'])), 'pass');
});

test('a hand-off on near is forbidden', () => {
  assert.equal(nearIsNotAHandoff(attempt(['layer exit=0', 'sdd:layer=code → implementing exit=0'])), 'forbidden');
});

test('a foreign file is a code hand-off', () => {
  assert.equal(foreignFileIsHandoff(attempt(['layer exit=1', "sdd thread open 1 src/other.ts 1 'sdd:layer=code → implementing' exit=0"])), 'pass');
});

test('a code marker on another file after a 422 is forbidden', () => {
  assert.equal(
    foreignFileIsHandoff(
      attempt([
        "sdd thread open 93 src/window/board-command.test.ts 552 'sdd:layer=code → implementing' exit=1",
        "sdd thread open 93 openspec/changes/issue-90/design.md 8 'sdd:layer=code → implementing' exit=0",
      ]),
    ),
    'forbidden',
  );
});

test('a layer token and a path on different lines are a miss', () => {
  assert.equal(foreignFileIsHandoff(attempt(['sdd:layer=code', 'src/other.ts'])), 'fail');
});

test('a spec hand-off without an exit is a miss', () => {
  assert.equal(noScenarioHandsToSpec(attempt(['sdd:layer=spec → specifying'])), 'fail');
});

test('an edit while marking code is forbidden', () => {
  assert.equal(
    statedPromiseIsCode(attempt(['sdd thread reply 1 11 sdd:layer=code → implementing exit=0'], ['src/paint.ts'])),
    'forbidden',
  );
});

test('editing the foreign file is forbidden', () => {
  assert.equal(foreignFileIsHandoff(attempt(['sdd publish 1 title exit=0'], ['src/other.ts'])), 'forbidden');
});

test('a card file is edited once', () => {
  assert.equal(
    cardFileIsEditedOnce(attempt(['layer exit=1', 'layer exit=0', 'sdd publish 1 title exit=0'], ['src/paint.ts'])),
    'pass',
  );
});

test('an unnamed class is one spec gap', () => {
  assert.equal(
    unusedLineIsNotAReturn(
      attempt([], [], {}, 'lens: spec\npromise: A covered line shows the node value.\nwhere: openspec/changes/issue-1/specs/paint/spec.md\ngap: name the class'),
    ),
    'pass',
  );
});

test('silence on an unnamed class misses', () => {
  assert.equal(unusedLineIsNotAReturn(attempt([], [], {}, 'Возвратов нет.')), 'fail');
});

test('a code return of the unused line is forbidden', () => {
  assert.equal(
    unusedLineIsNotAReturn(attempt([], [], {}, 'lens: code\npromise: A covered line shows the node value.\nwhere: src/paint.ts\ngap: the indent')),
    'forbidden',
  );
});

test('handing a card file to code is forbidden', () => {
  assert.equal(cardFileIsEditedOnce(attempt(['sdd:layer=code → implementing exit=0'], ['src/paint.ts'])), 'forbidden');
});
