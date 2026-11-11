import type {QueueConfig} from './service-config.ts';
import type {PullSnapshot} from '../decide/policy.ts';
import type {OpenItemFile} from '../mark/review.ts';
import type {FileSource, IssueRecord, Review, Tracker} from '../port.ts';

import {readBranch, type BranchFacts, type BranchText, type ChangeView} from '../change/change.ts';
import {emptyReview, reviewOf} from '../mark/review.ts';

import {queueOf} from './queues.ts';

export type CycleSnapshot = {
  issues: IssueRecord[];
  cycles: IssueRecord[];
  pulls: Map<string, PullSnapshot[]>;
  changes: Map<string, ChangeView>;
  /** Branch summary for the cycles this poll read. Absent when the caller did not read branches. */
  facts?: Map<string, BranchFacts>;
  /** Bytes of that same read. The spine projects them instead of opening the branch again. */
  texts?: Map<string, BranchText>;
  /** Tip commit message of each cycle this poll read. Absent when the caller did not read tips. */
  tips?: Map<string, string>;
};

/** Pulls of one issue, each open pull carrying the one review reading. */
function openItemFile(files: FileSource | undefined): OpenItemFile | undefined {
  if (!files) {
    return undefined;
  }
  return rel => (rel && files.exists(rel) ? files.read(rel) : undefined);
}

export async function pullSnapshots(
  review: Review,
  key: string,
  files?: FileSource,
): Promise<PullSnapshot[]> {
  const pulls = await review.pulls(key);
  const fileAt = openItemFile(files);
  const snapshots: PullSnapshot[] = [];
  for (const pull of pulls) {
    if (pull.state !== 'OPEN') {
      snapshots.push({...pull, review: emptyReview});
      continue;
    }
    const threads = await review.threadList(pull.id);
    const notes = await review.comments(pull.id);
    snapshots.push({
      ...pull,
      review: reviewOf(threads, notes, fileAt),
      reading: {threads, notes},
    });
  }
  return snapshots;
}

/** A cycle this login holds: the queue, the cycle label, and this assignee. */
export function ownCycle(issue: IssueRecord, login: string, queues: QueueConfig[]): boolean {
  return (
    (issue.assignee ?? '') === login &&
    queueOf(issue.labels, queues) !== undefined &&
    issue.labels.includes('sdd:cycle')
  );
}

export async function loadCycle(
  tracker: Tracker,
  review: Review,
  filesAt: (key: string) => FileSource,
  queues: QueueConfig[],
  contentAt: (key: string) => FileSource = filesAt,
  tipMessage?: (key: string) => Promise<string>,
): Promise<CycleSnapshot> {
  const issues = await tracker.listOpen();
  const me = await tracker.login();
  const cycles = issues
    .filter(issue => ownCycle(issue, me, queues))
    .sort((a, b) => a.key.localeCompare(b.key, undefined, {numeric: true}));
  const pulls = new Map<string, PullSnapshot[]>();
  const changes = new Map<string, ChangeView>();
  const facts = new Map<string, BranchFacts>();
  const texts = new Map<string, BranchText>();
  const tips = tipMessage ? new Map<string, string>() : undefined;
  for (const issue of cycles) {
    const files = filesAt(issue.key);
    const read = readBranch(issue.key, files, contentAt(issue.key));
    pulls.set(issue.key, await pullSnapshots(review, issue.key, files));
    changes.set(issue.key, read.change);
    if (!files.failed?.()) {
      facts.set(issue.key, read.facts);
      texts.set(issue.key, read.text);
    }
    if (tips && tipMessage) {
      try {
        tips.set(issue.key, await tipMessage(issue.key));
      } catch {
        tips.set(issue.key, '');
      }
    }
  }
  return {issues, cycles, pulls, changes, facts, texts, tips};
}
