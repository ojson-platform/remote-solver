import type {ReviewNote} from '../machine/port.ts';

export type Remark = ReviewNote;

export type Verdict = {kind: 'unjudged'; reason: string} | {kind: 'clean'} | {kind: 'remarks'; items: Remark[]};

const FORBIDDEN = ['sdd:layer=', 'sdd:note', 'sdd:fixed', 'sdd:begin', '🤖'];

/** One line of the model text, short enough for the action log. */
export function excerpt(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 160 ? `${flat.slice(0, 160)}...` : flat;
}

/** Model text becomes a verdict. Anything that is not `clean` or a safe remark stays unjudged. */
export function parseVerdict(text: string): Verdict {
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  if (lines.length === 1 && lines[0] === 'clean') {
    return {kind: 'clean'};
  }
  const items = lines
    .filter(line => line.startsWith('remark:'))
    .map(line => parseRemark(line.slice('remark:'.length).trim()))
    .filter(item => item.body.length > 0 && !FORBIDDEN.some(token => item.body.includes(token)))
    .slice(0, 5);
  if (items.length === 0) {
    const sample = excerpt(text);
    return {
      kind: 'unjudged',
      reason: sample ? `answer is not a verdict: ${sample}` : 'empty answer',
    };
  }
  return {kind: 'remarks', items};
}

/** `@file:line text`, `@file text`, or plain text. The line is the right side of the diff. */
export function parseRemark(text: string): Remark {
  const placed = text.match(/^@(\S+?)(?::(\d+))?\s+(\S[\s\S]*)$/);
  if (!placed) {
    return {body: text};
  }
  const line = placed[2] ? Number(placed[2]) : undefined;
  return {body: placed[3], path: placed[1], ...(line ? {line} : {})};
}
