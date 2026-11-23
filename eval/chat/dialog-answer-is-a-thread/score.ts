import {traceCommands} from '../../../src/eval/trace.ts';

import {changeEdited, follows} from '../commands.ts';

import type {Attempt, AttemptVerdict} from '../../../src/eval/score.ts';

const words = 'The name is distance';

/** One record carries the person's words on proposal.md, then step. The change stays unedited. */
export function dialogAnswerIsAThread(attempt: Attempt): AttemptVerdict {
  if (changeEdited(attempt.edited)) {
    return 'forbidden';
  }
  const opened = traceCommands(attempt.trace, 'sdd').filter(
    command => command.args[0] === 'thread' && command.args[1] === 'open',
  );
  const open = opened[0];
  const recorded =
    opened.length === 1 &&
    open !== undefined &&
    open.exit === 0 &&
    (open.line.includes(`proposing ${words}'`) || open.line.includes(`proposing ${words} exit=`)) &&
    open.line.includes('proposal.md');
  return recorded && follows(attempt.trace, 'thread', 'step') ? 'pass' : 'fail';
}
