import type {ChangeView} from '../change/change.ts';
import type {IssueRecord} from '../port.ts';
import type {CycleRecord, Decision, PullSnapshot} from './types.ts';

import {decideAhead} from './ahead.ts';
import {heldReview, isAdvance, writingConsent} from './consent.ts';
import {decidePhase} from './phases.ts';
import {holdOpenPulls} from './pulls.ts';
import {blockRepeated, cycleRecord} from './record.ts';

/**
 * One poll. Shared facts (threads, conflict, archive, consent, the human
 * hold) are decided before the phase. `sdd:refused` and several open pull
 * requests wrap the result.
 */
export function decide(
  issue: IssueRecord,
  issues: IssueRecord[],
  pulls: PullSnapshot[],
  change: ChangeView,
  record: CycleRecord = cycleRecord(issue),
): Decision {
  return holdOpenPulls(
    blockRepeated(decideOpen(issue, issues, pulls, change, record), record.refused, record.refusalNote),
    issue,
    pulls,
  );
}

function decideOpen(
  issue: IssueRecord,
  issues: IssueRecord[],
  pulls: PullSnapshot[],
  change: ChangeView,
  record: CycleRecord,
): Decision {
  const open = pulls.filter(pr => pr.state === 'OPEN');
  const ahead = decideAhead({issue, issues, pulls, change, record, open});
  if (ahead) {
    return ahead;
  }
  const phase = record.phase;
  if (!phase) {
    return {kind: 'wait', issue: issue.key, reason: 'unknown phase'};
  }
  const consent = writingConsent(issue, change, record, open[0]);
  if (isAdvance(consent)) {
    return consent;
  }
  const held = heldReview(issue, change, record, consent, open[0]);
  if (held) {
    return held;
  }
  return decidePhase({
    issue,
    issues,
    change,
    phase,
    pr: open[0],
    merged: pulls.filter(pr => pr.state === 'MERGED'),
    folded: record.folded,
    autoMerge: record.autoMerge,
    hand: consent,
  });
}
