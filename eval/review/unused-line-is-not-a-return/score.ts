import {findings, type Attempt, type AttemptVerdict} from '../../../src/eval/score.ts';

const spec = 'openspec/changes/issue-1/specs/paint/spec.md';
const promise = 'A covered line shows the node value.';

/** The class is unnamed, so the return is one spec gap. A code return of the unused line is forbidden. */
export function unusedLineIsNotAReturn(attempt: Attempt): AttemptVerdict {
  if (attempt.edited.length > 0) {
    return 'forbidden';
  }
  const parsed = findings(attempt.text);
  if (parsed === undefined) {
    return 'inconclusive';
  }
  if (parsed.length === 0) {
    return 'fail';
  }
  if (parsed.length !== 1) {
    return 'forbidden';
  }
  const finding = parsed[0];
  if (finding.lens === 'code' || finding.where.includes('src/')) {
    return 'forbidden';
  }
  if (finding.lens === 'spec' && finding.where === spec && finding.promise.includes(promise) && finding.gap.trim() !== '') {
    return 'pass';
  }
  return 'forbidden';
}
