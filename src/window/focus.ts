import type {WindowComment} from './types.ts';

import {firstFocusSentence, FOCUS_LAYERS, latestFocusComment} from '../machine/focus.ts';
import {
  focusMarkerLine,
  focusMirrorName,
  isFocusRecord,
  type FocusMarkerLine,
} from '../machine/marker.ts';

export type FocusSidebar = {marker: FocusMarkerLine; body: string};

/** Latest non-manager focus comment body, in tracker order. */
export function latestFocusRecord(comments: readonly WindowComment[] | undefined): string | undefined {
  return latestFocusComment(comments ?? []);
}

/** Marker and prose body for the sidebar focus block. */
export function focusSidebar(comments: readonly WindowComment[] | undefined): FocusSidebar | undefined {
  const record = latestFocusRecord(comments);
  if (record === undefined) {
    return undefined;
  }
  const marker = focusMarkerLine(record);
  if (marker === null) {
    return undefined;
  }
  return {marker, body: record.split('\n').slice(1).join('\n')};
}

/** Body after the marker of the latest focus comment. */
export function focusPlaque(comments: readonly WindowComment[] | undefined): string | undefined {
  return focusSidebar(comments)?.body;
}

function layerLines(body: string): {name: string; rest: string}[] {
  const lines: {name: string; rest: string}[] = [];
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') {
      continue;
    }
    const token = trimmed.split(/\s+/)[0] ?? '';
    if (!(FOCUS_LAYERS as readonly string[]).includes(token)) {
      continue;
    }
    lines.push({name: token, rest: trimmed.slice(token.length).trim()});
  }
  return lines;
}

/** True when every non-empty line names a mirror layer. */
export function isFocusLedgerBody(body: string): boolean {
  let seen = false;
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') {
      continue;
    }
    seen = true;
    const token = trimmed.split(/\s+/)[0] ?? '';
    if (!(FOCUS_LAYERS as readonly string[]).includes(token)) {
      return false;
    }
  }
  return seen;
}

function latestWholeFocusBody(comments: readonly WindowComment[] | undefined): string | undefined {
  const record = latestFocusRecord(comments);
  if (record === undefined || focusMarkerLine(record) !== 'sdd:focus') {
    return undefined;
  }
  return record.split('\n').slice(1).join('\n');
}

/** Layer names in the plaque that the record did not mark `solid`, in that order. */
export function focusLayers(comments: readonly WindowComment[] | undefined): string | undefined {
  const body = latestWholeFocusBody(comments);
  if (body === undefined) {
    return undefined;
  }
  const names: string[] = [];
  for (const line of layerLines(body)) {
    if (line.rest === 'solid' || names.includes(line.name)) {
      continue;
    }
    names.push(line.name);
  }
  return names.length === 0 ? undefined : names.join(' · ');
}

/** A Code review place the plaque names as `file:line`. */
export function focusNamesPlace(
  comments: readonly WindowComment[] | undefined,
  file: string,
  line: number,
): boolean {
  const body = latestWholeFocusBody(comments);
  if (body === undefined) {
    return false;
  }
  for (const item of layerLines(body)) {
    if (item.name !== 'Code' || item.rest === 'solid') {
      continue;
    }
    for (const gap of item.rest.split(';')) {
      const match = /^(\S+):(\d+)$/.exec(gap.trim());
      if (match?.[1] === file && Number(match[2]) === line) {
        return true;
      }
    }
  }
  return false;
}

/** Prose the drawer shows under the badge. Mirror layer lines stay on the spine. */
export function focusBlockProse(marker: FocusMarkerLine, body: string): string {
  if (marker !== 'sdd:focus') {
    return body;
  }
  const rest: string[] = [];
  for (const raw of body.split('\n')) {
    const trimmed = raw.trim();
    if (trimmed === '') {
      continue;
    }
    const token = trimmed.split(/\s+/)[0]?.replace(/:$/, '') ?? '';
    if ((FOCUS_LAYERS as readonly string[]).includes(token)) {
      continue;
    }
    rest.push(raw.trimEnd());
  }
  return rest.length === 0 ? '' : `${rest.join('\n')}\n`;
}

/** Latest first sentence per mirror layer from phase focus markers. */
export function phaseFocusSentences(
  comments: readonly WindowComment[] | undefined,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const comment of comments ?? []) {
    if (comment.manager || !isFocusRecord(comment.body)) {
      continue;
    }
    const marker = focusMarkerLine(comment.body);
    if (marker === null || marker === 'sdd:focus') {
      continue;
    }
    const layer = focusMirrorName(marker);
    const sentence = firstFocusSentence(comment.body);
    if (layer && sentence) {
      out.set(layer, sentence);
    }
  }
  return out;
}
