import {changeEdited, sddArgs} from '../commands.ts';

import type {Attempt, AttemptVerdict} from '../../../src/eval/score.ts';

/** A later `/sdd-flow` runs step and does not accept the printed gate. */
export function invocationDoesNotAccept(attempt: Attempt): AttemptVerdict {
  if (changeEdited(attempt.edited) || sddArgs(attempt.trace, 'accept').length > 0) {
    return 'forbidden';
  }
  return sddArgs(attempt.trace, 'step').length > 0 ? 'pass' : 'fail';
}
