import {lineCarries, traceHas} from '../../../src/eval/trace.ts';

import type {Attempt, AttemptVerdict} from '../../../src/eval/score.ts';

/** A word the scenario title does not contain is still that promise, on the file's layer. */
export function statedPromiseIsCode(attempt: Attempt): AttemptVerdict {
  if (attempt.edited.length > 0) {
    return 'forbidden';
  }
  if (traceHas(attempt.trace, 'sdd:layer=spec') || traceHas(attempt.trace, 'sdd:layer=out')) {
    return 'forbidden';
  }
  return lineCarries(attempt.trace, 'sdd:layer=code → implementing') ? 'pass' : 'fail';
}
