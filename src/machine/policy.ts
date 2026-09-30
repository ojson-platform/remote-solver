import path from 'node:path';

import {HEADINGS, type ChangeView} from './change.ts';
import {changeDir} from './naming.ts';
import {GATE_CLOSES, labelsAfterAdvance, phaseOf, phaseRank, type Phase} from './phase.ts';
import type {CheckState, IssueRecord} from './port.ts';
import {emptyReview, layerOfPhase, type ReviewView} from './review.ts';
import {ACTION_SKILL, LAYER_ACTION, type AgentAction, type Skill} from './route.ts';

export type Decision =
  | {
      kind: 'agent';
      issue: string;
      action: AgentAction;
      skill: Skill;
      phase: Phase;
      pr: string;
      reason: string;
    }
  /** `gate` opens the wait: the machine sets `sdd:wait-human` and posts the ask the tracker renders. */
  | {kind: 'wait'; issue: string | null; reason: string; gate?: Gate}
  | {kind: 'done'; issue: string | null; reason: string}
  /** `comment` is posted on the issue after the move. */
  | {kind: 'advance'; issue: string; to: Phase; reason: string; comment?: string}
  | {kind: 'merge'; issue: string; pull: string; reason: string};

/** Several open pull requests stop the cycle before any step, until a person leaves one. */
export function severalOpenReason(ids: string[]): string {
  return `cycle stopped until one open PR remains: ${ids.join(', ')}`;
}

/** One open pull request is reused. None means create. Several is the stop above. */
export function publishChoice(
  openIds: string[],
): {ok: true; id: string | null} | {ok: false; reason: string} {
  if (openIds.length > 1) {
    return {ok: false, reason: severalOpenReason(openIds)};
  }
  return {ok: true, id: openIds[0] ?? null};
}

export type PullSnapshot = {
  id: string;
  title: string;
  state: string;
  review: ReviewView;
  checks: CheckState;
};

export function writingGate(phase: Phase, change: ChangeView): {artifact: boolean; open: number} {
  if (phase === 'proposing') {
    return {artifact: change.proposal, open: change.openQuestions};
  }
  if (phase === 'specifying') {
    return {artifact: change.delta, open: 0};
  }
  if (phase === 'designing') {
    return {artifact: change.design, open: change.openDecisions};
  }
  return {artifact: true, open: 0};
}

/** The review gate a person closes: `from` is the writing phase, `to` the gate phase. */
export type Gate = {artifact: string; from: Phase; to: Phase};

/** A published artifact without an auto tag: the machine opens the human gate once. */
function reviewGate(issue: string, artifact: string, from: Phase, to: Phase): Decision {
  return {
    kind: 'wait',
    issue,
    reason: `review the ${artifact}, then a person moves ${from} to ${to}`,
    gate: {artifact, from, to},
  };
}

const HUMAN_NEXT: Partial<Record<Phase, Phase>> = {
  proposing: 'specifying',
  specifying: 'designing',
  designing: 'tasking',
};

/** What still stops a person from closing a writing phase. Null when nothing does. */
export function gateBlocker(key: string, phase: Phase, change: ChangeView): string | null {
  const gate = writingGate(phase, change);
  const required =
    phase === 'proposing' ? 'proposal.md' : phase === 'specifying' ? 'specs' : 'design.md';
  const file = path.join(changeDir(key), required);
  if (!gate.artifact) {
    return `Missing ${file}`;
  }
  if (gate.open) {
    const heading = phase === 'designing' ? HEADINGS.openDecisions : HEADINGS.openQuestions;
    return `#${key} still has open items under ## ${heading} in ${file}`;
  }
  return null;
}

/** A person set the gate phase. The machine checks it, then moves on or back to the closed phase. */
function closeGate(key: string, gate: Phase, closed: Phase, change: ChangeView): Decision {
  const blocker = gateBlocker(key, closed, change);
  if (blocker) {
    return {
      kind: 'advance',
      issue: key,
      to: closed,
      reason: `${gate} refused: ${blocker}`,
      comment: `The phase moved to ${gate}, but ${closed} is not done. ${blocker}. The machine moved the issue back to ${closed}.`,
    };
  }
  const next = HUMAN_NEXT[closed] as Phase;
  return {
    kind: 'advance',
    issue: key,
    to: next,
    reason: `${closed} → ${next}`,
    comment: `sdd:accept ${closed} → ${next}`,
  };
}

