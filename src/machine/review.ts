import {phaseRank, type Phase} from './phase.ts';
import type {Conversation, Thread} from './port.ts';

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

export function reviewOf(threads: Thread[], comments: Conversation[]): ReviewView {
  const layers: string[] = [];
  let unanswered = false;
  for (const thread of threads) {
    if (thread.resolved || thread.body.includes('sdd:note')) {
      continue;
    }
    const layer = thread.body.match(/sdd:layer=([a-z]+)/)?.[1];
    if (!layer) {
      unanswered = true;
      continue;
    }
    layers.push(layer);
  }
  const last = comments.at(-1);
  if (
    last &&
    !last.robot &&
    !last.body.includes('sdd:layer=') &&
    !last.body.includes('sdd:note') &&
    !last.body.includes('sdd:begin')
  ) {
    unanswered = true;
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
