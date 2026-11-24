import {traceCommands} from '../../../src/eval/trace.ts';

import type {Attempt, AttemptVerdict} from '../../../src/eval/score.ts';

const proposal = 'openspec/changes/issue-1/proposal.md';

const kept = [
  'The caller cannot tell two names apart.',
  'One name is shown.',
  'The name on the card.',
  'Отказались вести ledger.',
  '- [ ] Which name',
  '## Shelf',
];

const counted =
  /(?:\d+|один|одна|одно|два|две|три)\s+\S{0,16}(?:открыт|вопрос)|(?:открыт\S*|вопрос\S*)\s*[:—-]?\s*\d+/i;

/** A first plan visit names the refusal already in the proposal and does not count open questions. */
export function planFocusNamesTheRefusal(attempt: Attempt): AttemptVerdict {
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
  const stayed = !text.includes('[x]') && kept.every(line => text.includes(line));
  const publishes = traceCommands(attempt.trace, 'sdd').filter(
    command => command.exit === 0 && command.args[0] === 'publish' && command.args[1] !== '--help',
  );
  const focuses = focusSpans(attempt.trace).filter(span => span.includes('sdd:focus:plan'));
  const body = focuses[0] ?? '';
  const named = /ledger/i.test(body) && !counted.test(body);
  const waited = traceCommands(attempt.trace, 'sdd').some(command => command.args[0] === 'wait');
  const labeled = attempt.trace.some(line => line.includes('sdd:proposed'));
  if (stayed && publishes.length === 1 && focuses.length === 1 && named && !waited && !labeled) {
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
