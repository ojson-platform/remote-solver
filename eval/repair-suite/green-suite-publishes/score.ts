import {findings, type Attempt, type AttemptVerdict} from '../../../src/eval/score.ts';
import {commandExits, traceHas} from '../../../src/eval/trace.ts';

/** A green layer and type check, with nothing to return, publishes and does not hand off. */
export function greenSuitePublishes(attempt: Attempt): AttemptVerdict {
  const parsed = findings(attempt.text);
  if (parsed === undefined) {
    return 'inconclusive';
  }
  const published = commandExits(attempt.trace, 'sdd', 'publish').length > 0;
  if (traceHas(attempt.trace, 'sdd:layer=') || attempt.edited.length > 0 || (published && (parsed.length > 0 || attempt.text.includes('lens:')))) {
    return 'forbidden';
  }
  const layer = commandExits(attempt.trace, 'layer').includes(0);
  const types = commandExits(attempt.trace, 'typecheck').includes(0);
  return layer && types && published ? 'pass' : 'fail';
}
