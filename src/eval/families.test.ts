import assert from 'node:assert/strict';
import {test} from 'vitest';

import {openDecisionStaysThatItem} from '../../eval/design/open-decision-stays-that-item/score.ts';
import {missingDesignIsWritten} from '../../eval/design/missing-design-is-written/score.ts';
import {openTaskStaysThatItem} from '../../eval/tasks/open-task-stays-that-item/score.ts';
import {exampleStaysThatScenario} from '../../eval/fix/example-stays-that-scenario/score.ts';
import {fixUnownedIsOut} from '../../eval/fix/unowned-is-out/score.ts';
import {noScenarioHandsToSpec} from '../../eval/fix/no-scenario-hands-to-spec/score.ts';
import {openQuestionStaysThatItem} from '../../eval/plan/open-question-stays-that-item/score.ts';
import {openQuestionsStayUnchecked} from '../../eval/plan/open-questions-stay-unchecked/score.ts';
import {planFocusNamesTheRefusal} from '../../eval/plan/plan-focus-names-the-refusal/score.ts';
import {planFocusSkipsTheOldRefusal} from '../../eval/plan/plan-focus-skips-the-old-refusal/score.ts';
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

const proposal = 'openspec/changes/issue-1/proposal.md';
const answered = `## Problem

The caller cannot tell two names apart.

## Outcome

One name is shown.

## Scope

The name on the card.

## Out of scope

none

## Open questions

- [x] Which name
  The name is distance.
`;

test('an open question is checked on its item', () => {
  assert.equal(
    openQuestionStaysThatItem(
      attempt(
        ['sdd commit 1 "#1: the name" exit=0', 'sdd thread fix 1 1 T1 exit=0'],
        [proposal],
        {[proposal]: answered},
      ),
    ),
    'pass',
  );
});

test('an unchecked question misses', () => {
  assert.equal(
    openQuestionStaysThatItem(
      attempt(
        ['sdd commit 1 "#1: the name" exit=0', 'sdd thread fix 1 1 T1 exit=0'],
        [proposal],
        {[proposal]: answered.replace('[x]', '[ ]')},
      ),
    ),
    'fail',
  );
});

test('a rewritten outcome misses', () => {
  assert.equal(
    openQuestionStaysThatItem(
      attempt(
        ['sdd commit 1 "#1: the name" exit=0', 'sdd thread fix 1 1 T1 exit=0'],
        [proposal],
        {[proposal]: answered.replace('One name is shown.', 'Two names are shown.')},
      ),
    ),
    'fail',
  );
});

test('a second commit misses', () => {
  assert.equal(
    openQuestionStaysThatItem(
      attempt(
        ['sdd commit 1 "#1: the name" exit=0', 'sdd commit 1 "#1: again" exit=0', 'sdd thread fix 1 1 T1 exit=0'],
        [proposal],
        {[proposal]: answered},
      ),
    ),
    'fail',
  );
});

test('a fix before the commit misses', () => {
  assert.equal(
    openQuestionStaysThatItem(
      attempt(
        ['sdd thread fix 1 1 T1 exit=0', 'sdd commit 1 "#1: the name" exit=0'],
        [proposal],
        {[proposal]: answered},
      ),
    ),
    'fail',
  );
});

test('editing another change file is forbidden', () => {
  assert.equal(
    openQuestionStaysThatItem(
      attempt(
        ['sdd commit 1 "#1: the name" exit=0', 'sdd thread fix 1 1 T1 exit=0'],
        [proposal, 'openspec/changes/issue-1/design.md'],
        {[proposal]: answered},
      ),
    ),
    'forbidden',
  );
});

test('handing a card file to code is forbidden', () => {
  assert.equal(cardFileIsEditedOnce(attempt(['sdd:layer=code → implementing exit=0'], ['src/paint.ts'])), 'forbidden');
});

const design = 'openspec/changes/issue-1/design.md';
const decided = `## Approach

none

## Verification boundary

one-file: the card test

## Open decisions

- [x] Which name
  The name is distance.
`;

