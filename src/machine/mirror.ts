const BEGIN = '<!-- sdd:begin -->';
const END = '<!-- sdd:end -->';

/** Replace one layer line inside the issue mirror. The author's text stays. */
export function updateMirror(body: string, layer: string, text: string): string {
  const row = `${layer}: ${text}`;
  const start = body.indexOf(BEGIN);
  const end = body.indexOf(END);
  if (start === -1 || end === -1 || end < start) {
    const block = `${BEGIN}\n${row}\n${END}`;
    const trimmed = body.replace(/\s*$/, '');
    return `${trimmed}${trimmed ? '\n\n' : ''}${block}\n`;
  }
  const inner = body.slice(start + BEGIN.length, end).replace(/^\n/, '').replace(/\n$/, '');
  const lines = inner.split('\n').filter(line => line.trim() !== '');
  const next = lines.some(line => line.startsWith(`${layer}:`))
    ? lines.map(line => (line.startsWith(`${layer}:`) ? row : line))
    : [...lines, row];
  return `${body.slice(0, start)}${BEGIN}\n${next.join('\n')}\n${END}${body.slice(end + END.length)}`;
}
