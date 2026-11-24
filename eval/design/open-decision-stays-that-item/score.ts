import {commandExits, traceCommands} from '../../../src/eval/trace.ts';
import {follows} from '../../chat/commands.ts';

import type {Attempt, AttemptVerdict} from '../../../src/eval/score.ts';

const design = 'openspec/changes/issue-1/design.md';

const kept = ['## Approach\n\nnone', 'one-file: the card test'];

const answer = 'The name is distance.';

/** The open decision is checked in place. The rest of the design stays, then one commit and thread fix. */
export function openDecisionStaysThatItem(attempt: Attempt): AttemptVerdict {
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
