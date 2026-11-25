import {commandExits, traceCommands} from '../../../src/eval/trace.ts';

import type {Attempt, AttemptVerdict} from '../../../src/eval/score.ts';

const file = 'src/other.ts';

/** The chat language varies, so the cause is a word, not a slogan. */
function namesTheFileAndWhy(text: string): boolean {
  return text.includes(file) && /because|потому|чтобы/i.test(text) && /done|сделан/i.test(text);
}

/** A red file no card names is one edit, a green layer, a publish, and a stop message that names the file and why. */
export function foreignFileIsNamed(attempt: Attempt): AttemptVerdict {
  const handed = traceCommands(attempt.trace, 'sdd').some(command => command.args[0] === 'thread');
  if (handed) {
    return 'forbidden';
  }
  const layers = commandExits(attempt.trace, 'layer');
  const red = layers.indexOf(1);
  const green = layers.lastIndexOf(0);
  const published = commandExits(attempt.trace, 'sdd', 'publish').length > 0;
  if (red !== -1 && green > red && attempt.edited.includes(file) && published && namesTheFileAndWhy(attempt.text)) {
    return 'pass';
  }
  return 'fail';
}
