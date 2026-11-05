import type {Decision} from '../machine/policy.ts';

import type {BoardTurn, WindowComment} from './types.ts';
import {turnAction, turnPhase} from './types.ts';

import {firstFocusSentence, FOCUS_LAYERS, latestFocusComment} from '../machine/focus.ts';
import {
  focusMarkerLine,
  focusMirrorName,
  isFocusRecord,
  type FocusMarkerLine,
} from '../machine/marker.ts';

export type LiveFocus = {badge: string; text: string};

export type LiveFocusInput = {
  reviewGate?: boolean;
  running?: boolean;
  turn?: BoardTurn;
  decision?: Decision;
  checks?: 'green' | 'red' | 'pending' | 'none';
};

function waitLiveSentence(reason: string): string | undefined {
  if (!reason.startsWith('wait for children') && !reason.startsWith('wait for blockers')) {
    return undefined;
  }
  const keys: string[] = [];
  for (const match of reason.matchAll(/#(\d+)/g)) {
    const key = match[1];
    if (key !== undefined && !keys.includes(key)) {
      keys.push(key);
    }
  }
  if (keys.length === 0) {
    return undefined;
  }
  let until: string | undefined;
  if (reason.includes('specified')) {
    until = 'specified';
  } else if (reason.includes('accepted')) {
    until = 'accepted';
  }
  const named = keys.join(', ');
  return until === undefined ? named : `${named} until ${until}`;
}

/** Chooses the live pager sentence from spy inputs. Review gate suppression is the caller's job. */
export function liveFocus(input: LiveFocusInput): LiveFocus | undefined {
  if (input.reviewGate) {
    return undefined;
  }
  if (input.running) {
    const action = turnAction(input.turn);
    const phase = turnPhase(input.turn);
    if (action !== undefined && phase !== undefined) {
      return {badge: 'working', text: `${phase} → ${action}`};
    }
  }
  if (!input.running) {
    const action = turnAction(input.turn);
    const phase = turnPhase(input.turn);
    if (action !== undefined && phase === undefined) {
      return {badge: 'waiting for a slot', text: action};
    }
  }
  const decision = input.decision;
  if (decision?.kind === 'wait' && decision.gate === undefined) {
    const waitText = waitLiveSentence(decision.reason);
    if (waitText !== undefined) {
      return {badge: 'waiting on an issue', text: waitText};
    }
  }
  if (input.checks === 'pending') {
    return {badge: 'checks', text: 'checks are still running'};
  }
  if (input.checks === 'red') {
    return {
      badge: 'checks',
      text: 'checks are red and the failure has not been handed to a worker yet',
    };
  }
  return undefined;
}

export type FocusSidebar = {marker: FocusMarkerLine; body: string};

export type WrittenFocusPage = {marker: FocusMarkerLine; body: string};

/** Written focus comments, newest first. Manager comments and non-focus records stay out. */
export function writtenFocusPages(
  comments: readonly WindowComment[] | undefined,
): WrittenFocusPage[] {
  const pages: WrittenFocusPage[] = [];
  for (const comment of comments ?? []) {
    if (comment.manager || !isFocusRecord(comment.body)) {
      continue;
    }
    const marker = focusMarkerLine(comment.body);
    if (marker === null) {
      continue;
    }
    pages.push({marker, body: comment.body.split('\n').slice(1).join('\n')});
  }
  pages.reverse();
  return pages;
}

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

/** Prose the drawer shows under the badge. The window does not rewrite comment text. */
export function focusBlockProse(_marker: FocusMarkerLine, body: string): string {
  return body;
}

export type FocusCommentScan = {
  phaseSentences: Map<string, string>;
  latestWholeFocusBody: string | undefined;
};

/** One pass over issue comments for phase spine sentences and legacy ledger bodies. */
export function scanFocusComments(
  comments: readonly WindowComment[] | undefined,
): FocusCommentScan {
  const phaseSentences = new Map<string, string>();
  let latestWholeFocusBody: string | undefined;
  for (const comment of comments ?? []) {
    if (comment.manager || !isFocusRecord(comment.body)) {
      continue;
    }
    const marker = focusMarkerLine(comment.body);
    if (marker === null) {
      continue;
    }
    if (marker === 'sdd:focus') {
      latestWholeFocusBody = comment.body.split('\n').slice(1).join('\n');
      continue;
    }
    const layer = focusMirrorName(marker);
    const sentence = firstFocusSentence(comment.body);
    if (layer && layer !== 'Accept' && sentence) {
      phaseSentences.set(layer, sentence);
    }
  }
  return {phaseSentences, latestWholeFocusBody};
}

/** Latest first sentence per mirror layer from phase focus markers. */
export function phaseFocusSentences(
  comments: readonly WindowComment[] | undefined,
): Map<string, string> {
  return scanFocusComments(comments).phaseSentences;
}
