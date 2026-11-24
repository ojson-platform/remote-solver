import type {Attempt, AttemptVerdict} from '../../../src/eval/score.ts';

const design = 'openspec/changes/issue-1/design.md';

/** With no design thread, the missing design is written from the spec. */
export function missingDesignIsWritten(attempt: Attempt): AttemptVerdict {
  if (attempt.files === undefined) {
    return 'inconclusive';
  }
  const elsewhere = attempt.edited.some(
    file => file !== design && (file.startsWith('openspec/') || file.startsWith('src/')),
  );
  if (elsewhere) {
    return 'forbidden';
  }
  const text = attempt.files[design] ?? '';
  if (
    text.includes('The card shows one name') &&
    text.includes('## Approach') &&
    text.includes('## Verification boundary')
  ) {
    return 'pass';
  }
  return 'fail';
}
