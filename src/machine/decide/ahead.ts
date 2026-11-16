import {cardGap, type ChangeView} from '../change/change.ts';
import type {IssueRecord} from '../port.ts';
import type {CycleRecord, Decision, PullSnapshot} from './types.ts';

import {emptyReview, layerOfPhase, phaseThreadCountsForAccept} from '../mark/review.ts';
import {phaseRank, type Phase} from '../phase/phase.ts';

import {agent, reviewGate} from './agent.ts';
import {gateBlocker} from './gates.ts';
import {linkWait} from './links.ts';
import {finishedCycle, mergeOrWait} from './pulls.ts';
import {LAYER_ACTION} from './route.ts';

export type AheadRead = {
  issue: IssueRecord;
  issues: IssueRecord[];
  pulls: PullSnapshot[];
  change: ChangeView;
  record: CycleRecord;
  open: PullSnapshot[];
};

/**
 * What is true for every phase before consent: cancellation, a finished
 * cycle, an archive sitting on the tip, unclassified threads, a rollback
 * marker, a conflict, and a spec that still has no baseline or shelf.
 * Null means the phase itself may decide.
 */
function taskReason(change: ChangeView): string {
  return change.openTask ? `next open task ${change.openTask}` : 'next open task';
}

export function decideAhead(read: AheadRead): Decision | null {
  const {issue, issues, pulls, change, record, open} = read;
  const phase = record.phase;
  if (phase === 'cancelled') {
    return {kind: 'done', issue: issue.key, reason: 'cancelled'};
  }
  if (!phase) {
    return {kind: 'advance', issue: issue.key, to: 'proposing', reason: 'enter the cycle'};
  }
  if (finishedCycle(pulls, record.folded, phase)) {
    return linkWait(issue, issues) ?? {kind: 'done', issue: issue.key, reason: 'finished cycle'};
  }
  if (phase === 'accepted') {
    if (!record.folded) {
      return {kind: 'wait', issue: issue.key, reason: 'the change is not archived'};
    }
    const acceptedMerged = pulls.filter(item => item.state === 'MERGED');
    return mergeOrWait(issue.key, open[0], acceptedMerged, false);
  }
  const pr = open[0];
  const feedback = pr?.review ?? emptyReview;
  // A repair must not commit on top of the archive commit. This stays ahead
  // of an unlabeled thread: the thread is classified on the restored change.
  if (
    phaseRank(phase) < phaseRank('accepting') &&
    record.folded &&
    !pulls.some(item => item.state === 'MERGED')
  ) {
    return agent(
      issue.key,
      'unarchive',
      phase,
      pr ? String(pr.id) : '',
      'return the delta to the change',
    );
  }

  // An unlabeled thread is classified before the open task. Two pull requests
  // would otherwise start that task and never reach classify-comments.
  if (feedback.unanswered && pr) {
    return agent(
      issue.key,
      'classify-comments',
      phase,
      String(pr.id),
      'unclassified review threads',
    );
  }

  const back = feedback.rollback;
  const checksKnown = pr?.checks === 'red' || pr?.checks === 'green';
  const earlierPhase =
    back && phaseRank(back) < phaseRank(phase) && (phase !== 'verifying' || checksKnown);

  // Two open pull requests keep the open task only after unarchive, an
  // unlabeled thread, and a card that still matches. Conflict and rollback
  // stay after this row so a marker does not cancel that task.
  if (
    open.length > 1 &&
    phase === 'implementing' &&
    change.tasks &&
    change.openTasks > 0 &&
    !cardGap(change) &&
    !earlierPhase
  ) {
    return agent(issue.key, 'implement-next-task', phase, String(open[0].id), taskReason(change));
  }

  // Conflict is its own move. It stays before rollback so a marker does not
  // undo a return to implementing for a rebase.
  const conflicted = open.find(item => item.conflict);
  if (conflicted) {
    if (phase === 'implementing') {
      return agent(
        issue.key,
        'fix-implementation',
        phase,
        String(conflicted.id),
        'rebase onto the base',
      );
    }
    return {
      kind: 'advance',
      issue: issue.key,
      to: 'implementing',
      reason: 'pull request conflicts with the base',
    };
  }

  // An earlier-phase thread moves after conflict. `out` is not in the map, so
  // it does not move the phase. On verifying the checks must already be red or
  // green; pending does not roll back.
  if (earlierPhase) {
    return {
      kind: 'advance',
      issue: issue.key,
      to: back,
      reason: 'review thread sent the change back',
    };
  }

  const shelf = specShelf(issue.key, phase, change, pr);
  if (shelf) {
    return shelf;
  }
  const layer = layerThread(issue.key, phase, pr);
  if (layer) {
    return layer;
  }
  if (acceptGateWithheld(phase, issue.key, change, pr)) {
    return {kind: 'wait', issue: issue.key, reason: 'a thread on this phase is still open'};
  }
  return null;
}

/** A counting phase thread blocks the review-gate ask while the row would show acceptance. */
export function acceptGateWithheld(
  phase: Phase,
  key: string,
  change: ChangeView,
  pr: PullSnapshot | undefined,
): boolean {
  if (phase !== 'proposing' && phase !== 'specifying' && phase !== 'designing') {
    return false;
  }
  if (gateBlocker(key, phase, change)) {
    return false;
  }
  const threads = pr?.reading?.threads;
  if (!threads?.length) {
    return false;
  }
  return phaseThreadCountsForAccept(phase, threads);
}

export function acceptReviewGate(
  key: string,
  artifact: string,
  from: Phase,
  to: Phase,
  change: ChangeView,
  pr: PullSnapshot | undefined,
): Decision {
  if (acceptGateWithheld(from, key, change, pr)) {
    return {kind: 'wait', issue: key, reason: 'a thread on this phase is still open'};
  }
  return reviewGate(key, artifact, from, to);
}

function specShelf(
  key: string,
  phase: Phase,
  change: ChangeView,
  pr: PullSnapshot | undefined,
): Decision | null {
  if (phase !== 'specifying') {
    return null;
  }
  if (change.missingBaseline.length) {
    return agent(
      key,
      'restore-baseline',
      phase,
      pr ? String(pr.id) : '',
      `no baseline for ${change.missingBaseline.join(', ')}`,
    );
  }
  // The plan does not read the checkout. Added is a published shelf only after ## Shelf lists it.
  if (!change.delta && change.unjudged.length) {
    if (pr?.review?.layers.includes('spec')) {
      return null;
    }
    return agent(
      key,
      'restore-baseline',
      phase,
      pr ? String(pr.id) : '',
      `shelf not published for ${change.unjudged.join(', ')}`,
    );
  }
  return null;
}

function layerThread(key: string, phase: Phase, pr: PullSnapshot | undefined): Decision | null {
  const layer = layerOfPhase(phase);
  const feedback = pr?.review ?? emptyReview;
  if (!layer || !feedback.layers.includes(layer) || !pr) {
    return null;
  }
  const action = LAYER_ACTION[layer];
  if (!action) {
    return {kind: 'wait', issue: key, reason: `threads on ${layer} but no action`};
  }
  return agent(key, action, phase, String(pr.id), `threads on ${layer}`);
}
