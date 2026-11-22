import {commandExits, traceHas} from '../../../src/eval/trace.ts';

import type {Attempt, AttemptVerdict} from '../../../src/eval/score.ts';

/** One near line is not a hand-off. The suite still publishes, and only after layer ran. */
export function nearIsNotAHandoff(attempt: Attempt): AttemptVerdict {
  if (traceHas(attempt.trace, 'sdd:layer=') || attempt.edited.length > 0) {
    return 'forbidden';
  }
  const layer = commandExits(attempt.trace, 'layer').includes(0);
  const published = commandExits(attempt.trace, 'sdd', 'publish').length > 0;
  return layer && published ? 'pass' : 'fail';
}
