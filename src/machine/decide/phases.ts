import type {Phase} from '../phase/phase.ts';
import type {IssueRecord} from '../port.ts';
import type {Hand} from './consent.ts';
import type {Decision, PullSnapshot} from './types.ts';

import {cardGap, specsReady, unslicedScenario, type ChangeView} from '../change/change.ts';

import {acceptReviewGate} from './ahead.ts';
import {agent} from './agent.ts';
import {gateBlocker, stampBehind} from './gates.ts';
import {linkWait} from './links.ts';
import {mergeOrWait, NO_OPEN_PULL} from './pulls.ts';

export type PhaseRead = {
  issue: IssueRecord;
  issues: IssueRecord[];
  change: ChangeView;
  phase: Phase;
  pr: PullSnapshot | undefined;
  merged: PullSnapshot[];
  folded: boolean;
  autoMerge: boolean;
  hand: Hand;
};

/** The phase's own rule, after threads, conflict, consent, and `sdd:wait-human`. */
export function decidePhase(read: PhaseRead): Decision {
  switch (read.phase) {
    case 'proposing':
      return propose(read);
    case 'specifying':
      return specify(read);
    case 'designing':
      return design(read);
    case 'tasking':
      return task(read);
    case 'implementing':
      return implement(read);
    case 'verifying':
      return verify(read);
    case 'accepting':
      return acceptPhase(read);
    default:
      return {kind: 'wait', issue: read.issue.key, reason: `unknown phase ${read.phase}`};
  }
}

function propose(read: PhaseRead): Decision {
  const {issue, change, phase, pr, hand} = read;
  if (!change.proposal || !pr) {
    return hand(
      agent(
        issue.key,
        'create-proposal',
        phase,
        pr ? String(pr.id) : '',
        change.proposal
          ? 'publish proposal.md to the pull request'
          : 'write proposal.md and open the pull request',
      ),
    );
  }
  if (change.openQuestions) {
    return hand({
      kind: 'wait',
      issue: issue.key,
      reason: gateBlocker(issue.key, phase, change) ?? 'open questions in proposal.md',
    });
  }
  return hand(acceptReviewGate(issue.key, 'proposal', 'proposing', 'proposed', change, pr));
}

function specify(read: PhaseRead): Decision {
  const {issue, change, phase, pr, hand} = read;
  if (!change.proposal) {
    return hand({
      kind: 'advance',
      issue: issue.key,
      to: 'proposing',
      reason: 'proposal.md is missing',
    });
  }
  if (!pr) {
    return hand({kind: 'wait', issue: issue.key, reason: NO_OPEN_PULL});
  }
  if (!specsReady(change)) {
    return hand(
      agent(
        issue.key,
        'create-initial-specs',
        phase,
        pr ? String(pr.id) : '',
        'write the delta spec and publish it',
      ),
    );
  }
  const stamp = stampBehind(phase, change);
  if (stamp) {
    return hand(agent(issue.key, 'create-initial-specs', phase, String(pr.id), stamp));
  }
  return hand(acceptReviewGate(issue.key, 'spec', 'specifying', 'specified', change, pr));
}

function design(read: PhaseRead): Decision {
  const {issue, change, phase, pr, hand} = read;
  if (!specsReady(change)) {
    return hand({
      kind: 'advance',
      issue: issue.key,
      to: 'specifying',
      reason: 'delta spec is missing',
    });
  }
  if (!pr) {
    return hand({kind: 'wait', issue: issue.key, reason: NO_OPEN_PULL});
  }
  if (!change.design) {
    return hand(
      agent(
        issue.key,
        'create-design',
        phase,
        pr ? String(pr.id) : '',
        'write design.md and publish it',
      ),
    );
  }
  if (change.openDecisions) {
    return hand({
      kind: 'wait',
      issue: issue.key,
      reason: `${change.openDecisions} open decision(s) in design.md`,
    });
  }
  const stamp = stampBehind(phase, change);
  if (stamp) {
    return hand(agent(issue.key, 'create-design', phase, String(pr.id), stamp));
  }
  return hand(acceptReviewGate(issue.key, 'design', 'designing', 'designed', change, pr));
}

