import {findings, type Attempt, type AttemptVerdict} from '../../../src/eval/score.ts';

/** A named class whose own example holds is not a return. Naming the paint file is forbidden. */
export function classNamedNoReturn(attempt: Attempt): AttemptVerdict {
  if (attempt.edited.length > 0) {
    return 'fail';
  }
  const parsed = findings(attempt.text);
  if (parsed === undefined) {
    return 'inconclusive';
  }
  if (parsed.length > 0 || attempt.text.includes('lens:') || attempt.text.includes('src/paint.ts')) {
    return 'forbidden';
  }
  return 'pass';
}
