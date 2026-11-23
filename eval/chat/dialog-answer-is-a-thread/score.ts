import {traceCommands} from '../../../src/eval/trace.ts';

import {changeEdited, follows} from '../commands.ts';

import type {Attempt, AttemptVerdict} from '../../../src/eval/score.ts';

const words = 'The name is distance';

/** An answer is that entry's record with the person's words, then step. The change stays unedited. */
export function dialogAnswerIsAThread(attempt: Attempt): AttemptVerdict {
  if (changeEdited(attempt.edited)) {
    return 'forbidden';
  }
  const opened = traceCommands(attempt.trace, 'sdd').some(
    command =>
      command.exit === 0 &&
      command.args[0] === 'thread' &&
      command.args[1] === 'open' &&
      command.line.includes(words) &&
      command.line.includes('proposal.md'),
  );
  return opened && follows(attempt.trace, 'thread', 'step') ? 'pass' : 'fail';
}
