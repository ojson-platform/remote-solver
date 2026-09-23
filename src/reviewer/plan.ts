import type {ReviewPass} from './act.ts';

export type ReviewQueueItem =
  | {kind: 'skip'; issue: string; reason: string}
  | {kind: 'wait'; issue: string; reason: string}
  | {kind: 'ready'; issue: string; pull: string};

type Issue = {key: string; labels: string[]};
type Pull = {id: string; state: string};

/** Issues the reviewer may touch. The cycle policy does not read `sdd:auto-review`. */
export function reviewQueue(issues: Issue[], pullsOf: (key: string) => Pull[]): ReviewQueueItem[] {
  const items: ReviewQueueItem[] = [];
  for (const issue of issues) {
    if (!issue.labels.includes('sdd:auto-review')) {
      continue;
    }
    if (!issue.labels.includes('sdd:accepting')) {
      items.push({kind: 'skip', issue: issue.key, reason: 'sdd:auto-review waits for accepting'});
      continue;
    }
    if (issue.labels.includes('sdd:auto-merge')) {
      items.push({
        kind: 'skip',
        issue: issue.key,
        reason: 'sdd:auto-merge merges without this review',
      });
      continue;
    }
    const open = pullsOf(issue.key).filter(pull => pull.state === 'OPEN');
    if (open.length !== 1) {
      items.push({
        kind: 'wait',
        issue: issue.key,
        reason:
          open.length === 0 ? 'accepting needs the pull request' : 'several open pull requests',
      });
      continue;
    }
    items.push({kind: 'ready', issue: issue.key, pull: open[0].id});
  }
  return items;
}

/** One line for the queue, or for a pass once the reviewer has run. */
export function describe(item: ReviewQueueItem, pass?: ReviewPass): string {
  if (pass) {
    if (pass.action === 'wait' || pass.action === 'unjudged') {
      return `#${item.issue} ${pass.action}: ${pass.reason}`;
    }
    return `#${item.issue} ${pass.action}`;
  }
  if (item.kind === 'ready') {
    return `#${item.issue} review pull ${item.pull}`;
  }
  return `#${item.issue} ${item.kind}: ${item.reason}`;
}

export function describeQueue(items: ReviewQueueItem[]): string[] {
  if (items.length === 0) {
    return ['no sdd:auto-review issues'];
  }
  return items.map(item => describe(item));
}
