import {GATE_PHASES, removedPhaseLabels, type Phase} from './phase.ts';
import type {Tracker} from './port.ts';

const LABEL = (phase: string) => `sdd:${phase}`;

export function setPhase(key: string, phase: Phase, tracker: Tracker, options?: {allowGate?: boolean}): void {
  if (!options?.allowGate && (GATE_PHASES as readonly string[]).includes(phase)) {
    throw new Error(`Refusing to set gate label sdd:${phase}. A person runs remote-solver accept ${key}.`);
  }
  const names = tracker.labels(key);
  const remove = removedPhaseLabels(names, phase);
  tracker.editLabels(key, [LABEL(phase)], remove);
}

export function setWait(key: string, waiting: boolean, tracker: Tracker): void {
  if (!waiting) {
    const names = tracker.labels(key);
    if (!names.includes('sdd:wait-human')) {
      return;
    }
    tracker.editLabels(key, [], ['sdd:wait-human']);
    return;
  }
  tracker.editLabels(key, ['sdd:wait-human'], []);
}
