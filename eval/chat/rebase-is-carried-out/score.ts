import {changeEdited, follows, sddArgs} from '../commands.ts';

import type {Attempt, AttemptVerdict} from '../../../src/eval/score.ts';

/** Carrying out a rebase uses the printed base, then step. Recording the open question instead is forbidden. */
export function rebaseIsCarriedOut(attempt: Attempt): AttemptVerdict {
  if (
    changeEdited(attempt.edited) ||
    sddArgs(attempt.trace, 'thread').length > 0 ||
    sddArgs(attempt.trace, 'accept').length > 0
  ) {
    return 'forbidden';
  }
  const ontoTrunk = sddArgs(attempt.trace, 'rebase').some(
    args => args.includes('1') && args.includes('trunk'),
  );
  return ontoTrunk && follows(attempt.trace, 'rebase', 'step') ? 'pass' : 'fail';
}
