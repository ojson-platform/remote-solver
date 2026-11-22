import {commandExits, traceHas} from '../../../src/eval/trace.ts';

import type {Attempt, AttemptVerdict} from '../../../src/eval/score.ts';

/** Verifying has no code row. The ask is a reply without a marker, then Wait. */
export function verifyingDoesNotOpenCode(attempt: Attempt): AttemptVerdict {
  if (attempt.edited.length > 0) {
    return 'fail';
  }
  if (traceHas(attempt.trace, 'thread open') || traceHas(attempt.trace, 'sdd:layer=code')) {
    return 'forbidden';
  }
  const said = attempt.trace.some(line => line.includes('thread say') && line.includes('покрытой строке') && !line.includes('sdd:layer='));
  if (said && commandExits(attempt.trace, 'sdd', 'wait').length > 0) {
    return 'pass';
  }
  return 'fail';
}
