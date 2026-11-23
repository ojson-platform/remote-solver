import {follows, sddArgs} from '../commands.ts';

import type {Attempt, AttemptVerdict} from '../../../src/eval/score.ts';

const proposal = 'openspec/changes/issue-1/proposal.md';
const problem =
  'The problem is described with several sentences so the request has something to shorten.';

/** A request to change the artifact edits it, publishes, clears the wait, and runs step. */
export function changePublishesAndUnwaits(attempt: Attempt): AttemptVerdict {
  // This message asks for an edit. A thread would record an answer to the open question.
  if (sddArgs(attempt.trace, 'thread').length > 0) {
    return 'forbidden';
  }
  const body = attempt.files?.[proposal] ?? '';
  const shortened =
    attempt.edited.includes(proposal) && body.includes('## Problem') && !body.includes(problem);
  const published =
    follows(attempt.trace, 'commit', 'publish') &&
    follows(attempt.trace, 'publish', 'unwait') &&
    follows(attempt.trace, 'unwait', 'step');
  return shortened && published ? 'pass' : 'fail';
}
