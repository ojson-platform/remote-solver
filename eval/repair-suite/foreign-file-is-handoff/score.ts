import {commandExits, traceHas} from '../../../src/eval/trace.ts';

import type {Attempt, AttemptVerdict} from '../../../src/eval/score.ts';

/** A red file no card names is a code hand-off. The file stays, and there is no publish. */
export function foreignFileIsHandoff(attempt: Attempt): AttemptVerdict {
  if (attempt.edited.includes('src/other.ts') || commandExits(attempt.trace, 'sdd', 'publish').length > 0) {
    return 'forbidden';
  }
  return traceHas(attempt.trace, 'sdd:layer=code') && traceHas(attempt.trace, 'src/other.ts') ? 'pass' : 'fail';
}
