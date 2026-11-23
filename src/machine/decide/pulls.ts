import type {Decision, PullSnapshot} from './types.ts';
import type {IssueRecord} from '../port.ts';

import {
  greenMergeReason,
  mergeWaitReason,
  NEEDS_MERGED,
  NO_OPEN_PULL,
  readReason,
  severalOpenReason,
} from './reason.ts';

export {NO_OPEN_PULL, severalOpenReason};

/** One open pull request is reused. None means create. Several names the open ones. */
export function publishChoice(
  openIds: string[],
): {ok: true; id: string | null} | {ok: false; reason: string} {
  if (openIds.length > 1) {
    return {ok: false, reason: severalOpenReason(openIds)};
  }
  return {ok: true, id: openIds[0] ?? null};
}

/** The archive directory, a merged pull request, and none open: the cycle is finished. */
export function finishedCycle(
  pulls: PullSnapshot[],
  archived: boolean,
  phase: string | null,
): boolean {
  if (phase === 'cancelled') {
    return false;
  }
  if (!archived) {
    return false;
  }
  if (pulls.some(pr => pr.state === 'OPEN')) {
    return false;
  }
  return pulls.some(pr => pr.state === 'MERGED');
}

/** A merged pull request closes the cycle. `sdd:auto-merge` is the only path where the machine merges. */
export function mergeOrWait(
  issueKey: string,
  pr: PullSnapshot | undefined,
  merged: PullSnapshot[],
  autoMerge: boolean,
): Decision {
  if (merged.length > 0 && pr === undefined) {
    return {kind: 'advance', issue: issueKey, to: 'accepted', reason: 'pull request merged'};
  }
  if (merged.length > 0 && pr !== undefined) {
    if (pr.checks !== 'green') {
      return {
        kind: 'wait',
        issue: issueKey,
        reason: greenMergeReason(pr.id),
      };
    }
    return {
      kind: 'wait',
      issue: issueKey,
      reason: mergeWaitReason(pr.id),
      ask: `Merge pull request #${pr.id}.`,
    };
  }
  if (!pr) {
    return {kind: 'wait', issue: issueKey, reason: NEEDS_MERGED};
  }
  if (pr.checks !== 'green') {
    return {
      kind: 'wait',
      issue: issueKey,
      reason: greenMergeReason(pr.id),
    };
  }
  if (!autoMerge) {
    return {
      kind: 'wait',
      issue: issueKey,
      reason: mergeWaitReason(pr.id),
      ask: `Merge pull request #${pr.id}.`,
    };
  }
  return {kind: 'merge', issue: issueKey, pull: String(pr.id), reason: `merge PR #${pr.id}`};
}

/** Several open pull requests hold every exit except an open task, unarchive, and a wait that is not a gate. */
export function holdOpenPulls(
  decision: Decision,
  issue: IssueRecord,
  pulls: readonly PullSnapshot[],
): Decision {
  const ids = pulls.filter(pr => pr.state === 'OPEN').map(pr => pr.id);
  if (ids.length <= 1 || decision.issue === null) {
    return decision;
  }
  if (
    decision.kind === 'agent' &&
    (decision.action === 'implement-next-task' ||
      decision.action === 'cover-baseline' ||
      decision.action === 'repair-suite' ||
      decision.action === 'classify-comments' ||
      decision.action === 'unarchive')
  ) {
    return decision;
  }
  const read = readReason(decision.reason);
  if (decision.kind === 'advance' && read.kind === 'sent-back') {
    return decision;
  }
  if (
    decision.kind === 'advance' &&
    decision.to === 'tasking' &&
    (read.cardExact || read.kind === 'no-card')
  ) {
    return decision;
  }
  if (decision.kind === 'wait' && !decision.gate && !read.holdExit) {
    return decision;
  }
  return {kind: 'wait', issue: issue.key, reason: severalOpenReason(ids)};
}
