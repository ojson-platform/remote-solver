import type {FileSource} from '../port.ts';

import {createHash} from 'node:crypto';

/** The `sdd-absorbed` line a phase file moves when it folds its input. */
export function absorbedStamp(text: string): string {
  return /^sdd-absorbed: ([0-9a-f]+)\s*$/m.exec(text)?.[1] ?? '';
}

/** A revision of the current input bytes. This is not a commit and not a diff. */
export function contentRevision(chunks: {path: string; text: string}[]): string {
  const body = [...chunks]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map(chunk => `# ${chunk.path}\n${chunk.text}`)
    .join('\n');
  return createHash('sha256').update(body).digest('hex').slice(0, 16);
}

export function sharedStamp(texts: string[]): string {
  if (texts.length === 0) {
    return '';
  }
  const stamps = texts.map(absorbedStamp);
  const first = stamps[0] ?? '';
  return first !== '' && stamps.every(stamp => stamp === first) ? first : '';
}

/** The file changed and the stamp line did not. No parent text means no drift. */
function leftUnstamped(current: string, previous: string | undefined): boolean {
  if (previous === undefined || previous === '' || previous === current) {
    return false;
  }
  const stamp = absorbedStamp(current);
  return stamp !== '' && stamp === absorbedStamp(previous);
}

export function drifted(files: FileSource, rels: readonly string[]): boolean {
  if (!files.parent) {
    return false;
  }
  return rels.some(rel => leftUnstamped(files.read(rel), files.parent?.(rel)));
}
