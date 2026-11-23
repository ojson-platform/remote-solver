import {lineCarries, traceHas} from '../../../src/eval/trace.ts';

import type {Attempt, AttemptVerdict} from '../../../src/eval/score.ts';

/** A promise this change does not own is out. Spec, code, and the paint file are forbidden. */
export function fixUnownedIsOut(attempt: Attempt): AttemptVerdict {
  if (
    attempt.edited.includes('src/paint.ts') ||
    traceHas(attempt.trace, 'sdd:layer=spec') ||
    traceHas(attempt.trace, 'sdd:layer=code') ||
    traceHas(attempt.trace, 'thread fix')
  ) {
    return 'forbidden';
  }
  return lineCarries(attempt.trace, 'sdd:layer=out') ? 'pass' : 'fail';
}