function task(read: PhaseRead): Decision {
  const {issue, issues, change, phase, pr} = read;
  if (!change.design) {
    return {kind: 'advance', issue: issue.key, to: 'designing', reason: 'design.md is missing'};
  }
  if (!pr) {
    return {kind: 'wait', issue: issue.key, reason: NO_OPEN_PULL};
  }
  if (!change.tasks) {
    return agent(
      issue.key,
      'create-tasks',
      phase,
      pr ? String(pr.id) : '',
      'write tasks.md and publish it',
    );
  }
  const stamp = stampBehind(phase, change);
  if (stamp) {
    return agent(issue.key, 'create-tasks', phase, String(pr.id), stamp);
  }
  const cut = cardGap(change) ?? unslicedScenario(change);
  if (cut) {
    return agent(issue.key, 'create-tasks', phase, String(pr.id), cut);
  }
  return (
    linkWait(issue, issues) ?? {
      kind: 'advance',
      issue: issue.key,
      to: 'implementing',
      reason: 'tasks exist',
    }
  );
}

function taskReason(change: ChangeView): string {
  return change.openTask ? `next open task ${change.openTask}` : 'next open task';
}

function checkReason(failures: readonly string[] | undefined): string {
  const marks = [...(failures ?? [])].filter(mark => mark !== '').sort();
  return marks.length === 0 ? 'red checks' : `red checks ${marks.join(', ')}`;
}

function implement(read: PhaseRead): Decision {
  const {issue, issues, change, phase, pr} = read;
  if (!change.tasks) {
    return {kind: 'advance', issue: issue.key, to: 'tasking', reason: 'tasks.md is missing'};
  }
  const card = cardGap(change);
  if (card) {
    return {kind: 'advance', issue: issue.key, to: 'tasking', reason: card};
  }
  if (!pr && change.openTasks > 0) {
    return {kind: 'wait', issue: issue.key, reason: NO_OPEN_PULL};
  }
  if (change.openTasks > 0) {
    return agent(
      issue.key,
      'implement-next-task',
      phase,
      pr ? String(pr.id) : '',
      taskReason(change),
    );
  }
  const slice = unslicedScenario(change);
  if (slice) {
    return {kind: 'advance', issue: issue.key, to: 'tasking', reason: slice};
  }
  return (
    linkWait(issue, issues) ?? {
      kind: 'advance',
      issue: issue.key,
      to: 'verifying',
      reason: 'no open tasks',
    }
  );
}

function verify(read: PhaseRead): Decision {
  const {issue, issues, phase, pr} = read;
  if (!pr) {
    return {kind: 'wait', issue: issue.key, reason: NO_OPEN_PULL};
  }
  if (pr.checks === 'red') {
    return agent(issue.key, 'classify-failures', phase, String(pr.id), checkReason(pr.failures));
  }
  if (pr.checks !== 'green') {
    return {kind: 'wait', issue: issue.key, reason: `checks are ${pr.checks}`};
  }
  return (
    linkWait(issue, issues) ?? {
      kind: 'advance',
      issue: issue.key,
      to: 'accepting',
      reason: 'checks are green',
    }
  );
}

function acceptPhase(read: PhaseRead): Decision {
  const {issue, change, phase, pr, merged, folded, autoMerge} = read;
  if (!pr && merged.length === 0) {
    return {kind: 'wait', issue: issue.key, reason: NO_OPEN_PULL};
  }
  if (!folded) {
    const slice = unslicedScenario(change);
    if (slice) {
      return {kind: 'wait', issue: issue.key, reason: slice};
    }
    return {
      kind: 'archive',
      issue: issue.key,
      phase,
      pr: pr ? String(pr.id) : String(merged[0].id),
      reason: 'archive the change',
    };
  }
  return mergeOrWait(issue.key, pr, merged, autoMerge);
}
