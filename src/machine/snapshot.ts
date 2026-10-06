import type {PullSnapshot} from './policy.ts';
import type {FileSource, IssueRecord, Review, Tracker} from './port.ts';
import type {QueueConfig} from './service-config.ts';

import {readChange, type ChangeView} from './change.ts';
import {queueOf} from './queues.ts';
import {emptyReview, reviewOf} from './review.ts';

export type CycleSnapshot = {
  issues: IssueRecord[];
  cycles: IssueRecord[];
  pulls: Map<string, PullSnapshot[]>;
  changes: Map<string, ChangeView>;
};

/** Pulls of one issue, each open pull carrying the one review reading. */
export async function pullSnapshots(review: Review, key: string): Promise<PullSnapshot[]> {
  const pulls = await review.pulls(key);
  const snapshots: PullSnapshot[] = [];
  for (const pull of pulls) {
    snapshots.push({
      ...pull,
      review:
        pull.state === 'OPEN'
          ? reviewOf(await review.threads(pull.id), await review.comments(pull.id))
          : emptyReview,
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
  for (const issue of cycles) {
    pulls.set(issue.key, await pullSnapshots(review, issue.key));
    changes.set(issue.key, readChange(issue.key, filesAt(issue.key)));
  }
  return {issues, cycles, pulls, changes};
}
