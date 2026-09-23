import {readChange, type ChangeView} from './change.ts';
import type {FileSource, IssueRecord, Review, Tracker} from './port.ts';
import type {PullSnapshot} from './policy.ts';
import {emptyReview, reviewOf} from './review.ts';

export type CycleSnapshot = {
  issues: IssueRecord[];
  cycles: IssueRecord[];
  pulls: Map<string, PullSnapshot[]>;
  changes: Map<string, ChangeView>;
};

export function loadCycle(
  tracker: Tracker,
  review: Review,
  filesAt: (key: string) => FileSource,
  queueLabel: string,
): CycleSnapshot {
  const issues = tracker.listOpen();
  const cycles = issues
    .filter(issue => issue.labels.includes(queueLabel) && issue.labels.includes('sdd:cycle'))
    .sort((a, b) => a.key.localeCompare(b.key, undefined, {numeric: true}));
  const pulls = new Map<string, PullSnapshot[]>();
  const changes = new Map<string, ChangeView>();
  for (const issue of cycles) {
    pulls.set(
      issue.key,
      review.pulls(issue.key).map(pull => ({
        ...pull,
        review: pull.state === 'OPEN' ? reviewOf(review.threads(pull.id), review.comments(pull.id)) : emptyReview,
      })),
    );
    changes.set(issue.key, readChange(issue.key, filesAt(issue.key)));
  }
  return {issues, cycles, pulls, changes};
}
