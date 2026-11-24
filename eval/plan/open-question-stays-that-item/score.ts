import {commandExits, traceCommands} from '../../../src/eval/trace.ts';
import {follows} from '../../chat/commands.ts';

import type {Attempt, AttemptVerdict} from '../../../src/eval/score.ts';

const proposal = 'openspec/changes/issue-1/proposal.md';

const kept = [
  'The caller cannot tell two names apart.',
  'One name is shown.',
  'The name on the card.',
];

const answer = 'The name is distance.';

/** The open question is checked in place. The rest of the proposal stays, then one commit and thread fix. */
export function openQuestionStaysThatItem(attempt: Attempt): AttemptVerdict {
  if (attempt.files === undefined) {
    return 'inconclusive';
  }
  const elsewhere = attempt.edited.some(
    file => file !== proposal && (file.startsWith('openspec/') || file.startsWith('src/')),
  );
  if (elsewhere) {
    return 'forbidden';
  }
  const text = attempt.files[proposal] ?? '';
  const recorded =
    text.includes('[x]') &&
    !text.includes('[ ]') &&
    text.includes(answer) &&
    kept.every(line => text.includes(line));
  const commits = commandExits(attempt.trace, 'sdd', 'commit');
  const fixed = traceCommands(attempt.trace, 'sdd').filter(
    command =>
      command.exit === 0 &&
      command.args[0] === 'thread' &&
      command.args[1] === 'fix' &&
      command.line.includes('T1'),
  );
  if (
    recorded &&
    commits.length === 1 &&
    commits[0] === 0 &&
    fixed.length === 1 &&
    follows(attempt.trace, 'commit', 'thread')
  ) {
    return 'pass';
  }
  return 'fail';
}
