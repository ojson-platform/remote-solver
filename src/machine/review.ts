import {authorIgnored} from './ignore.ts';
import {markerName, parseMarker} from './marker.ts';
import {phaseRank, type Phase} from './phase.ts';
import type {Conversation, Thread, ThreadRecord} from './port.ts';

export {markRobot, ROBOT_MARK} from './marker.ts';

/** The spy mark, or a commenter named in `sandcastle.yaml`. A `[bot]` login is a person. */
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

/**
 * What `remote-solver threads <pull>` prints. Open threads only. `layer`
 * keeps the threads whose latest reply carries that marker; `unmarked` keeps
 * the ones with no marker at all.
 */
export function threadsReport(
  threads: ThreadRecord[],
  comments: Conversation[],
  filter?: {layer?: string; unmarked?: boolean},
): ThreadsReport {
  const lines = threads
    .filter(thread => !thread.resolved)
    .map(thread => ({
      thread: thread.id,
      comment: thread.comment,
      file: thread.path,
      line: thread.line,
      marker: markerOf(thread.body),
      body: thread.body,
    }))
    .filter(line => (filter?.layer ? line.marker === filter.layer : true))
    .filter(line => (filter?.unmarked ? line.marker === null : true));
  return {
    threads: lines,
    conversation: {
      last: comments.at(-1) ?? null,
      layer: conversationLayer(comments),
      unanswered: conversationUnanswered(comments),
    },
  };
}

/** An open thread without a marker is unanswered; only a layer marker opens a phase. */
export function reviewOf(threads: Thread[], comments: Conversation[]): ReviewView {
  const layers: string[] = [];
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
  return {unanswered, rollback, layers};
}
