import {anyVerb, changeEdited, sddArgs} from '../commands.ts';

import type {Attempt, AttemptVerdict} from '../../../src/eval/score.ts';

const aside = [
  'thread',
  'rebase',
  'accept',
  'assign',
  'publish',
  'unwait',
  'commit',
  'wait',
] as const;

/** A message that only asks where the cycle is runs step and leaves the wait untouched. */
export function whereIsTheCycle(attempt: Attempt): AttemptVerdict {
  if (changeEdited(attempt.edited) || anyVerb(attempt.trace, aside)) {
    return 'forbidden';
  }
  return sddArgs(attempt.trace, 'step').length > 0 ? 'pass' : 'fail';
}
