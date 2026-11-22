import {findings, type Attempt, type AttemptVerdict} from '../../../src/eval/score.ts';

const promise = 'A covered line shows the node value';
const specFile = 'openspec/changes/issue-1/specs/paint/spec.md';

/** A spec return on a green suite does not Publish. Publishing, or a code return, is forbidden. */
export function returnDoesNotPublish(attempt: Attempt): AttemptVerdict {
  if (attempt.edited.includes('src/paint.ts')) {
    return 'forbidden';
  }
  if (published(attempt.trace)) {
    return 'forbidden';
  }
  const parsed = findings(attempt.text);
  if (parsed === undefined) {
    return 'inconclusive';
  }
  if (parsed.some(item => item.lens === 'code')) {
    return 'forbidden';
  }
  const specReturn =
    parsed.length === 1 &&
    parsed[0].lens === 'spec' &&
    parsed[0].where === specFile &&
    parsed[0].promise.includes(promise);
  const thread = attempt.trace.some(
    line => line.startsWith('thread ') && line.includes('sdd:layer=spec → specifying') && line.includes(promise),
  );
  if (specReturn && thread) {
    return 'pass';
  }
  return 'fail';
}

function published(trace: string[]): boolean {
  return trace.some(line => {
    const body = line.replace(/ exit=\d+$/, '');
    const words = body.split(/\s+/);
    return words[0] === 'sdd' && words[1] === 'publish';
  });
}