function children(parent: string, issues: IssueRecord[]): IssueRecord[] {
  return issues.filter(issue => issue.parent === parent && issue.labels.includes('sdd:cycle'));
}

function blockers(issue: IssueRecord, issues: IssueRecord[]): IssueRecord[] {
  return issue.dependsOn
    .map(id => issues.find(item => item.key === id))
    .filter((item): item is IssueRecord => Boolean(item));
}

function atLeast(issue: IssueRecord, phase: Phase): boolean {
  const current = phaseOf(issue.labels);
  if (!current || current === 'cancelled') {
    return false;
  }
  return phaseRank(current) >= phaseRank(phase);
}

function agent(
  issue: string,
  action: AgentAction,
  phase: Phase,
  pr: string,
  reason: string,
): Decision {
  return {kind: 'agent', issue, action, skill: ACTION_SKILL[action], phase, pr, reason};
}

/** A merged pull request closes the cycle. `sdd:auto-merge` is the only path where the machine merges. */
function mergeOrWait(
  issueKey: string,
  pr: PullSnapshot | undefined,
  merged: PullSnapshot[],
  autoMerge: boolean,
): Decision {
  if (merged.length > 0) {
    return {kind: 'advance', issue: issueKey, to: 'accepted', reason: 'pull request merged'};
  }
  if (!pr) {
    return {kind: 'wait', issue: issueKey, reason: 'accepted needs a merged pull request'};
  }
  if (pr.checks !== 'green') {
    return {
      kind: 'wait',
      issue: issueKey,
      reason: `wait for green checks before merge of PR #${pr.id}`,
    };
  }
  if (!autoMerge) {
    return {kind: 'wait', issue: issueKey, reason: `wait for merge of PR #${pr.id}`};
  }
  return {kind: 'merge', issue: issueKey, pull: String(pr.id), reason: `merge PR #${pr.id}`};
}

