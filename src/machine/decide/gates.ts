import type {Phase} from '../phase/phase.ts';

import path from 'node:path';

import {HEADINGS, specsReady, type ChangeView} from '../change/change.ts';
import {changeDir} from '../change/naming.ts';

/** What still stops a person from closing a writing phase. Null when nothing does. */
export function writingGate(phase: Phase, change: ChangeView): {artifact: boolean; open: number} {
  if (phase === 'proposing') {
    return {artifact: change.proposal, open: change.openQuestions};
  }
  if (phase === 'specifying') {
    return {artifact: specsReady(change), open: 0};
  }
  if (phase === 'designing') {
    return {artifact: change.design, open: change.openDecisions};
  }
  return {artifact: true, open: 0};
}

/** The phase file's stamp is behind its input. Empty revisions are the test harness, not a checkout. */
export function stampBehind(phase: Phase, change: ChangeView): string | null {
  if (
    phase === 'specifying' &&
    change.delta &&
    (change.specDrift ||
      (change.proposalRevision !== '' && change.specStamp !== change.proposalRevision))
  ) {
    return 'the proposal revision is not the stamp';
  }
  if (
    phase === 'designing' &&
    change.design &&
    (change.designDrift ||
      (change.specsRevision !== '' && change.designStamp !== change.specsRevision))
  ) {
    return 'the spec revision is not the stamp';
  }
  if (
    phase === 'tasking' &&
    change.tasks &&
    (change.tasksDrift ||
      (change.tasksInputRevision !== '' && change.tasksStamp !== change.tasksInputRevision))
  ) {
    return 'the design revision is not the stamp';
  }
  return null;
}

export function gateBlocker(key: string, phase: Phase, change: ChangeView): string | null {
  const gate = writingGate(phase, change);
  const required =
    phase === 'proposing' ? 'proposal.md' : phase === 'specifying' ? 'specs' : 'design.md';
  const file = path.join(changeDir(key), required);
  if (!gate.artifact) {
    return `Missing ${file}`;
  }
  if (gate.open) {
    const heading = phase === 'designing' ? HEADINGS.openDecisions : HEADINGS.openQuestions;
    return `#${key} still has open items under ## ${heading} in ${file}`;
  }
  return stampBehind(phase, change);
}
