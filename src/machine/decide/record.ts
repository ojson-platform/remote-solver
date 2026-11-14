import type {IssueRecord} from '../port.ts';
import type {CycleRecord, Decision, IssueNote} from './types.ts';

import {ROBOT_MARK} from '../mark/marker.ts';
import {foldedFromTip, GATE_CLOSES, phaseOf, type GateEvent} from '../phase/phase.ts';

/** `phase`, `action`, and `reason` of one effect. Null bytes stay inside the process. */
export function effectSignature(part: {phase: string; action: string; reason: string}): string {
  return `${part.phase}\0${part.action}\0${part.reason}`;
}

/** The comment a tracker can carry. The null-byte signature is split onto three lines. */
export const REFUSAL_ASK = 'A comment on this issue runs this step again.';

export function refusalBody(signature: string): string {
  const [phase = '', action = '', ...rest] = signature.split('\0');
  return ['sdd:refused', phase, action, rest.join('\0'), REFUSAL_ASK].join('\n');
}

type Refusal = {phase: string; action: string; reason: string; note: string};

/** The latest `sdd:refused`. A later person comment releases it. The reason is one line; the note is the rest. */
function refusalFrom(notes: readonly IssueNote[]): Refusal | null {
  for (let index = notes.length - 1; index >= 0; index -= 1) {
    const lines = commentLines(notes[index]);
    if (lines[0] !== 'sdd:refused') {
      continue;
    }
    const rest = lines.slice(4).filter(line => line !== REFUSAL_ASK);
    return {
      phase: lines[1] ?? '',
      action: lines[2] ?? '',
      reason: lines[3] ?? '',
      note: rest.join('\n'),
    };
  }
  return null;
}

/** A person comment after `sdd:refused` releases that hold. */
export function personReleasedRefusal(notes: readonly IssueNote[]): boolean {
  let refusedAt = -1;
  for (let index = 0; index < notes.length; index += 1) {
    if (commentLines(notes[index])[0] === 'sdd:refused') {
      refusedAt = index;
    }
  }
  if (refusedAt < 0) {
    return false;
  }
  return notes.slice(refusedAt + 1).some(note => note.manager === true);
}

function commentLines(note: IssueNote): string[] {
  return note.body
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '')
    .map((line, index) =>
      index === 0 && line.startsWith(ROBOT_MARK) ? line.slice(ROBOT_MARK.length).trim() : line,
    );
}

/** `threads on <layer>` whose layer has no open thread. Any other refusal stays. */
export function spentThreadRefusal(notes: readonly IssueNote[], layers: readonly string[]): boolean {
  const found = refusalFrom(notes);
  if (!found) {
    return false;
  }
  const layer = /^threads on ([a-z]+)$/.exec(found.reason)?.[1];
  return layer !== undefined && !layers.includes(layer);
}

/** The refusal the label `sdd:refused` is holding. */
export function refusalOf(notes: readonly IssueNote[]): string | null {
  const found = refusalFrom(notes);
  if (!found) {
    return null;
  }
  return effectSignature(found);
}

/** What the command said, kept after the effect's own reason. */
export function refusalNote(notes: readonly IssueNote[]): string | null {
  const found = refusalFrom(notes);
  if (!found || found.note === '') {
    return null;
  }
  return found.note;
}

/** The same empty effect does not start again. A different phase, action, or reason does. */
export function blockRepeated(
  decision: Decision,
  refused: string | null,
  note: string | null = null,
): Decision {
  if (refused === null) {
    return decision;
  }
  const effect =
    decision.kind === 'agent'
      ? {phase: decision.phase, action: decision.action, reason: decision.reason}
      : null;
  if (!effect || refused !== effectSignature(effect)) {
    return decision;
  }
  return {
    kind: 'wait',
    issue: decision.issue,
    reason: note !== null && note !== '' ? note : `refused ${effect.action}: ${effect.reason}`,
  };
}

function gateEvent(names: readonly string[]): GateEvent | null {
  if (names.includes('sdd:designed')) {
    return 'designed';
  }
  if (names.includes('sdd:specified')) {
    return 'specified';
  }
  if (names.includes('sdd:proposed')) {
    return 'proposed';
  }
  return null;
}

/** Labels, `sdd:wait-human`, and the tip line, read once before the decision. */
export function cycleRecord(
  issue: IssueRecord,
  tip = '',
  notes: readonly IssueNote[] = [],
): CycleRecord {
  const names = issue.labels;
  const accept = gateEvent(names);
  const phase = phaseOf(names) ?? (accept ? (GATE_CLOSES[accept] ?? null) : null);
  return {
    phase,
    hold:
      names.includes('sdd:wait-human') && phase
        ? `sdd:wait-human is set on ${phase}. Do the ask on the issue.`
        : null,
    folded: foldedFromTip(tip, issue.key),
    cycle: names.includes('sdd:cycle'),
    autoPlan: names.includes('sdd:auto-plan'),
    autoSpec: names.includes('sdd:auto-spec'),
    autoDesign: names.includes('sdd:auto-design'),
    autoMerge: names.includes('sdd:auto-merge'),
    accept,
    refused: names.includes('sdd:refused') ? refusalOf(notes) : null,
    refusalNote: names.includes('sdd:refused') ? refusalNote(notes) : null,
  };
}

/** The comment that names the effect, and the label that holds it. */
export async function postRefusal(
  tracker: {
    comment(key: string, body: string): Promise<void>;
    labels(key: string): Promise<string[]>;
    editLabels(key: string, add: string[], remove: string[]): Promise<void>;
  },
  key: string,
  body: string,
): Promise<void> {
  await tracker.comment(key, body);
  const names = await tracker.labels(key);
  if (!names.includes('sdd:refused')) {
    await tracker.editLabels(key, ['sdd:refused'], []);
  }
}
