import {commandExits, traceHas} from '../../../src/eval/trace.ts';

import type {Attempt, AttemptVerdict} from '../../../src/eval/score.ts';

/** A promise no scenario states, which the issue owns, is a spec hand-off. No code, no publish. */
export function noScenarioHandsToSpec(attempt: Attempt): AttemptVerdict {
  const codeTouched = attempt.edited.some(path => path === 'src/paint.ts' || path === 'src/paint.test.ts' || path.endsWith('spec.md'));
  if (
    codeTouched ||
    commandExits(attempt.trace, 'sdd', 'publish').length > 0 ||
    commandExits(attempt.trace, 'sdd', 'commit').length > 0 ||
    traceHas(attempt.trace, 'thread fix') ||
    traceHas(attempt.trace, 'sdd:layer=out')
  ) {
    return 'forbidden';
  }
  return traceHas(attempt.trace, 'sdd:layer=spec → specifying') ? 'pass' : 'fail';
}
