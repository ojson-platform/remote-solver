import type {IssueRecord} from '../port.ts';
import type {Decision} from './types.ts';

import {phaseRank, reachedRank, type Phase} from '../phase/phase.ts';

function children(parent: string, issues: IssueRecord[]): IssueRecord[] {
  return issues.filter(issue => issue.parent === parent && issue.labels.includes('sdd:cycle'));
}

function blockers(issue: IssueRecord, issues: IssueRecord[]): IssueRecord[] {
  const seen = new Set<string>();
  const out: IssueRecord[] = [];
  for (const id of [...(issue.blockedBy ?? []), ...(issue.dependsOn ?? [])]) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    const item = issues.find(entry => entry.key === id);
    if (item) {
      out.push(item);
    }
  }
  return out;
}

function atLeast(issue: IssueRecord, phase: Phase): boolean {
  const rank = reachedRank(issue.labels);
  return rank >= 0 && rank >= phaseRank(phase);
}

/** Leaving a phase and finishing the cycle share this. An open task does not. */
export function linkWait(issue: IssueRecord, issues: IssueRecord[]): Decision | null {
  const kids = children(issue.key, issues).filter(kid => !atLeast(kid, 'accepted'));
  if (kids.length) {
    return {
      kind: 'wait',
      issue: issue.key,
      reason: `wait for children to be accepted: ${kids.map(kid => '#' + kid.key).join(', ')}`,
    };
  }
  const openBlockers = blockers(issue, issues);
  if (openBlockers.length) {
    return {
      kind: 'wait',
      issue: issue.key,
      reason: `wait for blockers: ${openBlockers.map(item => '#' + item.key).join(', ')}`,
    };
  }
  return null;
}
