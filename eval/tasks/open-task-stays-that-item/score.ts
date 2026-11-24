import {commandExits, traceCommands} from '../../../src/eval/trace.ts';
import {follows} from '../../chat/commands.ts';

import type {Attempt, AttemptVerdict} from '../../../src/eval/score.ts';

const tasks = 'openspec/changes/issue-1/tasks.md';
const card = 'openspec/changes/issue-1/tasks/card.md';

const kept = ['The card shows one name', 'sdd-delta: rev-1', '`src/card.ts`'];

const answer = 'The name is distance.';

/** The open task item is checked in place. The card stays, then one commit and thread fix. */
export function openTaskStaysThatItem(attempt: Attempt): AttemptVerdict {
  if (attempt.files === undefined) {
    return 'inconclusive';
  }
  const elsewhere = attempt.edited.some(
    file => file !== tasks && (file.startsWith('openspec/') || file.startsWith('src/')),
  );
  if (elsewhere) {
    return 'forbidden';
  }
  const list = attempt.files[tasks] ?? '';
  const cardText = attempt.files[card] ?? '';
  const recorded =
    list.includes('[x]') &&
    !list.includes('[ ]') &&
    list.includes(answer) &&
    kept.every(line => cardText.includes(line));
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
