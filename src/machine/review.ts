import {authorIgnored} from './ignore.ts';
import {markerName, parseMarker} from './marker.ts';
import {phaseRank, type Phase} from './phase.ts';
import type {Conversation, Thread, ThreadRecord} from './port.ts';

export {markRobot, ROBOT_MARK} from './marker.ts';

/** The spy mark, or a commenter named in the pattern list. A `[bot]` login is a person. */
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
 * is unanswered. Only a layer marker opens a phase. `fixed` closes a conversation
 * layer. Handles are kept for the threads verb.
 */
export function readReview(
  threads: readonly ReadThread[],
  comments: Conversation[],
): ReviewReading {
  const layers: string[] = [];
  const lines: ThreadLine[] = [];
  let unanswered = conversationUnanswered(comments);
  for (const thread of threads) {
    if (thread.resolved) {
      continue;
    }
    const marker = parseMarker(thread.body);
    if (!marker) {
      unanswered = true;
    } else if (marker.kind === 'layer') {
      layers.push(marker.layer);
    }
    lines.push({
      thread: thread.id ?? '',
      comment: thread.comment ?? '',
      file: thread.path ?? '',
      line: thread.line ?? null,
      marker: markerOf(thread.body),
      body: thread.body,
    });
  }
  const fromConversation = conversationLayer(comments);
  if (fromConversation) {
    layers.push(fromConversation);
  }
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
): ThreadsReport {
  const reading = readReview(threads, comments);
  const lines = reading.threads
    .filter(line => (filter?.layer ? line.marker === filter.layer : true))
    .filter(line => (filter?.unmarked ? line.marker === null : true));
  return {threads: lines, conversation: reading.conversation};
}

/** The cycle's view of the same reading: unanswered, rollback, and layers. */
export function reviewOf(threads: readonly ReadThread[], comments: Conversation[]): ReviewView {
  const reading = readReview(threads, comments);
  return {unanswered: reading.unanswered, rollback: reading.rollback, layers: reading.layers};
}
