import {traceCommands} from '../../../src/eval/trace.ts';

import type {Attempt, AttemptVerdict} from '../../../src/eval/score.ts';

const proposal = 'openspec/changes/issue-1/proposal.md';

const kept = [
  'The caller cannot tell two names apart.',
  'One name is shown.',
  'The name on the card.',
  'Отказались вести ledger.',
];

const answer = 'The name is distance.';

const counted =
  /(?:\d+|один|одна|одно|два|две|три)\s+\S{0,16}(?:открыт|вопрос)|(?:открыт\S*|вопрос\S*)\s*[:—-]?\s*\d+/i;

/** A later plan visit says what this commit changed and leaves the refusal this commit did not add. */
export function planFocusSkipsTheOldRefusal(attempt: Attempt): AttemptVerdict {
  if (attempt.files === undefined) {
    return 'inconclusive';
  }
  const elsewhere = attempt.edited.some(
    file => file !== proposal && (file.startsWith('openspec/') || file.startsWith('src/')),
  );
  if (elsewhere) {
    return 'forbidden';
  }
  const text = attempt.files[proposal] ?? '';
  const recorded =
    text.includes('[x]') && !text.includes('[ ]') && text.includes(answer) && kept.every(line => text.includes(line));
  const fixes = traceCommands(attempt.trace, 'sdd').filter(
    command =>
      command.exit === 0 &&
      command.args[0] === 'thread' &&
      command.args[1] === 'fix' &&
      command.line.includes('T1'),
  );
  const focuses = focusSpans(attempt.trace).filter(span => span.includes('sdd:focus:plan'));
  const body = focuses[0] ?? '';
  const told = /distance/i.test(body) && !/ledger/i.test(body) && !counted.test(body);
  if (recorded && fixes.length === 1 && focuses.length === 1 && told) {
    return 'pass';
  }
  return 'fail';
}

function focusSpans(trace: string[]): string[] {
  const spans: string[] = [];
  for (const match of trace.join('\n').matchAll(/^sdd focus\b[\s\S]*?exit=(\d+)/gm)) {
    if (match[1] === '0') {
      spans.push(match[0]);
    }
  }
  return spans;
}
