import type {WindowComment} from './types.ts';

import {ROBOT_MARK} from '../machine/marker.ts';

const LAYERS = ['Change', 'Plan', 'Specify', 'Design', 'Tasks', 'Code'] as const;

/** The latest comment whose first line is `sdd:focus`. A manager comment is not one. */
export function isFocusComment(body: string): boolean {
  const first = (body.split('\n', 1)[0] ?? '').trim();
  const bare = first.startsWith(ROBOT_MARK) ? first.slice(ROBOT_MARK.length).trim() : first;
  return bare === 'sdd:focus';
}

/** Body after the marker of the latest focus comment. */
export function focusPlaque(comments: readonly WindowComment[] | undefined): string | undefined {
  let body: string | undefined;
  for (const comment of comments ?? []) {
    if (comment.manager || !isFocusComment(comment.body)) {
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
    if (!(LAYERS as readonly string[]).includes(token)) {
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
