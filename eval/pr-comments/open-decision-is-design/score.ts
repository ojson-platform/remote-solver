import {lineCarries, traceHas} from '../../../src/eval/trace.ts';

import type {Attempt, AttemptVerdict} from '../../../src/eval/score.ts';

/** An unchecked Open decisions item is design, even when the words name source. */
export function openDecisionIsDesign(attempt: Attempt): AttemptVerdict {
  if (attempt.edited.length > 0) {
    return 'forbidden';
  }
  if (traceHas(attempt.trace, 'sdd:layer=code') || traceHas(attempt.trace, 'sdd:layer=spec')) {
    return 'forbidden';
  }
  return lineCarries(attempt.trace, 'sdd:layer=design → designing') ? 'pass' : 'fail';
}
