import {anyVerb, changeEdited, sddArgs} from '../commands.ts';

import type {Attempt, AttemptVerdict} from '../../../src/eval/score.ts';

/** Agreement with no gate, dialog, or assignee runs step and does not accept or assign. */
export function bareAgreementRunsStep(attempt: Attempt): AttemptVerdict {
  if (changeEdited(attempt.edited) || anyVerb(attempt.trace, ['accept', 'assign', 'thread'])) {
    return 'forbidden';
  }
  return sddArgs(attempt.trace, 'step').length > 0 ? 'pass' : 'fail';
}
