import {traceCommands} from '../../../src/eval/trace.ts';

import {changeEdited, follows} from '../commands.ts';

import type {Attempt, AttemptVerdict} from '../../../src/eval/score.ts';

const words = 'The name is distance';

/** One record, then a step that still lists that entry, is a stop. A second post is not. */
export function recordDidNotClose(attempt: Attempt): AttemptVerdict {
  if (changeEdited(attempt.edited)) {
    return 'forbidden';
  }
  const commands = traceCommands(attempt.trace, 'sdd');
  const opened = commands.filter(command => command.args[0] === 'thread' && command.args[1] === 'open');
  const open = opened[0];
  const recorded =
    opened.length === 1 &&
    open !== undefined &&
    open.exit === 0 &&
    (open.line.includes(`proposing ${words}'`) || open.line.includes(`proposing ${words} exit=`)) &&
    open.line.includes('proposal.md');
  const stepped = commands.filter(command => command.args[0] === 'step' && command.exit === 0).length === 1;
  const postedAgain = commands.some(command => command.args[0] === 'thread' && command.args[1] !== 'open');
  if (!recorded || !stepped || !follows(attempt.trace, 'thread', 'step') || postedAgain) {
    return 'fail';
  }
  return attempt.text.trim() === '' ? 'fail' : 'pass';
}