test('an open decision is checked on its item', () => {
  assert.equal(
    openDecisionStaysThatItem(
      attempt(
        ['sdd commit 1 "#1: the name" exit=0', 'sdd thread fix 1 1 T1 exit=0'],
        [design],
        {[design]: decided},
      ),
    ),
    'pass',
  );
});

test('an unchecked decision misses', () => {
  assert.equal(
    openDecisionStaysThatItem(
      attempt(
        ['sdd commit 1 "#1: the name" exit=0', 'sdd thread fix 1 1 T1 exit=0'],
        [design],
        {[design]: decided.replace('[x]', '[ ]')},
      ),
    ),
    'fail',
  );
});

const taskList = 'openspec/changes/issue-1/tasks.md';
const card = `## Source

\`src/card.ts\`
`;
const listed = `- [x] \`card\` Which name
  The name is distance.
`;

test('an open task item is checked in place', () => {
  assert.equal(
    openTaskStaysThatItem(
      attempt(
        ['sdd commit 1 "#1: the name" exit=0', 'sdd thread fix 1 1 T1 exit=0'],
        [taskList],
        {
          [taskList]: listed,
          'openspec/changes/issue-1/tasks/card.md': `- The card shows one name\nsdd-delta: rev-1\n\n${card}`,
        },
      ),
    ),
    'pass',
  );
});

test('an unchecked task item misses', () => {
  assert.equal(
    openTaskStaysThatItem(
      attempt(
        ['sdd commit 1 "#1: the name" exit=0', 'sdd thread fix 1 1 T1 exit=0'],
        [taskList],
        {
          [taskList]: listed.replace('[x]', '[ ]'),
          'openspec/changes/issue-1/tasks/card.md': `- The card shows one name\nsdd-delta: rev-1\n\n${card}`,
        },
      ),
    ),
    'fail',
  );
});

test('editing the task card is forbidden', () => {
  assert.equal(
    openTaskStaysThatItem(
      attempt(
        ['sdd commit 1 "#1: the name" exit=0', 'sdd thread fix 1 1 T1 exit=0'],
        [taskList, 'openspec/changes/issue-1/tasks/card.md'],
        {
          [taskList]: listed,
          'openspec/changes/issue-1/tasks/card.md': `- The card shows one name\nsdd-delta: rev-1\n\n${card}`,
        },
      ),
    ),
    'forbidden',
  );
});

test('editing the proposal while deciding is forbidden', () => {
  assert.equal(
    openDecisionStaysThatItem(
      attempt(
        ['sdd commit 1 "#1: the name" exit=0', 'sdd thread fix 1 1 T1 exit=0'],
        [design, 'openspec/changes/issue-1/proposal.md'],
        {[design]: decided},
      ),
    ),
    'forbidden',
  );
});

const openProposal = `## Problem

The caller cannot tell two names apart.

## Outcome

One name is shown.

## Scope

The name on the card.

## Open questions

- [ ] Which name

## Shelf
`;

const quietFocus = [
  'sdd publish 1 "#1: one name" exit=0',
  'sdd focus 1 sdd:focus:plan',
  'Читатель тикета видит одно имя на карточке. От этого отказались. exit=0',
];

test('open questions stay unchecked through publish', () => {
  assert.equal(
    openQuestionsStayUnchecked(attempt(quietFocus, [], {'openspec/changes/issue-1/proposal.md': openProposal})),
    'pass',
  );
});

test('a checked question misses', () => {
  assert.equal(
    openQuestionsStayUnchecked(
      attempt(quietFocus, [], {
        'openspec/changes/issue-1/proposal.md': openProposal.replace('[ ]', '[x]'),
      }),
    ),
    'fail',
  );
});

test('a focus that counts open questions misses', () => {
  assert.equal(
    openQuestionsStayUnchecked(
      attempt(
        [
          'sdd publish 1 "#1: one name" exit=0',
          'sdd focus 1 sdd:focus:plan',
          'Читатель тикета видит одно имя. От этого отказались.',
          'В предложении 2 открытых вопроса. exit=0',
        ],
        [],
        {'openspec/changes/issue-1/proposal.md': openProposal},
      ),
    ),
    'fail',
  );
});

