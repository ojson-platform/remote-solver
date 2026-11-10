import {readChange, type ChangeView} from './change.ts';
import {foldChange, restoreChange} from './fold.ts';
import {gateAsk, openWait} from './labels.ts';
import {labelsAfterAdvance} from './phase.ts';
import {cycleRecord, decide, effectSignature, refusalBody, type Decision} from './policy.ts';
import type {FileSource, IssueRecord, Review, Tracker} from './port.ts';
import type {PullSnapshot} from './policy.ts';
import {queueOf} from './queues.ts';
import {sameService, type QueueConfig} from './service-config.ts';
import {pullSnapshots, type CycleSnapshot} from './snapshot.ts';

/** Archive focus. The first line is the marker; the prose matches the accept shape. */
const ACCEPT_FOCUS =
  'sdd:focus:accept\nThe baseline has now the folded change; the dated archive directory is left out on purpose. The capability, its scenarios, and the tests are in the archive commit.\n';

/** A fold that would publish a spec with no requirement. The reason names that spec. */
export function emptyBaselineWait(text: string, capabilities: readonly string[]): string | null {
  if (!/at least one requirement|no requirement/i.test(text)) {
    return null;
  }
  const named =
    text.match(/openspec\/specs\/[A-Za-z0-9._/-]+\/spec\.md/)?.[0] ??
    (capabilities[0]
      ? `openspec/specs/${capabilities[0]}/spec.md`
      : 'openspec/specs/<capability>/spec.md');
  return `the rebuilt spec would have no requirement: ${named}`;
}

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

async function closeIssue(tracker: Tracker, key: string, sentence: string): Promise<void> {
  await tracker.close(key, sentence);
}

type IssueRead = {
  tracker: Tracker;
  review?: Review;
  files: FileSource;
  queues: QueueConfig[];
  change?: ChangeView;
  /** Tip message. When set, the archive directory is not the folded bit. */
  tip?: string;
  pulls?: PullSnapshot[];
  issues?: IssueRecord[];
  /** Perform merge, archive, and unarchive, then read the issue again. */
  perform?: boolean;
  checkout?: () => Promise<string>;
  readTip?: () => Promise<string | undefined>;
  /** Replaces the archive command. Tests use this; the poll uses `foldChange`. */
  fold?: (root: string, key: string) => void;
  restore?: (root: string, key: string) => void;
  /** This checkout. A foreign `service` waits before any label write. */
  root?: string;
};

/** The service field names another directory. The verb and the poll share this wait. */
export function serviceWait(
  root: string,
  record: {key: string; service?: string},
): Decision | null {
  const declared = (record.service ?? '').trim();
  if (declared !== '' && !sameService(root, declared)) {
    return {kind: 'wait', issue: record.key, reason: `service is ${declared}`};
  }
  return null;
}

function nextLabels(before: string[], decision: Decision): string[] {
  let labels = before;
  if (decision.drop?.length) {
    const dropping = new Set(decision.drop);
    labels = labels.filter(name => !dropping.has(name));
  }
  if (decision.kind === 'advance') {
    return labelsAfterAdvance(labels, decision.to);
  }
  if (decision.stay && !labels.includes(`sdd:${decision.stay}`)) {
    return [...labels, `sdd:${decision.stay}`];
  }
  return labels;
}

/** One effect, written, then the issue is read again. Twelve effects is the stop. */
async function walk(key: string, options: IssueRead): Promise<Decision> {
  let change = options.change;
  let tip = options.tip;
  let pulls = options.pulls;
  for (let step = 0; step < 12; step += 1) {
    const open = await options.tracker.listOpen();
    const record = open.find(
      issue =>
        issue.key === key &&
        queueOf(issue.labels, options.queues) !== undefined &&
        issue.labels.includes('sdd:cycle'),
    );
    if (!record) {
      return {kind: 'done', issue: key, reason: 'not in the open cycle'};
    }
    if (options.root) {
      const foreign = serviceWait(options.root, record);
      if (foreign) {
        return foreign;
      }
    }
    const view = change ?? readChange(key, options.files);
    const message = tip ?? '';
    const loaded =
      pulls ??
      (options.review ? await pullSnapshots(options.review, key, options.files) : []);
    const notes = await options.tracker.comments(key);
    const others = (options.issues ?? open).map(issue => (issue.key === key ? record : issue));
    const decision = decide(record, others, loaded, view, cycleRecord(record, message, notes));
    const labels = nextLabels(record.labels, decision);
    await applyLabels(options.tracker, key, record.labels, labels);
    if (decision.kind === 'advance') {
      if (decision.comment) {
        await options.tracker.comment(key, decision.comment);
      }
      if (decision.to === 'accepted') {
        await closeIssue(
          options.tracker,
          key,
          'SDLC accepted: the pull request is merged and the baseline is in trunk.',
        );
        return {kind: 'done', issue: key, reason: decision.reason};
      }
      continue;
    }
    if (decision.kind === 'done' && decision.reason === 'finished cycle') {
      await closeIssue(
        options.tracker,
        key,
        'SDLC finished: the pull request is merged and the change is archived.',
      );
      return decision;
    }
    if (
      decision.kind === 'wait' &&
      decision.gate &&
      !record.labels.includes('sdd:wait-human')
    ) {
      await openWait(key, gateAsk(key, decision.gate, options.tracker), options.tracker);
      return decision;
    }
    if (!options.perform) {
      return decision;
    }
    if (decision.kind === 'merge') {
      if (!options.review) {
        return decision;
      }
      await options.review.merge(decision.pull);
      pulls = undefined;
      change = undefined;
      if (options.readTip) {
        tip = await options.readTip();
      }
      continue;
    }
    if ((decision.kind === 'archive' || decision.kind === 'unarchive') && options.checkout) {
      const dir = await options.checkout();
      if (dir) {
        try {
          if (decision.kind === 'archive') {
            (options.fold ?? foldChange)(dir, key);
          } else {
            (options.restore ?? restoreChange)(dir, key);
          }
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'fold failed';
          const baseline = emptyBaselineWait(reason, view.capabilities);
          if (baseline) {
            return {kind: 'wait', issue: key, reason: baseline};
          }
          const signature = effectSignature({
            phase: decision.phase,
            action: decision.kind,
            reason: decision.reason,
          });
          await options.tracker.comment(key, refusalBody(signature));
          return {kind: 'wait', issue: key, reason: `refused ${decision.kind}: ${reason}`};
        }
        if (decision.kind === 'archive') {
          await options.tracker.comment(key, ACCEPT_FOCUS);
        }
        pulls = undefined;
        change = undefined;
        if (options.readTip) {
        tip = await options.readTip();
      }
        continue;
      }
    }
    return decision;
  }
  return {kind: 'wait', issue: key, reason: 'Too many mechanical transitions'};
}

export async function resolveCycle(
  snapshot: CycleSnapshot,
  tracker: Tracker,
  queues: QueueConfig[],
  busy: ReadonlySet<string> = new Set(),
  filesAt?: (key: string) => FileSource,
  root?: string,
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
    root?: string;
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
    root?: string;
  },
  busy: ReadonlySet<string> = new Set(),
): Promise<Decision[]> {
  const decisions = await resolveCycle(
    snapshot,
    options.tracker,
    options.queues,
    busy,
    undefined,
    options.root,
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
        root: options.root,
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
