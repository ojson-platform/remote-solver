import {traceHas} from '../../../src/eval/trace.ts';

import type {Attempt, AttemptVerdict} from '../../../src/eval/score.ts';

/** A word the scenario title does not contain is still that promise, on the file's layer. */
export function statedPromiseIsCode(attempt: Attempt): AttemptVerdict {
  if (attempt.edited.length > 0) {
    return 'fail';
  }
  if (traceHas(attempt.trace, 'sdd:layer=spec') || traceHas(attempt.trace, 'sdd:layer=out')) {
    return 'forbidden';
  }
  return traceHas(attempt.trace, 'sdd:layer=code → implementing') ? 'pass' : 'fail';
}
