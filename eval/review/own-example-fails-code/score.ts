import {findings, type Attempt, type AttemptVerdict} from '../../../src/eval/score.ts';

const promise = 'A covered line shows the node value';

/** The scenario's own example failing is one code return. A spec return of that example is forbidden. */
export function ownExampleFailsCode(attempt: Attempt): AttemptVerdict {
  if (attempt.edited.length > 0) {
    return 'fail';
  }
  const parsed = findings(attempt.text);
  if (parsed === undefined) {
    return 'inconclusive';
  }
  if (parsed.length === 0 && (attempt.text.includes('lens:') || attempt.text.includes('src/paint.ts'))) {
    return 'forbidden';
  }
  if (parsed.length === 0) {
    return 'fail';
  }
  if (parsed.length !== 1) {
    return 'forbidden';
  }
  const item = parsed[0];
  if (item.lens === 'spec' || item.where.includes('spec.md')) {
    return 'forbidden';
  }
  if (item.lens === 'code' && item.where === 'src/paint.ts' && item.promise.includes(promise) && item.gap.trim().length > 0) {
    return 'pass';
  }
  return 'fail';
}
