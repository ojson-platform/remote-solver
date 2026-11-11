
import type {BoardTurn, WindowComment} from './types.ts';
import type {Decision} from '../machine/decide/policy.ts';


import {NO_OPEN_PULL} from '../machine/decide/pulls.ts';
import {firstFocusSentence, FOCUS_LAYERS, latestFocusComment} from '../machine/mark/focus.ts';
import {
  focusMarkerLine,
  focusMirrorName,
  isFocusRecord,
  unmarkedLine,
  type FocusMarkerLine,
} from '../machine/mark/marker.ts';

import {pageSentence, workingSentence} from './phrase.ts';
import {reviewGateForPhase} from './spine.ts';
import {turnAction, turnPhase} from './types.ts';

export type LiveFocus = {badge: string; text: string};

export type LiveFocusInput = {
  phase?: string | null;
  ask?: boolean;
  running?: boolean;
  turn?: BoardTurn;
  decision?: Decision;
  checks?: 'green' | 'red' | 'pending' | 'none';
  openCount?: number;
  /** Issue comments, oldest first. Absent when the caller cannot see them. */
  comments?: readonly {body: string}[];
  /** The accept retelling is already written, so the merge sentence is a tail. */
  hasAcceptFocus?: boolean;
};

export const WAIT_LABEL_PAGE = 'Метка sdd:wait-human стоит.';

/** Prose of the latest comment whose first line is `sdd:wait-human`. */
export function waitHumanPage(comments: readonly {body: string}[]): string {
  for (let index = comments.length - 1; index >= 0; index -= 1) {
    const body = comments[index]?.body ?? '';
    if (unmarkedLine(body) !== 'sdd:wait-human') {
      continue;
    }
    const prose = body.split('\n').slice(1).join('\n').trim();
    if (prose !== '') {
      return prose;
    }
  }
  return WAIT_LABEL_PAGE;
}

function plainWaitHuman(decision: Decision | undefined): boolean {
  return (
    decision?.kind === 'wait' &&
    decision.gate === undefined &&
    decision.reason.startsWith('sdd:wait-human is set')
  );
}

/** Accepting keeps the written focus except for the pages the plan names on their own. */
function acceptingKeepsFocus(reason: string): boolean {
  if (reason.startsWith('wait for merge of PR #')) {
    return false;
  }
  if (reason.startsWith('sdd:wait-human is set')) {
    return false;
  }
  if (reason.startsWith('wait for green checks before merge of PR #')) {
    return false;
  }
  if (reason === NO_OPEN_PULL) {
    return false;
  }
  if (reason.startsWith('refused ')) {
    return false;
  }
  if (reason.startsWith('archive refused:')) {
    return false;
  }
  if (reason.startsWith('the rebuilt spec would have no requirement')) {
    return false;
  }
  return true;
}

/** True while a review gate should keep the written focus as the open page. */
export function liveFocusReviewGate(input: LiveFocusInput): boolean {
  const decision = input.decision;
  if (decision?.kind === 'wait' && decision.gate !== undefined) {
    return reviewGateForPhase(decision.gate.from) !== undefined;
  }
  if (input.phase === 'accepting' && decision?.kind === 'wait') {
    if (decision.reason.startsWith('wait for merge of PR #')) {
      return input.hasAcceptFocus === true;
    }
    return acceptingKeepsFocus(decision.reason);
  }
  return false;
}

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

const ARCHIVE_REFUSED = 'archive refused: ';
const EMPTY_BASELINE = 'the rebuilt spec would have no requirement:';

/** What a refused archive said. Accepting hides every other wait behind the written focus. */
function archiveSentence(decision: LiveFocusInput['decision']): string | undefined {
  if (decision?.kind !== 'wait') {
    return undefined;
  }
  if (decision.reason.startsWith(ARCHIVE_REFUSED)) {
    const text = decision.reason.slice(ARCHIVE_REFUSED.length).trim();
    return text === '' ? undefined : text;
  }
  if (decision.reason.startsWith(EMPTY_BASELINE)) {
    return decision.reason;
  }
  return undefined;
}

/** Chooses the live pager sentence from spy inputs. Review gate suppression is the caller's job. */
export function liveFocus(input: LiveFocusInput): LiveFocus | undefined {
  const archive = archiveSentence(input.decision);
  if (archive !== undefined) {
    return {badge: 'archive', text: archive};
  }
  if (input.decision?.kind === 'wait' && input.decision.reason.startsWith('refused ')) {
    return {badge: 'waiting', text: input.decision.reason};
  }
  if (liveFocusReviewGate(input)) {
    return undefined;
  }
  if (input.running) {
    const action = turnAction(input.turn);
    const phase = turnPhase(input.turn);
    if (action !== undefined && phase !== undefined) {
      const reason = input.decision?.kind === 'agent' ? input.decision.reason : '';
      return {badge: 'working', text: workingSentence(action, reason)};
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
  if (plainWaitHuman(decision) && input.comments !== undefined) {
    return {badge: 'waiting', text: waitHumanPage(input.comments)};
  }
  const spoken = decision ? pageSentence(decision, input.openCount ?? 0) : undefined;
  if (spoken !== undefined && decision) {
    const linked =
      decision.kind === 'wait' &&
      (decision.reason.startsWith('wait for children') || decision.reason.startsWith('wait for blockers'));
    const working = decision.kind === 'agent' || decision.kind === 'archive';
    return {badge: working ? 'working' : linked ? 'waiting on an issue' : 'waiting', text: spoken};
  }
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
    if (decision?.kind === 'agent') {
      return undefined;
    }
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
