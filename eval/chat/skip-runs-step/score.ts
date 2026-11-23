import {traceCommands} from '../../../src/eval/trace.ts';

import {changeEdited} from '../commands.ts';

import type {Attempt, AttemptVerdict} from '../../../src/eval/score.ts';

/** Skip records nothing and still runs step. An empty trace is not that step. */
export function skipRunsStep(attempt: Attempt): AttemptVerdict {
  if (changeEdited(attempt.edited)) {
    return 'forbidden';
  }
  const commands = traceCommands(attempt.trace, 'sdd');
  if (commands.some(command => command.args[0] === 'thread')) {
    return 'fail';
  }
  const stepped = commands.some(command => command.exit === 0 && command.args[0] === 'step');
  return stepped ? 'pass' : 'fail';
}
