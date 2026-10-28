import type {PullSnapshot} from './policy.ts';
import type {FileSource, IssueRecord, Review, Tracker} from './port.ts';
import type {QueueConfig} from './service-config.ts';

import {readBranch, type BranchFacts, type BranchText, type ChangeView} from './change.ts';
import {queueOf} from './queues.ts';
import {emptyReview, reviewOf} from './review.ts';

export type CycleSnapshot = {
  issues: IssueRecord[];
  cycles: IssueRecord[];
  pulls: Map<string, PullSnapshot[]>;
  changes: Map<string, ChangeView>;
  /** Branch summary for the cycles this poll read. Absent when the caller did not read branches. */
  facts?: Map<string, BranchFacts>;
  /** Bytes of that same read. The spine projects them instead of opening the branch again. */
  texts?: Map<string, BranchText>;
};

/** Pulls of one issue, each open pull carrying the one review reading. */
export async function pullSnapshots(review: Review, key: string): Promise<PullSnapshot[]> {
  const pulls = await review.pulls(key);
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
      review: reviewOf(threads, notes),
      reading: {threads, notes},
    });
  }
  return snapshots;
}

export async function loadCycle(
  tracker: Tracker,
  review: Review,
  filesAt: (key: string) => FileSource,
  queues: QueueConfig[],
): Promise<CycleSnapshot> {
  const issues = await tracker.listOpen();
  const me = await tracker.login();
  const cycles = issues
    .filter(
      issue =>
        (issue.assignee ?? '') === me &&
        queueOf(issue.labels, queues) !== undefined &&
        issue.labels.includes('sdd:cycle'),
    )
    .sort((a, b) => a.key.localeCompare(b.key, undefined, {numeric: true}));
  const pulls = new Map<string, PullSnapshot[]>();
  const changes = new Map<string, ChangeView>();
  const facts = new Map<string, BranchFacts>();
  const texts = new Map<string, BranchText>();
  for (const issue of cycles) {
    const files = filesAt(issue.key);
    const read = readBranch(issue.key, files);
    pulls.set(issue.key, await pullSnapshots(review, issue.key));
    changes.set(issue.key, read.change);
    if (!files.failed?.()) {
      facts.set(issue.key, read.facts);
      texts.set(issue.key, read.text);
    }
  }
  return {issues, cycles, pulls, changes, facts, texts};
}