export function decide(
  issue: IssueRecord,
  issues: IssueRecord[],
  pulls: PullSnapshot[],
  change: ChangeView,
): Decision {
  const names = issue.labels;
  if (names.includes('sdd:cancelled')) {
    return {kind: 'done', issue: issue.key, reason: 'cancelled'};
  }
  const open = pulls.filter(pr => pr.state === 'OPEN');
  if (open.length > 1) {
    return {
      kind: 'wait',
      issue: issue.key,
      reason: severalOpenReason(open.map(pr => pr.id)),
    };
  }
  const phase = phaseOf(names);
  if (!phase) {
    return {kind: 'advance', issue: issue.key, to: 'proposing', reason: 'enter the cycle'};
  }
  if (phase === 'accepted') {
    const acceptedOpen = open;
    const acceptedMerged = pulls.filter(item => item.state === 'MERGED');
    const acceptedPr = acceptedMerged[0] ?? acceptedOpen[0];
    if (!change.archived && (change.proposal || change.delta)) {
      return agent(
        issue.key,
        'archive',
        phase,
        acceptedPr ? String(acceptedPr.id) : '',
        'archive the change',
      );
    }
    return mergeOrWait(issue.key, acceptedOpen[0], acceptedMerged, false);
  }
  const closed = GATE_CLOSES[phase];
  if (closed) {
    return closeGate(issue.key, phase, closed, change);
  }

  const early = phaseRank(phase) <= phaseRank('tasking');
  if (early && change.archived) {
    return agent(issue.key, 'unarchive', phase, '', 'return the delta to the change');
  }

  const merged = pulls.filter(pr => pr.state === 'MERGED');
  const pr = open[0];
  const feedback = pr?.review ?? emptyReview;
  if (feedback.unanswered && pr) {
    return agent(
      issue.key,
      'classify-comments',
      phase,
      String(pr.id),
      'unclassified review threads',
    );
  }

  // A skill stopped for a person, or the machine opened the review gate.
  if (names.includes('sdd:wait-human')) {
    return {
      kind: 'wait',
      issue: issue.key,
      reason: `sdd:wait-human is set on ${phase}. Do the ask on the issue and change the phase there, or run remote-solver accept or unwait ${issue.key}`,
    };
  }

  // `out` is not in the map, so it does not move the phase. verifying waits
  // for proof before it follows a marker, unless the checks are already red.
  if (phase !== 'verifying') {
    const back = feedback.rollback;
    if (back && phaseRank(back) < phaseRank(phase)) {
      return {
        kind: 'advance',
        issue: issue.key,
        to: back,
        reason: 'review thread sent the change back',
      };
    }
  }

  // A spec thread cannot be fixed against a capability that has no baseline.
  if (phase === 'specifying' && change.missingBaseline.length) {
    return agent(
      issue.key,
      'restore-baseline',
      phase,
      pr ? String(pr.id) : '',
      `no baseline for ${change.missingBaseline.join(', ')}`,
    );
  }

  const layer = layerOfPhase(phase);
  if (layer && feedback.layers.includes(layer) && pr) {
    const action = LAYER_ACTION[layer];
    if (!action) {
      return {
        kind: 'wait',
        issue: issue.key,
        reason: `threads on ${layer} but no action`,
      };
    }
    return agent(issue.key, action, phase, String(pr.id), `threads on ${layer}`);
  }

  const auto = (tag: string) => names.includes(tag);

  if (phase === 'proposing') {
    if (!change.proposal || !pr) {
      return agent(
        issue.key,
        'create-proposal',
        phase,
        pr ? String(pr.id) : '',
        change.proposal
          ? 'publish proposal.md to the pull request'
          : 'write proposal.md and open the pull request',
      );
    }
    if (change.openQuestions) {
      return {
        kind: 'wait',
        issue: issue.key,
        reason: `${change.openQuestions} open question(s) in proposal.md`,
      };
    }
    if (auto('sdd:auto-plan')) {
      return {kind: 'advance', issue: issue.key, to: 'specifying', reason: 'sdd:auto-plan'};
    }
    return reviewGate(issue.key, 'proposal', 'proposing', 'proposed');
  }

  if (phase === 'specifying') {
    if (!change.proposal) {
      return {kind: 'advance', issue: issue.key, to: 'proposing', reason: 'proposal.md is missing'};
    }
    if (!change.delta || !pr) {
      return agent(
        issue.key,
        'create-initial-specs',
        phase,
        pr ? String(pr.id) : '',
        change.delta
          ? 'publish the delta spec to the pull request'
          : 'write the delta spec and publish it',
      );
    }
    if (auto('sdd:auto-spec')) {
      return {kind: 'advance', issue: issue.key, to: 'designing', reason: 'sdd:auto-spec'};
    }
    return reviewGate(issue.key, 'spec', 'specifying', 'specified');
  }

  if (phase === 'designing') {
    if (!change.delta) {
      return {kind: 'advance', issue: issue.key, to: 'specifying', reason: 'delta spec is missing'};
    }
    if (!change.design || !pr) {
      return agent(
        issue.key,
        'create-design',
        phase,
        pr ? String(pr.id) : '',
        change.design ? 'publish design.md to the pull request' : 'write design.md and publish it',
      );
    }
    if (change.openDecisions) {
      return {
        kind: 'wait',
        issue: issue.key,
        reason: `${change.openDecisions} open decision(s) in design.md`,
      };
    }
    if (auto('sdd:auto-design')) {
      return {kind: 'advance', issue: issue.key, to: 'tasking', reason: 'sdd:auto-design'};
    }
    return reviewGate(issue.key, 'design', 'designing', 'designed');
  }

  if (phase === 'tasking') {
    if (!change.design) {
      return {kind: 'advance', issue: issue.key, to: 'designing', reason: 'design.md is missing'};
    }
    if (!change.tasks || !pr) {
      return agent(
        issue.key,
        'create-tasks',
        phase,
        pr ? String(pr.id) : '',
        change.tasks ? 'publish tasks.md to the pull request' : 'write tasks.md and publish it',
      );
    }
    const kids = children(issue.key, issues);
    const behind = kids.filter(kid => !atLeast(kid, 'specified'));
    if (behind.length) {
      return {
        kind: 'wait',
        issue: issue.key,
        reason: `wait for children to reach specified: ${behind.map(kid => '#' + kid.key).join(', ')}`,
      };
    }
    return {kind: 'advance', issue: issue.key, to: 'implementing', reason: 'tasks exist'};
  }

  if (phase === 'implementing') {
    if (!change.tasks) {
      return {kind: 'advance', issue: issue.key, to: 'tasking', reason: 'tasks.md is missing'};
    }
    if (change.openTasks > 0) {
      return agent(
        issue.key,
        'implement-next-task',
        phase,
        pr ? String(pr.id) : '',
        'next open task',
      );
    }
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
    return {kind: 'advance', issue: issue.key, to: 'verifying', reason: 'no open tasks'};
  }

  if (phase === 'verifying') {
    if (!pr) {
      return {kind: 'wait', issue: issue.key, reason: 'verifying needs an open pull request'};
    }
    const back = pr.review.rollback;
    if (pr.checks === 'red') {
      if (back) {
        return {
          kind: 'advance',
          issue: issue.key,
          to: back,
          reason: 'review thread sent the change back',
        };
      }
      return agent(
        issue.key,
        'classify-failures',
        phase,
        String(pr.id),
        'red checks',
      );
    }
    if (pr.checks !== 'green') {
      return {kind: 'wait', issue: issue.key, reason: `checks are ${pr.checks}`};
    }
    if (back) {
      return {
        kind: 'advance',
        issue: issue.key,
        to: back,
        reason: 'review thread sent the change back',
      };
    }
    return {kind: 'advance', issue: issue.key, to: 'accepting', reason: 'checks are green'};
  }

  if (phase !== 'accepting') {
    return {kind: 'wait', issue: issue.key, reason: `unknown phase ${phase}`};
  }
  if (!pr && merged.length === 0) {
    return {kind: 'wait', issue: issue.key, reason: 'accepting needs the pull request'};
  }
  if (!change.archived) {
    return agent(
      issue.key,
      'archive',
      phase,
      pr ? String(pr.id) : String(merged[0].id),
      'archive the change',
    );
  }
  return mergeOrWait(issue.key, pr, merged, names.includes('sdd:auto-merge'));
}

