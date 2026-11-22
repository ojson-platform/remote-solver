import {findings, type Attempt, type AttemptVerdict} from '../../../src/eval/score.ts';

const promise = 'A covered line shows the node value';
const specFile = 'openspec/changes/issue-1/specs/paint/spec.md';

/** One example of the class is a spec return. A code return of that example is forbidden. */
export function specimenIsSpec(attempt: Attempt): AttemptVerdict {
  if (attempt.edited.length > 0) {
    return 'fail';
  }
  const parsed = findings(attempt.text);
  if (parsed === undefined) {
    return 'inconclusive';
  }
  if (parsed.some(item => item.lens === 'code' || item.where.includes('src/paint.ts'))) {
    return 'forbidden';
  }
  if (parsed.length === 0 && (attempt.text.includes('lens:') || attempt.text.includes('src/paint.ts'))) {
    return 'forbidden';
  }
  if (parsed.length !== 1) {
    return parsed.length === 0 ? 'fail' : 'forbidden';
  }
  const item = parsed[0];
  if (
    item.lens === 'spec' &&
    item.where === specFile &&
    item.promise.includes(promise) &&
    item.gap.trim().length > 0
  ) {
    return 'pass';
  }
  return 'fail';
}
