import {readChange, type ChangeView} from './change.ts';
import {settle, type Decision, type PullSnapshot} from './policy.ts';
import type {FileSource, Review, Tracker} from './port.ts';
import {emptyReview, reviewOf} from './review.ts';
import type {CycleSnapshot} from './snapshot.ts';

function queueLabelOf(snapshot: CycleSnapshot, queueLabel: string): Decision[] {
  if (snapshot.cycles.length > 0) {
    return [];
  }
  const nums =
    snapshot.issues
      .filter(issue => issue.labels.includes(queueLabel))
      .map(issue => `#${issue.key}`)
      .join(', ') || 'empty';
  return [
    {
      kind: 'wait',
      issue: null,
      reason: `No open sdd:cycle issues. ${queueLabel} queue: ${nums}. Add the sdd:cycle label to enter the cycle.`,
    },
  ];
}

export function applyLabels(tracker: Tracker, key: string, before: string[], after: string[]): void {
  const add = after.filter(label => !before.includes(label));
  const remove = before.filter(label => !after.includes(label));
  if (add.length || remove.length) {
    tracker.editLabels(key, add, remove);
  }
}

function closeAccepted(tracker: Tracker, key: string): void {
  tracker.close(key, 'SDLC accepted: the pull request is merged and the baseline is in trunk.');
}

function applySettlement(
  tracker: Tracker,
  before: string[],
  settled: ReturnType<typeof settle>,
  key: string,
): void {
  applyLabels(tracker, key, before, settled.labels);
  const closing = settled.transitions.find(transition => transition.to === 'accepted');
  if (closing) {
    closeAccepted(tracker, key);
  }
}

export function resolveCycle(
  snapshot: CycleSnapshot,
  tracker: Tracker,
  queueLabel: string,
  busy: ReadonlySet<string> = new Set(),
): Decision[] {
  const empty = queueLabelOf(snapshot, queueLabel);
  if (empty.length) {
    return empty;
  }
  // A running worker already owns the issue. Settling it again would move labels under the agent.
  return snapshot.cycles.filter(record => !busy.has(record.key)).map(record => {
    const change = snapshot.changes.get(record.key);
    if (!change) {
      return {kind: 'wait' as const, issue: record.key, reason: 'change was not loaded'};
    }
    const settled = settle(record, snapshot.issues, snapshot.pulls.get(record.key) ?? [], change);
    applySettlement(tracker, record.labels, settled, record.key);
    return settled.decision;
  });
}

function pullsOf(review: Review, key: string): PullSnapshot[] {
  return review.pulls(key).map(pull => ({
    ...pull,
    review: pull.state === 'OPEN' ? reviewOf(review.threads(pull.id), review.comments(pull.id)) : emptyReview,
  }));
}

export function resolveIssue(
  key: string,
  options: {tracker: Tracker; review: Review; files: FileSource; queueLabel: string; change?: ChangeView},
): Decision {
  const issues = options.tracker.listOpen();
  const record = issues.find(
    issue =>
      issue.key === key && issue.labels.includes(options.queueLabel) && issue.labels.includes('sdd:cycle'),
  );
  if (!record) {
    return {kind: 'done', issue: key, reason: 'not in the open cycle'};
  }
  const settled = settle(
    record,
    issues,
    pullsOf(options.review, key),
    options.change ?? readChange(key, options.files),
  );
  applySettlement(options.tracker, record.labels, settled, key);
  return settled.decision;
}

export function pick(decisions: Decision[]): Decision {
  return (
    decisions.find(item => item.kind === 'advance') ??
    decisions.find(item => item.kind === 'agent') ??
    decisions.find(item => item.kind === 'merge') ?? {
      kind: 'wait',
      issue: null,
      reason: decisions.map(item => `#${item.issue}: ${item.reason}`).join('\n'),
    }
  );
}
