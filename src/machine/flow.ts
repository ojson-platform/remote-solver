import {readChange, type ChangeView} from './change.ts';
import {gateAsk, openWait} from './labels.ts';
import {settle, type Decision} from './policy.ts';
import type {FileSource, Review, Tracker} from './port.ts';
import {pullSnapshots, type CycleSnapshot} from './snapshot.ts';

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

export async function applyLabels(
  tracker: Tracker,
  key: string,
  before: string[],
  after: string[],
): Promise<void> {
  const add = after.filter(label => !before.includes(label));
  const remove = before.filter(label => !after.includes(label));
  if (add.length || remove.length) {
    await tracker.editLabels(key, add, remove);
  }
}

async function closeAccepted(tracker: Tracker, key: string): Promise<void> {
  await tracker.close(key, 'SDLC accepted: the pull request is merged and the baseline is in trunk.');
}

async function applySettlement(
  tracker: Tracker,
  before: string[],
  settled: ReturnType<typeof settle>,
  key: string,
): Promise<void> {
  await applyLabels(tracker, key, before, settled.labels);
  const closing = settled.transitions.find(transition => transition.to === 'accepted');
  for (const transition of settled.transitions) {
    if (transition.comment) {
      await tracker.comment(key, transition.comment);
    }
  }
  if (closing) {
    await closeAccepted(tracker, key);
  }
  if (
    settled.decision.kind === 'wait' &&
    settled.decision.gate &&
    !before.includes('sdd:wait-human')
  ) {
    await openWait(key, gateAsk(key, settled.decision.gate, tracker), tracker);
  }
}

export async function resolveCycle(
  snapshot: CycleSnapshot,
  tracker: Tracker,
  queueLabel: string,
  busy: ReadonlySet<string> = new Set(),
): Promise<Decision[]> {
  const empty = queueLabelOf(snapshot, queueLabel);
  if (empty.length) {
    return empty;
  }
  // A running worker already owns the issue. Settling it again would move labels under the agent.
  const decisions: Decision[] = [];
  for (const record of snapshot.cycles.filter(item => !busy.has(item.key))) {
    const change = snapshot.changes.get(record.key);
    if (!change) {
      decisions.push({kind: 'wait', issue: record.key, reason: 'change was not loaded'});
      continue;
    }
    const settled = settle(record, snapshot.issues, snapshot.pulls.get(record.key) ?? [], change);
    await applySettlement(tracker, record.labels, settled, record.key);
    decisions.push(settled.decision);
  }
  return decisions;
}

export async function resolveIssue(
  key: string,
  options: {
    tracker: Tracker;
    review: Review;
    files: FileSource;
    queueLabel: string;
    change?: ChangeView;
  },
): Promise<Decision> {
  const issues = await options.tracker.listOpen();
  const record = issues.find(
    issue =>
      issue.key === key &&
      issue.labels.includes(options.queueLabel) &&
      issue.labels.includes('sdd:cycle'),
  );
  if (!record) {
    return {kind: 'done', issue: key, reason: 'not in the open cycle'};
  }
  const settled = settle(
    record,
    issues,
    await pullSnapshots(options.review, key),
    options.change ?? readChange(key, options.files),
  );
  await applySettlement(options.tracker, record.labels, settled, key);
  return settled.decision;
}

/**
 * The reading the spy and the session share. A merge is performed here, then
 * the issue is read again. `plan` stays on `resolveCycle` and does not merge.
 */
export async function performIssue(
  key: string,
  options: {
    tracker: Tracker;
    review: Review;
    files: FileSource;
    queueLabel: string;
    change?: ChangeView;
  },
): Promise<Decision> {
  const decision = await resolveIssue(key, options);
  if (decision.kind !== 'merge') {
    return decision;
  }
  await options.review.merge(decision.pull);
  const settled = await resolveIssue(key, options);
  if (settled.kind === 'merge') {
    throw new Error(`merge of PR #${decision.pull} did not settle`);
  }
  return settled;
}

/** One poll. Mechanical moves come from `resolveCycle`; a merge is performed. */
export async function performCycle(
  snapshot: CycleSnapshot,
  options: {
    tracker: Tracker;
    review: Review;
    filesAt: (key: string) => FileSource;
    queueLabel: string;
  },
  busy: ReadonlySet<string> = new Set(),
): Promise<Decision[]> {
  const decisions = await resolveCycle(snapshot, options.tracker, options.queueLabel, busy);
  const performed: Decision[] = [];
  for (const decision of decisions) {
    if (decision.kind !== 'merge' || decision.issue === null) {
      performed.push(decision);
      continue;
    }
    performed.push(
      await performIssue(decision.issue, {
        tracker: options.tracker,
        review: options.review,
        files: options.filesAt(decision.issue),
        queueLabel: options.queueLabel,
      }),
    );
  }
  return performed;
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
