import type {Decision, PullSnapshot} from './types.ts';
import type {IssueRecord} from '../port.ts';

/** Specify and later phases stop here. Plan still opens the pull request. */
export const NO_OPEN_PULL = 'no open pull request';

/** Several open pull requests stop the cycle before any step, until a person leaves one. */
export function severalOpenReason(ids: string[]): string {
  return `cycle stopped until one open PR remains: ${ids.join(', ')}`;
}

/** One open pull request is reused. None means create. Several names the open ones. */
export function publishChoice(
  openIds: string[],
): {ok: true; id: string | null} | {ok: false; reason: string} {
  if (openIds.length > 1) {
    return {ok: false, reason: severalOpenReason(openIds)};
  }
  return {ok: true, id: openIds[0] ?? null};
}

/** Archived with a merged pull request and none open: the cycle is finished. */
export function finishedCycle(
  pulls: PullSnapshot[],
  folded: boolean,
  phase: string | null,
): boolean {
  if (phase === 'cancelled') {
    return false;
  }
  if (!folded) {
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
        reason: `wait for green checks before merge of PR #${pr.id}`,
      };
    }
    return {kind: 'wait', issue: issueKey, reason: `wait for merge of PR #${pr.id}`};
  }
  if (!pr) {
    return {kind: 'wait', issue: issueKey, reason: 'accepted needs a merged pull request'};
  }
  if (pr.checks !== 'green') {
    return {
      kind: 'wait',
      issue: issueKey,
      reason: `wait for green checks before merge of PR #${pr.id}`,
    };
  }
  if (!autoMerge) {
    return {kind: 'wait', issue: issueKey, reason: `wait for merge of PR #${pr.id}`};
  }
  return {kind: 'merge', issue: issueKey, pull: String(pr.id), reason: `merge PR #${pr.id}`};
}

/** Several open pull requests hold every exit except an open task and a wait that is not a gate. */
export function holdOpenPulls(
  decision: Decision,
  issue: IssueRecord,
  pulls: readonly PullSnapshot[],
): Decision {
  const ids = pulls.filter(pr => pr.state === 'OPEN').map(pr => pr.id);
  if (ids.length <= 1 || decision.issue === null) {
    return decision;
  }
  if (decision.kind === 'agent' && decision.action === 'implement-next-task') {
    return decision;
  }
  if (
    decision.kind === 'wait' &&
    !decision.gate &&
    !/merge|archiv|finished/i.test(decision.reason)
  ) {
    return decision;
  }
  return {kind: 'wait', issue: issue.key, reason: severalOpenReason(ids)};
}
