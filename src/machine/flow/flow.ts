import type {ChangeView} from '../change/change.ts';
import type {Decision} from '../decide/policy.ts';
import type {FileSource, Openspec, Review, Tracker} from '../port.ts';
import type {QueueConfig} from '../spy/service-config.ts';
import type {CycleSnapshot} from '../spy/snapshot.ts';

import {queueOf} from '../spy/queues.ts';

import {applyLabels, emptyBaselineWait, serviceWait, walk} from './step.ts';

export {applyLabels, emptyBaselineWait, serviceWait};

function queueLabelOf(snapshot: CycleSnapshot, queues: readonly QueueConfig[]): Decision[] {
  if (snapshot.cycles.length > 0) {
    return [];
  }
  const nums =
    snapshot.issues
      .filter(issue => queueOf(issue.labels, queues) !== undefined)
      .map(issue => `#${issue.key}`)
      .join(', ') || 'empty';
  return [
    {
      kind: 'wait',
      issue: null,
      reason: `No open sdd:cycle issues. ${queues.map(queue => queue.name).join(', ')} queue: ${nums}. Add the sdd:cycle label to enter the cycle.`,
    },
  ];
}

export async function resolveCycle(
  snapshot: CycleSnapshot,
  tracker: Tracker,
  queues: QueueConfig[],
  busy: ReadonlySet<string> = new Set(),
  filesAt?: (key: string) => FileSource,
  root?: string,
  login?: string,
): Promise<Decision[]> {
  const empty = queueLabelOf(snapshot, queues);
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
    const tip = snapshot.tips?.get(record.key);
    decisions.push(
      await walk(record.key, {
        tracker,
        files: filesAt?.(record.key) ?? {exists: () => false, read: () => '', list: () => []},
        queues,
        change,
        pulls: snapshot.pulls.get(record.key) ?? [],
        issues: snapshot.issues,
        tip: snapshot.tips ? (tip ?? '') : '',
        root,
        login,
      }),
    );
  }
  return decisions;
}

export async function resolveIssue(
  key: string,
  options: {
    tracker: Tracker;
    review: Review;
    files: FileSource;
    queues: QueueConfig[];
    change?: ChangeView;
    /** Tip message. When set, the archive directory is not the folded bit. */
    tip?: string;
  },
): Promise<Decision> {
  return walk(key, options);
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
    queues: QueueConfig[];
    change?: ChangeView;
    tip?: string;
    checkout?: () => Promise<string>;
    readTip?: () => Promise<string | undefined>;
    fold?: (root: string, key: string) => void;
    restore?: (root: string, key: string) => void;
    openspec?: Openspec;
    root?: string;
    login?: string;
  },
): Promise<Decision> {
  const decision = await walk(key, {...options, perform: true});
  if (decision.kind === 'merge') {
    throw new Error(`merge of PR #${decision.pull} did not settle`);
  }
  return decision;
}

/** One poll. Mechanical moves come from `resolveCycle`; a merge is performed. */
export async function performCycle(
  snapshot: CycleSnapshot,
  options: {
    tracker: Tracker;
    review: Review;
    filesAt: (key: string) => FileSource;
    queues: QueueConfig[];
    checkout?: (key: string) => Promise<string>;
    readTip?: (key: string) => Promise<string | undefined>;
    openspec?: Openspec;
    root?: string;
    login?: string;
  },
  busy: ReadonlySet<string> = new Set(),
): Promise<Decision[]> {
  const login = options.login ?? (await options.tracker.login());
  const decisions = await resolveCycle(
    snapshot,
    options.tracker,
    options.queues,
    busy,
    undefined,
    options.root,
    login,
  );
  const performed: Decision[] = [];
  for (const decision of decisions) {
    const command =
      decision.kind === 'merge' || decision.kind === 'archive' || decision.kind === 'unarchive';
    if (!command || decision.issue === null) {
      performed.push(decision);
      continue;
    }
    const tip = snapshot.tips?.get(decision.issue);
    performed.push(
      await performIssue(decision.issue, {
        tracker: options.tracker,
        review: options.review,
        files: options.filesAt(decision.issue),
        queues: options.queues,
        tip: snapshot.tips ? (tip ?? '') : '',
        checkout: options.checkout ? () => options.checkout!(decision.issue!) : undefined,
        readTip: options.readTip ? () => options.readTip!(decision.issue!) : undefined,
        openspec: options.openspec,
        root: options.root,
        login,
      }),
    );
  }
  return performed;
}

export function pick(decisions: Decision[]): Decision {
  return (
    decisions.find(item => item.kind === 'advance') ??
    decisions.find(item => item.kind === 'agent') ??
    decisions.find(
      item => item.kind === 'merge' || item.kind === 'archive' || item.kind === 'unarchive',
    ) ?? {
      kind: 'wait',
      issue: null,
      reason: decisions.map(item => `#${item.issue}: ${item.reason}`).join('\n'),
    }
  );
}