export function accept(issue: IssueRecord, change: ChangeView): Decision {
  if (!issue.labels.includes('sdd:cycle')) {
    return {kind: 'wait', issue: issue.key, reason: `#${issue.key} has no sdd:cycle label`};
  }
  const phase = phaseOf(issue.labels);
  const next = phase ? HUMAN_NEXT[phase] : undefined;
  if (!phase || !next) {
    return {
      kind: 'wait',
      issue: issue.key,
      reason: `#${issue.key} is ${phase ?? 'without a phase'}. Accept closes only proposing, specifying, or designing.`,
    };
  }
  const blocker = gateBlocker(issue.key, phase, change);
  if (blocker) {
    return {kind: 'wait', issue: issue.key, reason: blocker};
  }
  return {kind: 'advance', issue: issue.key, to: next, reason: `${phase} → ${next}`};
}

export type Settlement = {
  decision: Decision;
  transitions: Extract<Decision, {kind: 'advance'}>[];
  labels: string[];
};

export function settle(
  issue: IssueRecord,
  issues: IssueRecord[],
  pulls: PullSnapshot[],
  change: ChangeView,
): Settlement {
  let labels = [...issue.labels];
  const transitions: Settlement['transitions'] = [];
  for (let step = 0; step < 12; step += 1) {
    const decision = decide({...issue, labels}, issues, pulls, change);
    if (decision.kind !== 'advance') {
      return {decision, transitions, labels};
    }
    labels = labelsAfterAdvance(labels, decision.to);
    transitions.push(decision);
    // Closing the issue is not a label change the next decide can see.
    if (decision.to === 'accepted') {
      return {
        decision: {kind: 'done', issue: issue.key, reason: decision.reason},
        transitions,
        labels,
      };
    }
  }
  return {
    decision: {kind: 'wait', issue: issue.key, reason: 'Too many mechanical transitions'},
    transitions,
    labels,
  };
}
