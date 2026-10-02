import {GATE_PHASES, removedPhaseLabels, type Phase} from './phase.ts';
import type {Gate} from './policy.ts';
import type {Tracker} from './port.ts';

const LABEL = (phase: string) => `sdd:${phase}`;

export async function setPhase(
  key: string,
  phase: Phase,
  tracker: Tracker,
  options?: {allowGate?: boolean},
): Promise<void> {
  if (!options?.allowGate && (GATE_PHASES as readonly string[]).includes(phase)) {
    throw new Error(
      `Refusing to set gate label sdd:${phase}. A person changes the phase on the issue, or runs sdd accept ${key}.`,
    );
  }
  const names = await tracker.labels(key);
  const remove = removedPhaseLabels(names, phase);
  await tracker.editLabels(key, [LABEL(phase)], remove);
}

export async function setWait(key: string, waiting: boolean, tracker: Tracker): Promise<void> {
  if (!waiting) {
    const names = await tracker.labels(key);
    if (!names.includes('sdd:wait-human')) {
      return;
    }
    await tracker.editLabels(key, [], ['sdd:wait-human']);
    return;
  }
  await tracker.editLabels(key, ['sdd:wait-human'], []);
}

/** The `wait` verb and the machine's review gate: the label, then the ask as an issue comment. */
export async function openWait(key: string, ask: string, tracker: Tracker): Promise<void> {
  await setWait(key, true, tracker);
  await tracker.comment(key, ask);
}

/** The review gate ask. The tracker says how a person moves the phase there. */
export function gateAsk(key: string, gate: Gate, tracker: Tracker): string {
  const hint = tracker.phaseHint(gate.from, gate.to);
  return `Review the ${gate.artifact}. To accept it, ${hint} on this issue, or run \`sdd accept ${key}\`.`;
}
