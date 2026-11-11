import type {ChangeView} from '../change/change.ts';
import type {IssueRecord} from '../port.ts';
import type {CycleRecord, Decision, PullSnapshot, Settlement} from './types.ts';

import {labelsAfterAdvance} from '../phase/phase.ts';

import {nextWritingPhase} from './consent.ts';
import {gateBlocker} from './gates.ts';
import {decide} from './open.ts';
import {cycleRecord} from './record.ts';

/** `sdd accept` closes only a ready writing phase. It does not post the ask. */
export function accept(
  issue: IssueRecord,
  change: ChangeView,
  record: CycleRecord = cycleRecord(issue),
  pulls?: readonly {state: string}[],
): Decision {
  if (pulls !== undefined && pulls.filter(pr => pr.state === 'OPEN').length !== 1) {
    return {kind: 'wait', issue: issue.key, reason: 'accept needs one open pull request'};
  }
  if (!record.cycle) {
    return {kind: 'wait', issue: issue.key, reason: `#${issue.key} has no sdd:cycle label`};
  }
  const phase = record.phase;
  const next = phase ? nextWritingPhase(phase) : undefined;
  if (!phase || !next) {
    return {
      kind: 'wait',
      issue: issue.key,
      reason: `#${issue.key} is ${phase ?? 'without a phase'}. Accept closes only proposing, specifying, or designing.`,
    };
  }
  const blocker = gateBlocker(issue.key, phase, change);
  if (blocker) {
    return {kind: 'wait', issue: issue.key, reason: blocker};
  }
  return {kind: 'advance', issue: issue.key, to: next, reason: `${phase} → ${next}`};
}

/** Apply label fixes until the decision is no longer a plain advance. Twelve steps is the stop. */
export function settle(
  issue: IssueRecord,
  issues: IssueRecord[],
  pulls: PullSnapshot[],
  change: ChangeView,
  tip?: string,
): Settlement {
  const message = tip ?? '';
  let labels = [...issue.labels];
  const transitions: Settlement['transitions'] = [];
  for (let step = 0; step < 12; step += 1) {
    const decision = decide(
      {...issue, labels},
      issues,
      pulls,
      change,
      cycleRecord({...issue, labels}, message),
    );
    if (decision.drop?.length) {
      const dropping = new Set(decision.drop);
      labels = labels.filter(name => !dropping.has(name));
    }
    if (decision.kind !== 'advance') {
      if (decision.stay && !labels.includes(`sdd:${decision.stay}`)) {
        labels = [...labels, `sdd:${decision.stay}`];
      }
      return {decision, transitions, labels};
    }
    labels = labelsAfterAdvance(labels, decision.to);
    transitions.push(decision);
    // Closing the issue is not a label change the next decide can see.
    if (decision.to === 'accepted') {
      return {
        decision: {kind: 'done', issue: issue.key, reason: decision.reason},
        transitions,
        labels,
      };
    }
  }
  return {
    decision: {kind: 'wait', issue: issue.key, reason: 'Too many mechanical transitions'},
    transitions,
    labels,
  };
}
