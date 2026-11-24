import {traceCommands} from '../../../src/eval/trace.ts';

import {changeEdited} from '../commands.ts';

import type {Attempt, AttemptVerdict} from '../../../src/eval/score.ts';

/** Closing the dialog records nothing and stops. A silent attempt is not that stop. */
export function dialogCloseStops(attempt: Attempt): AttemptVerdict {
  if (changeEdited(attempt.edited)) {
    return 'forbidden';
  }
  const commands = traceCommands(attempt.trace, 'sdd');
  if (commands.some(command => command.args[0] === 'thread' || command.args[0] === 'step')) {
    return 'fail';
  }
  return attempt.text.trim() === '' ? 'fail' : 'pass';
}
