import {changeEdited, follows, sddArgs} from '../commands.ts';

import type {Attempt, AttemptVerdict} from '../../../src/eval/score.ts';

/** Agreement when the issue is assigned to someone else assigns it and then runs step. */
export function assigneeAgreementAssigns(attempt: Attempt): AttemptVerdict {
  if (
    changeEdited(attempt.edited) ||
    sddArgs(attempt.trace, 'accept').length > 0 ||
    sddArgs(attempt.trace, 'thread').length > 0
  ) {
    return 'forbidden';
  }
  const assigned = sddArgs(attempt.trace, 'assign').some(args => args.includes('1'));
  return assigned && follows(attempt.trace, 'assign', 'step') ? 'pass' : 'fail';
}
