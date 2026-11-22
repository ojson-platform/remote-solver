import {commandExits, traceHas} from '../../../src/eval/trace.ts';

import type {Attempt, AttemptVerdict} from '../../../src/eval/score.ts';

/** The first red layer on a card file is one edit, a second green layer, then publish. */
export function cardFileIsEditedOnce(attempt: Attempt): AttemptVerdict {
  if (traceHas(attempt.trace, 'sdd:layer=') || attempt.edited.includes('src/other.ts')) {
    return 'forbidden';
  }
  const layers = commandExits(attempt.trace, 'layer');
  const red = layers.indexOf(1);
  const green = layers.lastIndexOf(0);
  const published = commandExits(attempt.trace, 'sdd', 'publish').length > 0;
  if (red !== -1 && green > red && attempt.edited.includes('src/paint.ts') && published) {
    return 'pass';
  }
  return 'fail';
}
