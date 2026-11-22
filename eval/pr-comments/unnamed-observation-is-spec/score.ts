import {traceHas} from '../../../src/eval/trace.ts';

import type {Attempt, AttemptVerdict} from '../../../src/eval/score.ts';

/** An observation no scenario names, which this issue owns, is spec even on a source file. */
export function unnamedObservationIsSpec(attempt: Attempt): AttemptVerdict {
  if (attempt.edited.length > 0) {
    return 'fail';
  }
  if (traceHas(attempt.trace, 'sdd:layer=code') || traceHas(attempt.trace, 'sdd:layer=out')) {
    return 'forbidden';
  }
  return traceHas(attempt.trace, 'sdd:layer=spec → specifying') ? 'pass' : 'fail';
}
