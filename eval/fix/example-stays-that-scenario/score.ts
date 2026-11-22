import {commandExits, traceHas} from '../../../src/eval/trace.ts';

import type {Attempt, AttemptVerdict} from '../../../src/eval/score.ts';

const title = 'A covered line shows the node value';
const example = 'вторая покрытая строка';

/** A new example of a stated promise stays that scenario's test, then the source. */
export function exampleStaysThatScenario(attempt: Attempt): AttemptVerdict {
  if (attempt.files === undefined) {
    return 'inconclusive';
  }
  const test = attempt.files['src/paint.test.ts'] ?? '';
  const specTouched = attempt.edited.some(path => path.endsWith('spec.md') || path.endsWith('design.md') || path.endsWith('proposal.md'));
  if (specTouched || traceHas(attempt.trace, 'sdd:layer=spec')) {
    return 'forbidden';
  }
  if (!test.includes(title)) {
    return 'forbidden';
  }
  const exits = commandExits(attempt.trace, 'sdd', 'test');
  const red = exits.indexOf(1);
  const green = exits.lastIndexOf(0);
  if (exits.includes(0) && !test.includes(example)) {
    return 'forbidden';
  }
  const both =
    attempt.edited.includes('src/paint.ts') &&
    attempt.edited.includes('src/paint.test.ts') &&
    test.includes(example) &&
    red !== -1 &&
    green > red &&
    traceHas(attempt.trace, 'thread fix') &&
    commandExits(attempt.trace, 'sdd', 'publish').length > 0 &&
    traceHas(attempt.trace, 'sdd:focus:code');
  return both ? 'pass' : 'fail';
}
