import {commandExits, traceCommands} from '../../../src/eval/trace.ts';

import type {Attempt, AttemptVerdict} from '../../../src/eval/score.ts';

/** A red file no card names is one code hand-off on that file. The file stays, and there is no publish. */
export function foreignFileIsHandoff(attempt: Attempt): AttemptVerdict {
  if (attempt.edited.includes('src/other.ts') || commandExits(attempt.trace, 'sdd', 'publish').length > 0) {
    return 'forbidden';
  }
  const placed = traceCommands(attempt.trace, 'sdd').filter(
    cmd => cmd.args[0] === 'thread' && cmd.args[1] === 'open' && cmd.exit === 0,
  );
  if (placed.some(cmd => cmd.args[3] !== 'src/other.ts' || !cmd.line.includes('sdd:layer=code'))) {
    return 'forbidden';
  }
  return placed.length === 1 ? 'pass' : 'fail';
}
