import {traceHas} from '../../../src/eval/trace.ts';

import type {Attempt, AttemptVerdict} from '../../../src/eval/score.ts';

/** A promise no scenario names and this issue does not own is out, then the thread resolves. */
export function commentsUnownedIsOut(attempt: Attempt): AttemptVerdict {
  if (attempt.edited.length > 0) {
    return 'fail';
  }
  if (traceHas(attempt.trace, 'sdd:layer=spec') || traceHas(attempt.trace, 'sdd:layer=code')) {
    return 'forbidden';
  }
  const marked = attempt.trace.some(line => /sdd:layer=out — #\d+/.test(line));
  const resolved = traceHas(attempt.trace, 'thread resolve');
  if (marked && resolved) {
    return 'pass';
  }
  return 'fail';
}
