import {type FileSource, type Tracker, type Vcs} from './port.ts';

import {isFocusRecord, unmarkedLine} from './marker.ts';
import {changeDir} from './naming.ts';

export type FocusComment = {body: string; manager?: boolean};

/** Layer names the legacy ledger reader still recognizes, in record order. */
export const FOCUS_LAYERS = ['Change', 'Plan', 'Specify', 'Design', 'Tasks', 'Code'] as const;

function hasChangeDir(key: string, files: FileSource): boolean {
  const root = changeDir(key);
  return files.list(root).length > 0;
}

function canonical(body: string): string {
  const text = body.replace(/\s+$/, '');
  const split = text.indexOf('\n');
  const first = unmarkedLine(split === -1 ? text : text.slice(0, split));
  const rest = split === -1 ? '' : text.slice(split + 1).replace(/\s+$/, '');
  return rest === '' ? first : `${first}\n${rest}`;
}

/** Latest non-manager focus comment body, in tracker order. */
export function latestFocusComment(comments: readonly FocusComment[]): string | undefined {
  let body: string | undefined;
  for (const comment of comments) {
    if (comment.manager || !isFocusRecord(comment.body)) {
      continue;
    }
    body = comment.body;
  }
  return body;
}

/**
 * Post one focus comment through the tracker port. Skips when the change
 * directory is absent or the canonical body matches the latest focus comment.
 */
export async function postFocusComment(
  key: string,
  body: string,
  deps: {
    tracker: Pick<Tracker, 'comments' | 'comment'>;
    vcs: Pick<Vcs, 'filesAt'>;
  },
): Promise<boolean> {
  if (!hasChangeDir(key, deps.vcs.filesAt(key))) {
    return false;
  }
  const text = body.endsWith('\n') ? body : `${body}\n`;
  const latest = latestFocusComment(await deps.tracker.comments(key));
  if (latest !== undefined && canonical(latest) === canonical(text)) {
    return false;
  }
  await deps.tracker.comment(key, text);
  return true;
}

/** Prose after the marker line of a focus comment. */
export function focusProse(body: string): string | undefined {
  if (!isFocusRecord(body)) {
    return undefined;
  }
  const prose = body.split('\n').slice(1).join('\n').replace(/\s+$/, '');
  return prose === '' ? undefined : prose;
}

/** First sentence of focus prose through `.`, `!`, or `?`, or the first line when none appear. */
export function firstFocusSentence(body: string): string | undefined {
  const prose = focusProse(body);
  if (prose === undefined) {
    return undefined;
  }
  const flat = prose.replace(/\n+/g, ' ').trim();
  const match = flat.match(/^([\s\S]*?[.!?])(?:\s|$)/);
  if (match) {
    return match[1].trim();
  }
  const firstLine = prose.split('\n')[0]?.trim() ?? '';
  return firstLine === '' ? undefined : firstLine;
}
