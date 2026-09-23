export const PHASES = [
  'proposing',
  'proposed',
  'specifying',
  'specified',
  'designing',
  'designed',
  'tasking',
  'implementing',
  'verifying',
  'accepting',
  'accepted',
  'cancelled',
] as const;

export type Phase = (typeof PHASES)[number];

/** Closed by a person. The robot CLI cannot set these. */
export const GATE_PHASES = ['proposed', 'specified', 'designed', 'accepted'] as const;

const LABEL = (phase: string) => `sdd:${phase}`;

export function phaseOf(labels: string[]): Phase | null {
  const found = PHASES.filter(phase => labels.includes(LABEL(phase)));
  // The cycle is closed. This label wins even when the previous phase label
  // is still on, so the spy does not keep waiting.
  if (found.includes('accepted')) {
    return 'accepted';
  }
  return found.length === 1 ? found[0] : (found[0] ?? null);
}

export function phaseRank(phase: Phase): number {
  return PHASES.indexOf(phase);
}

export function removedPhaseLabels(labels: string[], to: Phase): string[] {
  const add = LABEL(to);
  return labels.filter(name => PHASES.some(phase => name === LABEL(phase)) && name !== add);
}

/** Labels after a mechanical advance: one phase label, and the human wait is cleared. */
export function labelsAfterAdvance(labels: string[], to: Phase): string[] {
  const kept = labels.filter(
    name => name !== 'sdd:wait-human' && !PHASES.some(phase => name === LABEL(phase)),
  );
  return [...kept, LABEL(to)];
}
