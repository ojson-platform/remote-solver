import type {ChangeView} from '../change/change.ts';
import type {IssueRecord} from '../port.ts';
import type {CycleRecord, Decision, PullSnapshot} from './types.ts';

import {emptyReview, layerOfPhase} from '../mark/review.ts';
import {phaseRank, type Phase} from '../phase/phase.ts';

import {agent} from './agent.ts';
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
export function decideAhead(read: AheadRead): Decision | null {
  const {issue, issues, pulls, change, record, open} = read;
  const phase = record.phase;
  if (phase === 'cancelled') {
    return {kind: 'done', issue: issue.key, reason: 'cancelled'};
  }
  if (open.length > 1 && phase === 'implementing' && change.tasks && change.openTasks > 0) {
    return agent(issue.key, 'implement-next-task', phase, String(open[0].id), 'next open task');
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
  // A repair must not commit on top of the archive commit. Accepting still
  // rolls back first. A merged pull request stays archived.
  if (
    phaseRank(phase) < phaseRank('accepting') &&
    record.folded &&
    !pulls.some(pr => pr.state === 'MERGED')
  ) {
    return {kind: 'unarchive', issue: issue.key, phase, reason: 'return the delta to the change'};
  }

  const pr = open[0];
  const feedback = pr?.review ?? emptyReview;
  if (feedback.unanswered && pr) {
    return agent(
      issue.key,
      'classify-comments',
      phase,
      String(pr.id),
      'unclassified review threads',
    );
  }

  // `out` is not in the map, so it does not move the phase. On verifying the
  // checks must already be red or green; pending does not roll back.
  // A classified marker moves before a held review gate (ADR-0028).
  const back = feedback.rollback;
  const checksKnown = pr?.checks === 'red' || pr?.checks === 'green';
  if (back && phaseRank(back) < phaseRank(phase) && (phase !== 'verifying' || checksKnown)) {
    return {
      kind: 'advance',
      issue: issue.key,
      to: back,
      reason: 'review thread sent the change back',
    };
  }

  // One conflict move, after the back move and before the shelf and the gate.
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

  const shelf = specShelf(issue.key, phase, change, pr);
  if (shelf) {
    return shelf;
  }
  return layerThread(issue.key, phase, pr);
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
