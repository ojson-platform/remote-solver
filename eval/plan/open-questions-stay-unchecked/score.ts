import {traceCommands} from '../../../src/eval/trace.ts';

import type {Attempt, AttemptVerdict} from '../../../src/eval/score.ts';

const proposal = 'openspec/changes/issue-1/proposal.md';

const kept = [
  'The caller cannot tell two names apart.',
  'One name is shown.',
  'The name on the card.',
  '- [ ] Which name',
  '## Shelf',
];

const counted =
  /(?:\d+|один|одна|одно|два|две|три)\s+\S{0,16}(?:открыт|вопрос)|(?:открыт\S*|вопрос\S*)\s*[:—-]?\s*\d+/i;

/** Open questions stay unchecked. Publish runs, focus names no count, and the chat does not wait or set the gate label. */
export function openQuestionsStayUnchecked(attempt: Attempt): AttemptVerdict {
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
  const waited = traceCommands(attempt.trace, 'sdd').some(command => command.args[0] === 'wait');
  const labeled = attempt.trace.some(line => line.includes('sdd:proposed'));
  const published = publishes.length === 1;
  const focused = focuses.length === 1 && !counted.test(focuses[0] ?? '');
  if (stayed && published && focused && !waited && !labeled && focusAfterPublish(attempt.trace)) {
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

function focusAfterPublish(trace: string[]): boolean {
  const text = trace.join('\n');
  const publish = text.search(/^sdd publish\b.*exit=0/m);
  const focus = text.search(/^sdd focus\b[\s\S]*?sdd:focus:plan[\s\S]*?exit=0/m);
  return publish >= 0 && focus > publish;
}
