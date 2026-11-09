import {HEADINGS} from './change.ts';
import {authorIgnored} from './ignore.ts';
import {markerName, parseMarker} from './marker.ts';
import {phaseRank, type Phase} from './phase.ts';
import type {Conversation, Thread, ThreadRecord} from './port.ts';

export {markRobot, ROBOT_MARK} from './marker.ts';

/** The spy mark, or a commenter named in the pattern list. */
export function spokeByRobot(body: string, login: string, ignored: readonly RegExp[]): boolean {
  return body.startsWith('🤖') || authorIgnored(login, ignored);
}

/** Comments in order: a layer opens, `fixed` closes, other markers leave it as it is. */
function conversationLayer(comments: Conversation[]): string | null {
  let layer: string | null = null;
  for (const comment of comments) {
    const marker = parseMarker(comment.body);
    if (marker?.kind === 'fixed') {
      layer = null;
    } else if (marker?.kind === 'layer') {
      layer = marker.layer;
    }
  }
  return layer;
}

/** The last conversation comment is a person's and carries no marker. */
function conversationUnanswered(comments: Conversation[]): boolean {
  const last = comments.at(-1);
  return Boolean(last && !last.robot && parseMarker(last.body) === null);
}

const LAYER_PHASE: Record<string, Phase> = {
  proposal: 'proposing',
  spec: 'specifying',
  design: 'designing',
  tasks: 'tasking',
  code: 'implementing',
};

export type ReviewView = {
  unanswered: boolean;
  /** Earliest phase a marker names. `out` does not move the phase. */
  rollback: Phase | null;
  layers: string[];
};

export const emptyReview: ReviewView = {unanswered: false, rollback: null, layers: []};

export function phaseOfLayer(layer: string): Phase | null {
  return LAYER_PHASE[layer] ?? null;
}

export function layerOfPhase(phase: Phase): string | null {
  return Object.entries(LAYER_PHASE).find(([, value]) => value === phase)?.[0] ?? null;
}

/** Reads one change file. Absent when the path is not in this checkout. */
export type OpenItemFile = (rel: string) => string | undefined;

/** The layer an unchecked item forces. A checked item and any other line stay with the reply. */
export function openItemLayer(
  file: string,
  line: number | null,
  text: string | undefined,
): 'proposal' | 'design' | null {
  if (line === null || line < 1 || text === undefined) {
    return null;
  }
  const name = file.split('\\').join('/');
  if (!name.includes('openspec/changes/') || name.includes('openspec/changes/archive/')) {
    return null;
  }
  const kind = name.endsWith('/proposal.md')
    ? 'proposal'
    : name.endsWith('/design.md')
      ? 'design'
      : null;
  if (!kind) {
    return null;
  }
  const lines = text.split(/\r?\n/);
  if (line > lines.length) {
    return null;
  }
  const wanted = kind === 'proposal' ? HEADINGS.openQuestions : HEADINGS.openDecisions;
  let heading = '';
  for (let index = 0; index < line; index += 1) {
    const found = /^## (.+?)\s*$/.exec(lines[index] ?? '');
    if (found?.[1]) {
      heading = found[1];
    }
  }
  if (heading !== wanted) {
    return null;
  }
  return (lines[line - 1] ?? '').trim().startsWith('- [ ]') ? kind : null;
}

/** The marker the latest reply carries: a layer, `note`, `fixed`, `begin`, or nothing. */
export function markerOf(body: string): string | null {
  return markerName(parseMarker(body));
}

export type ThreadLine = {
  thread: string;
  comment: string;
  file: string;
  line: number | null;
  marker: string | null;
  body: string;
};

export type ThreadsReport = {
  threads: ThreadLine[];
  /**
   * The last conversation comment, the layer the conversation still asks for,
   * and whether that last comment still waits for a marker.
   */
  conversation: {last: Conversation | null; layer: string | null; unanswered: boolean};
};

/** A thread the reading can see. Handles are present when the caller has them. */
export type ReadThread = Thread & {
  id?: string;
  comment?: string;
  path?: string;
  line?: number | null;
};

/** One reading of threads and the conversation. The cycle and `threads` both take it. */
export type ReviewReading = ReviewView & {
  threads: ThreadLine[];
  conversation: ThreadsReport['conversation'];
};

/**
 * Open threads and the conversation, read once. An open thread without a marker
 * is unanswered. An open thread's layer marker opens a phase. A conversation
 * layer is recorded and does not. `fixed` closes a conversation layer.
 * Handles are kept for the threads verb.
 */
export function readReview(
  threads: readonly ReadThread[],
  comments: Conversation[],
  fileAt?: OpenItemFile,
): ReviewReading {
  const layers: string[] = [];
  const lines: ThreadLine[] = [];
  let unanswered = conversationUnanswered(comments);
  for (const thread of threads) {
    if (thread.resolved) {
      continue;
    }
    const marker = parseMarker(thread.body);
    const pinned =
      marker?.kind === 'fixed'
        ? null
        : openItemLayer(thread.path ?? '', thread.line ?? null, fileAt?.(thread.path ?? ''));
    if (!marker && !pinned) {
      unanswered = true;
    } else if (pinned) {
      layers.push(pinned);
    } else if (marker?.kind === 'layer') {
      layers.push(marker.layer);
    }
    lines.push({
      thread: thread.id ?? '',
      comment: thread.comment ?? '',
      file: thread.path ?? '',
      line: thread.line ?? null,
      marker: pinned ?? markerOf(thread.body),
      body: thread.body,
    });
  }
  const fromConversation = conversationLayer(comments);
  let rollback: Phase | null = null;
  for (const layer of layers) {
    const phase = phaseOfLayer(layer);
    if (phase && (rollback === null || phaseRank(phase) < phaseRank(rollback))) {
      rollback = phase;
    }
  }
  return {
    unanswered,
    rollback,
    layers,
    threads: lines,
    conversation: {
      last: comments.at(-1) ?? null,
      layer: fromConversation,
      unanswered: conversationUnanswered(comments),
    },
  };
}

/**
 * What `sdd threads <pull>` prints. Open threads only. `layer`
 * keeps the threads whose latest reply carries that marker; `unmarked` keeps
 * the ones with no marker at all.
 */
export function threadsReport(
  threads: ThreadRecord[],
  comments: Conversation[],
  filter?: {layer?: string; unmarked?: boolean},
  fileAt?: OpenItemFile,
): ThreadsReport {
  const reading = readReview(threads, comments, fileAt);
  const lines = reading.threads
    .filter(line => (filter?.layer ? line.marker === filter.layer : true))
    .filter(line => (filter?.unmarked ? line.marker === null : true));
  return {threads: lines, conversation: reading.conversation};
}

/** The cycle's view of the same reading: unanswered, rollback, and layers. */
export function reviewOf(
  threads: readonly ReadThread[],
  comments: Conversation[],
  fileAt?: OpenItemFile,
): ReviewView {
  const reading = readReview(threads, comments, fileAt);
  return {unanswered: reading.unanswered, rollback: reading.rollback, layers: reading.layers};
}
