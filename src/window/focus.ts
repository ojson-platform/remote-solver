import type {WindowComment} from './types.ts';

import {FOCUS_LAYERS} from '../machine/focus.ts';
import {isFocusRecord} from '../machine/marker.ts';

/** Body after the marker of the latest focus comment. */
export function focusPlaque(comments: readonly WindowComment[] | undefined): string | undefined {
  let body: string | undefined;
  for (const comment of comments ?? []) {
    if (comment.manager || !isFocusRecord(comment.body)) {
      continue;
    }
    body = comment.body.split('\n').slice(1).join('\n');
  }
  return body;
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

/** Layer names in the plaque that the record did not mark `solid`, in that order. */
export function focusLayers(comments: readonly WindowComment[] | undefined): string | undefined {
  const body = focusPlaque(comments);
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
  const body = focusPlaque(comments);
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
