export const PHASES = [
  'proposing',
  'specifying',
  'designing',
  'tasking',
  'implementing',
  'verifying',
  'accepting',
  'accepted',
  'cancelled',
] as const;

/** Acceptance of a writing phase. The issue does not stay on these. */
export const GATE_EVENTS = ['proposed', 'specified', 'designed'] as const;

export type GateEvent = (typeof GATE_EVENTS)[number];

export type Phase = (typeof PHASES)[number] | GateEvent;

/** Closed by a person. The robot CLI cannot set these. */
export const GATE_PHASES = ['proposed', 'specified', 'designed', 'accepted'] as const;

/** The writing phase each review gate closes. */
export const GATE_CLOSES: Partial<Record<Phase, Phase>> = {
  proposed: 'proposing',
  specified: 'specifying',
  designed: 'designing',
};

const LABEL = (phase: string) => `sdd:${phase}`;

/** The line an archive commit carries for one issue. */
export function archiveMark(key: string): string {
  return `Sdd-Archive: issue-${key}`;
}

/** True when the tip message carries this issue's archive line. */
export function foldedFromTip(tip: string, key: string): boolean {
  const mark = archiveMark(key);
  return tip.split('\n').some(line => line.trimEnd() === mark);
}

export function phaseOf(labels: string[]): Phase | null {
  const found = PHASES.filter(phase => labels.includes(LABEL(phase)));
  // The cycle is closed. This label wins even when the previous phase label
  // is still on, so the spy does not keep waiting.
  if (found.includes('accepted')) {
    return 'accepted';
  }
  if (found.includes('cancelled')) {
    return 'cancelled';
  }
  if (found[0]) {
    return found[0];
  }
  // A person may replace the writing label with the gate. The phase is still
  // the writing one; the gate is only consent.
  if (labels.includes('sdd:designed')) {
    return 'designing';
  }
  if (labels.includes('sdd:specified')) {
    return 'specifying';
  }
  if (labels.includes('sdd:proposed')) {
    return 'proposing';
  }
  return null;
}

/** Index of a working phase. A gate event is not a rank. */
export function phaseRank(phase: Phase): number {
  return (PHASES as readonly string[]).indexOf(phase);
}

/** Rank of the working phase the labels name. A lone gate event stays that writing phase. Cancellation cuts the rank only when it is the phase. */
export function reachedRank(labels: readonly string[]): number {
  const phase = phaseOf([...labels]);
  if (!phase || phase === 'cancelled') {
    return -1;
  }
  return phaseRank(phase);
}

export function removedPhaseLabels(labels: string[], to: Phase): string[] {
  const add = LABEL(to);
  return labels.filter(name => PHASES.some(phase => name === LABEL(phase)) && name !== add);
}

/** Labels after a mechanical advance: one phase label, and the human wait is cleared. */
export function labelsAfterAdvance(labels: string[], to: Phase): string[] {
  const kept = labels.filter(
    name =>
      name !== 'sdd:wait-human' &&
      !PHASES.some(phase => name === LABEL(phase)) &&
      !(GATE_EVENTS as readonly string[]).some(gate => name === LABEL(gate)),
  );
  return [...kept, LABEL(to)];
}
