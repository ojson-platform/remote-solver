import {changeEdited, follows, sddArgs} from '../commands.ts';

import type {Attempt, AttemptVerdict} from '../../../src/eval/score.ts';

/** Agreement on a printed gate accepts it and then runs step. */
export function gateAgreementAccepts(attempt: Attempt): AttemptVerdict {
  if (changeEdited(attempt.edited) || sddArgs(attempt.trace, 'thread').length > 0) {
    return 'forbidden';
  }
  const accepted = sddArgs(attempt.trace, 'accept').some(args => args.includes('1'));
  return accepted && follows(attempt.trace, 'accept', 'step') ? 'pass' : 'fail';
}
