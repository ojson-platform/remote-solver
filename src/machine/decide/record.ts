import type {IssueRecord} from '../port.ts';
import type {CycleRecord, Decision, IssueNote} from './types.ts';

import {ROBOT_MARK} from '../mark/marker.ts';
import {foldedFromTip, GATE_CLOSES, phaseOf, type GateEvent} from '../phase/phase.ts';

/** `phase`, `action`, and `reason` of one effect. Null bytes stay inside the process. */
export function effectSignature(part: {phase: string; action: string; reason: string}): string {
  return `${part.phase}\0${part.action}\0${part.reason}`;
}

/** The comment a tracker can carry. The null-byte signature is split onto three lines. */
export function refusalBody(signature: string): string {
  const [phase = '', action = '', ...rest] = signature.split('\0');
  return ['sdd:refused', phase, action, rest.join('\0')].join('\n');
}

type Refusal = {phase: string; action: string; reason: string; note: string};

/** The latest `sdd:refused`. A person comment does not clear it. The reason is one line; the note is the rest. */
function refusalFrom(notes: readonly IssueNote[]): Refusal | null {
  for (let index = notes.length - 1; index >= 0; index -= 1) {
    const note = notes[index];
    const lines = note.body
      .split('\n')
      .map(line => line.trim())
      .filter(line => line !== '');
    const head = lines[0]?.startsWith(ROBOT_MARK)
      ? lines[0].slice(ROBOT_MARK.length).trim()
      : lines[0];
    if (head === 'sdd:refused') {
      return {
        phase: lines[1] ?? '',
        action: lines[2] ?? '',
        reason: lines[3] ?? '',
        note: lines.slice(4).join('\n'),
      };
    }
  }
  return null;
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
      : decision.kind === 'archive'
        ? {phase: decision.phase, action: 'archive', reason: decision.reason}
        : decision.kind === 'unarchive'
          ? {phase: decision.phase, action: 'unarchive', reason: decision.reason}
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
