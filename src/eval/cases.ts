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
import {returnDoesNotPublish} from '../../eval/repair-suite/return-does-not-publish/score.ts';
import {classNamedNoReturn} from '../../eval/review/class-named-no-return/score.ts';
import {ownExampleFailsCode} from '../../eval/review/own-example-fails-code/score.ts';
import {specimenIsSpec} from '../../eval/review/specimen-is-spec/score.ts';

import type {Attempt, AttemptVerdict} from './score.ts';

export const familyNames = ['review', 'fix', 'pr-comments', 'repair-suite'] as const;

export type EvalCase = {
  id: string;
  family: (typeof familyNames)[number];
  /** `skill` reads the final-review file. `assembled-step` prints the step with this checkout's hooks. */
  prompt: 'skill' | 'assembled-step';
  skill: string;
  action: string;
  score: (attempt: Attempt) => AttemptVerdict;
};

/** Every case the plan names. The runner filters by family. */
export const cases: EvalCase[] = [
  {id: 'specimen-is-spec', family: 'review', prompt: 'skill', skill: 'sdd-final-review', action: 'review', score: specimenIsSpec},
  {id: 'class-named-no-return', family: 'review', prompt: 'skill', skill: 'sdd-final-review', action: 'review', score: classNamedNoReturn},
  {id: 'own-example-fails-code', family: 'review', prompt: 'skill', skill: 'sdd-final-review', action: 'review', score: ownExampleFailsCode},
  {id: 'example-stays-that-scenario', family: 'fix', prompt: 'assembled-step', skill: 'fix', action: 'fix', score: exampleStaysThatScenario},
  {id: 'no-scenario-hands-to-spec', family: 'fix', prompt: 'assembled-step', skill: 'fix', action: 'fix', score: noScenarioHandsToSpec},
  {id: 'unowned-is-out', family: 'fix', prompt: 'assembled-step', skill: 'fix', action: 'fix', score: fixUnownedIsOut},
  {id: 'stated-promise-is-code', family: 'pr-comments', prompt: 'assembled-step', skill: 'pr-comments', action: 'pr-comments', score: statedPromiseIsCode},
  {id: 'unnamed-observation-is-spec', family: 'pr-comments', prompt: 'assembled-step', skill: 'pr-comments', action: 'pr-comments', score: unnamedObservationIsSpec},
  {id: 'unowned-is-out', family: 'pr-comments', prompt: 'assembled-step', skill: 'pr-comments', action: 'pr-comments', score: commentsUnownedIsOut},
  {id: 'verifying-does-not-open-code', family: 'pr-comments', prompt: 'assembled-step', skill: 'pr-comments', action: 'pr-comments', score: verifyingDoesNotOpenCode},
  {id: 'later-phase-is-note', family: 'pr-comments', prompt: 'assembled-step', skill: 'pr-comments', action: 'pr-comments', score: laterPhaseIsNote},
  {id: 'open-decision-is-design', family: 'pr-comments', prompt: 'assembled-step', skill: 'pr-comments', action: 'pr-comments', score: openDecisionIsDesign},
  {id: 'green-suite-publishes', family: 'repair-suite', prompt: 'assembled-step', skill: 'repair-suite', action: 'repair-suite', score: greenSuitePublishes},
  {id: 'near-is-not-a-handoff', family: 'repair-suite', prompt: 'assembled-step', skill: 'repair-suite', action: 'repair-suite', score: nearIsNotAHandoff},
  {id: 'foreign-file-is-handoff', family: 'repair-suite', prompt: 'assembled-step', skill: 'repair-suite', action: 'repair-suite', score: foreignFileIsHandoff},
  {id: 'card-file-is-edited-once', family: 'repair-suite', prompt: 'assembled-step', skill: 'repair-suite', action: 'repair-suite', score: cardFileIsEditedOnce},
  {id: 'return-does-not-publish', family: 'repair-suite', prompt: 'assembled-step', skill: 'repair-suite', action: 'repair-suite', score: returnDoesNotPublish},
];

export function requestedFamily(argv: string[]): string | undefined {
  const args = argv.filter(arg => arg !== '--');
  return args.find(arg => !arg.startsWith('-'));
}

export function commandExit(verdicts: Array<'pass' | 'fail' | 'inconclusive'>): number {
  if (verdicts.includes('fail')) {
    return 1;
  }
  if (verdicts.includes('inconclusive')) {
    return 2;
  }
  return 0;
}
