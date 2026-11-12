import type {ChangeView} from '../change/change.ts';
import type {GateEvent, Phase} from '../phase/phase.ts';
import type {IssueRecord} from '../port.ts';
import type {CycleRecord, Decision, LabelFix, PullSnapshot} from './types.ts';

import {acceptReviewGate} from './ahead.ts';
import {gateBlocker} from './gates.ts';

const HUMAN_NEXT: Partial<Record<Phase, Phase>> = {
  proposing: 'specifying',
  specifying: 'designing',
  designing: 'tasking',
};

const GATE_OF: Partial<Record<Phase, GateEvent>> = {
  proposing: 'proposed',
  specifying: 'specified',
  designing: 'designed',
};

const AUTO_OF: Partial<Record<Phase, string>> = {
  proposing: 'sdd:auto-plan',
  specifying: 'sdd:auto-spec',
  designing: 'sdd:auto-design',
};

function autoOn(record: CycleRecord, tag: string): boolean {
  switch (tag) {
    case 'sdd:auto-plan':
      return record.autoPlan;
    case 'sdd:auto-spec':
      return record.autoSpec;
    case 'sdd:auto-design':
      return record.autoDesign;
    case 'sdd:auto-merge':
      return record.autoMerge;
    default:
      return false;
  }
}

export type Hand = (decision: Decision) => Decision;

/**
 * A gate label and `sdd accept` are the same event. Granted consent moves the
 * phase. A failed guard returns a hand that drops the label and keeps the
 * writing phase on whatever the phase decides next.
 */
export function writingConsent(
  issue: IssueRecord,
  change: ChangeView,
  record: CycleRecord,
  pr: PullSnapshot | undefined,
): Decision | Hand {
  const phase = record.phase;
  const gate = phase ? GATE_OF[phase] : undefined;
  const autoTag = phase ? AUTO_OF[phase] : undefined;
  const person = gate !== undefined && record.accept === gate;
  const granted =
    person || (autoTag !== undefined && autoOn(record, autoTag) && record.hold === null);
  const blocker = phase && gate ? gateBlocker(issue.key, phase, change) : null;
  if (granted && gate && phase && pr && !blocker) {
    const next = HUMAN_NEXT[phase] as Phase;
    const reason = person ? `${phase} → ${next}` : autoTag;
    if (reason !== undefined) {
      return person
        ? {
            kind: 'advance',
            issue: issue.key,
            to: next,
            reason,
            comment: `sdd:accept ${phase} → ${next}`,
          }
        : {kind: 'advance', issue: issue.key, to: next, reason};
    }
  }
  const patch: LabelFix = person && gate && phase ? {drop: [`sdd:${gate}`], stay: phase} : {};
  return decision => (patch.drop || patch.stay ? {...decision, ...patch} : decision);
}

export function isAdvance(value: Decision | Hand): value is Decision {
  return typeof value !== 'function';
}

/** `sdd:wait-human` holds. On a ready writing phase the same poll keeps the review gate. */
export function heldReview(
  issue: IssueRecord,
  change: ChangeView,
  record: CycleRecord,
  hand: Hand,
  pr?: PullSnapshot,
): Decision | null {
  if (record.hold === null || record.phase === null) {
    return null;
  }
  const phase = record.phase;
  const review =
    phase === 'proposing'
      ? {artifact: 'proposal' as const, to: 'proposed' as const}
      : phase === 'specifying'
        ? {artifact: 'spec' as const, to: 'specified' as const}
        : phase === 'designing'
          ? {artifact: 'design' as const, to: 'designed' as const}
          : null;
  if (review && !gateBlocker(issue.key, phase, change)) {
    return hand(acceptReviewGate(issue.key, review.artifact, phase, review.to, change, pr));
  }
  return hand({kind: 'wait', issue: issue.key, reason: record.hold});
}

export function nextWritingPhase(phase: Phase): Phase | undefined {
  return HUMAN_NEXT[phase];
}
