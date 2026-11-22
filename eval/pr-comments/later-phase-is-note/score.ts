import {commandExits, traceHas} from '../../../src/eval/trace.ts';

import type {Attempt, AttemptVerdict} from '../../../src/eval/score.ts';

/** A request that only names a later phase is a note. Wait and a layer marker are forbidden. */
export function laterPhaseIsNote(attempt: Attempt): AttemptVerdict {
  if (attempt.edited.length > 0) {
    return 'fail';
  }
  if (commandExits(attempt.trace, 'sdd', 'wait').length > 0 || traceHas(attempt.trace, 'thread open') || traceHas(attempt.trace, 'sdd:layer=')) {
    return 'forbidden';
  }
  const noted = attempt.trace.some(line => line.includes('thread say') && line.includes('sdd:note') && line.includes('приёмки'));
  return noted ? 'pass' : 'fail';
}