test('waiting on an open question misses', () => {
  assert.equal(
    openQuestionsStayUnchecked(
      attempt(
        [...quietFocus, 'sdd wait 1 "which name" exit=0'],
        [],
        {'openspec/changes/issue-1/proposal.md': openProposal},
      ),
    ),
    'fail',
  );
});

test('setting the proposal gate label misses', () => {
  assert.equal(
    openQuestionsStayUnchecked(
      attempt(
        [...quietFocus, 'sdd label 1 sdd:proposed exit=0'],
        [],
        {'openspec/changes/issue-1/proposal.md': openProposal},
      ),
    ),
    'fail',
  );
});

const writtenDesign = `## Verification boundary

one-file: the card test

## Approach

none

The card shows one name.
`;

test('a missing design is written from the spec', () => {
  assert.equal(
    missingDesignIsWritten(
      attempt([], ['openspec/changes/issue-1/design.md'], {'openspec/changes/issue-1/design.md': writtenDesign}),
    ),
    'pass',
  );
});

test('a missing design that skips the scenario misses', () => {
  assert.equal(
    missingDesignIsWritten(
      attempt(
        [],
        ['openspec/changes/issue-1/design.md'],
        {'openspec/changes/issue-1/design.md': writtenDesign.replace('The card shows one name.', '')},
      ),
    ),
    'fail',
  );
});

test('editing the spec while writing the design is forbidden', () => {
  assert.equal(
    missingDesignIsWritten(
      attempt(
        [],
        ['openspec/changes/issue-1/design.md', 'openspec/changes/issue-1/specs/card/spec.md'],
        {'openspec/changes/issue-1/design.md': writtenDesign},
      ),
    ),
    'forbidden',
  );
});

const refused = `The caller cannot tell two names apart.
One name is shown.
The name on the card.

## Out of scope

Отказались вести ledger.

## Open questions

- [ ] Which name

## Shelf
`;

const firstFocus = [
  'sdd publish 1 "#1: one name" exit=0',
  'sdd focus 1 sdd:focus:plan',
  'Читатель тикета видит одно имя на карточке. Отказались вести ledger. exit=0',
];

test('a first plan visit names the refusal', () => {
  assert.equal(
    planFocusNamesTheRefusal(attempt(firstFocus, [], {'openspec/changes/issue-1/proposal.md': refused})),
    'pass',
  );
});

test('a first plan visit that skips the refusal misses', () => {
  assert.equal(
    planFocusNamesTheRefusal(
      attempt(
        [
          'sdd publish 1 "#1: one name" exit=0',
          'sdd focus 1 sdd:focus:plan',
          'Читатель тикета видит одно имя на карточке. exit=0',
        ],
        [],
        {'openspec/changes/issue-1/proposal.md': refused},
      ),
    ),
    'fail',
  );
});

const answeredProposal = refused.replace('- [ ] Which name', '- [x] Which name\n  The name is distance.');

const laterFocus = [
  'sdd thread fix 1 1 T1 exit=0',
  'sdd focus 1 sdd:focus:plan',
  'В этом коммите на карточке имя distance. exit=0',
];

test('a later plan visit leaves the old refusal', () => {
  assert.equal(
    planFocusSkipsTheOldRefusal(attempt(laterFocus, [], {'openspec/changes/issue-1/proposal.md': answeredProposal})),
    'pass',
  );
});

test('a later plan visit that repeats the old refusal misses', () => {
  assert.equal(
    planFocusSkipsTheOldRefusal(
      attempt(
        [
          'sdd thread fix 1 1 T1 exit=0',
          'sdd focus 1 sdd:focus:plan',
          'В этом коммите имя distance. Отказались вести ledger. exit=0',
        ],
        [],
        {'openspec/changes/issue-1/proposal.md': answeredProposal},
      ),
    ),
    'fail',
  );
});
