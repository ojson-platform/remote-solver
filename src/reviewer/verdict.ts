export type Verdict = {kind: 'unjudged'} | {kind: 'clean'} | {kind: 'remarks'; items: string[]};

const FORBIDDEN = ['sdd:layer=', 'sdd:note', 'sdd:fixed', 'sdd:begin', '🤖'];

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
    .map(line => line.slice('remark:'.length).trim())
    .filter(body => body.length > 0 && !FORBIDDEN.some(token => body.includes(token)))
    .slice(0, 5);
  if (items.length === 0) {
    return {kind: 'unjudged'};
  }
  return {kind: 'remarks', items};
}
