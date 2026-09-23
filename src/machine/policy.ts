import path from 'node:path';

import type {ChangeView} from './change.ts';
import {changeDir} from './naming.ts';
import {labelsAfterAdvance, phaseOf, phaseRank, type Phase} from './phase.ts';
import type {CheckState, IssueRecord} from './port.ts';
import {emptyReview, layerOfPhase, type ReviewView} from './review.ts';

export type Decision =
  | {
      kind: 'agent';
      issue: string;
      action: string;
      skill: string;
      phase: Phase;
      pr: string;
      reason: string;
    }
  | {kind: 'wait'; issue: string | null; reason: string}
  | {kind: 'done'; issue: string | null; reason: string}
  | {kind: 'advance'; issue: string; to: Phase; reason: string}
  | {kind: 'merge'; issue: string; pull: string; reason: string};

/** Several open pull requests stop the cycle until a person leaves one. */
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

const PROMPT_SKILL: Record<string, string> = {
  proposing: 'sdd-plan',
  specifying: 'sdd-specify',
  designing: 'sdd-design',
  tasking: 'sdd-tasks',
  implementing: 'sdd-implement',
  verifying: 'sdd-verify',
  accepting: 'sdd-accept',
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

function autoGateReady(
  phase: Phase,
  names: string[],
  change: ChangeView,
  pr: PullSnapshot | undefined,
): boolean {
  if (!pr) {
    return false;
  }
  const gate = writingGate(phase, change);
  if (!gate.artifact || gate.open > 0) {
    return false;
  }
  if (phase === 'proposing' && names.includes('sdd:auto-plan')) {
    return true;
  }
  if (phase === 'specifying' && names.includes('sdd:auto-spec')) {
    return true;
  }
  if (phase === 'designing' && names.includes('sdd:auto-design')) {
    return true;
  }
  return false;
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
  action: string,
  skill: string,
  phase: Phase,
  pr: string,
  reason: string,
): Decision {
  return {kind: 'agent', issue, action, skill, phase, pr, reason};
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
  const phase = phaseOf(names);
  if (!phase) {
    return {kind: 'advance', issue: issue.key, to: 'proposing', reason: 'enter the cycle'};
  }
  if (phase === 'accepted') {
    const acceptedOpen = pulls.filter(item => item.state === 'OPEN');
    const acceptedMerged = pulls.filter(item => item.state === 'MERGED');
    if (acceptedOpen.length > 1) {
      return {
        kind: 'wait',
        issue: issue.key,
        reason: severalOpenReason(acceptedOpen.map(item => item.id)),
      };
    }
    const acceptedPr = acceptedMerged[0] ?? acceptedOpen[0];
    if (!change.archived && (change.proposal || change.delta)) {
      return agent(
        issue.key,
        'archive',
        'sdd-accept',
        phase,
        acceptedPr ? String(acceptedPr.id) : '',
        'archive the change',
      );
    }
    return mergeOrWait(issue.key, acceptedOpen[0], acceptedMerged, false);
  }
  if (phase === 'proposed') {
    return {kind: 'advance', issue: issue.key, to: 'specifying', reason: 'proposal accepted'};
  }
  if (phase === 'specified') {
    return {kind: 'advance', issue: issue.key, to: 'designing', reason: 'spec accepted'};
  }
  if (phase === 'designed') {
    return {kind: 'advance', issue: issue.key, to: 'tasking', reason: 'design accepted'};
  }

  const early = phaseRank(phase) <= phaseRank('tasking');
  if (early && change.archived) {
    return agent(issue.key, 'unarchive', 'sdd-accept', phase, '', 'return the delta to the change');
  }

  const open = pulls.filter(pr => pr.state === 'OPEN');
  const merged = pulls.filter(pr => pr.state === 'MERGED');
  if (open.length > 1) {
    return {
      kind: 'wait',
      issue: issue.key,
      reason: severalOpenReason(open.map(pr => pr.id)),
    };
  }
  const pr = open[0];
  const feedback = pr?.review ?? emptyReview;
  if (feedback.unanswered && pr) {
    return agent(
      issue.key,
      'classify-comments',
      'sdd-pr-comments',
      phase,
      String(pr.id),
      'unclassified review threads',
    );
  }

  // A layer skill stopped for a person. An auto gate whose artifact is already
  // on the pull request is not that stop: the machine advances and clears the label.
  if (names.includes('sdd:wait-human') && !autoGateReady(phase, names, change, pr)) {
    return {
      kind: 'wait',
      issue: issue.key,
      reason: `sdd:wait-human is set on ${phase}. Review, then remote-solver unwait ${issue.key}`,
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

  const layer = layerOfPhase(phase);
  if (layer && feedback.layers.includes(layer) && pr) {
    const action =
      layer === 'proposal'
        ? 'improve-proposal'
        : layer === 'spec'
          ? 'improve-specs'
          : layer === 'design'
            ? 'improve-design'
            : layer === 'tasks'
              ? 'improve-tasks'
              : 'fix-implementation';
    const skill = layer === 'code' ? 'sdd-implement' : PROMPT_SKILL[phase];
    if (!skill || !pr) {
      return {
        kind: 'wait',
        issue: issue.key,
        reason: `threads on ${layer} but no skill or pull request`,
      };
    }
    return agent(issue.key, action, skill, phase, String(pr.id), `threads on ${layer}`);
  }

  const auto = (tag: string) => names.includes(tag);

  if (phase === 'proposing') {
    if (!change.proposal || !pr) {
      return agent(
        issue.key,
        'create-proposal',
        'sdd-plan',
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
    return {
      kind: 'wait',
      issue: issue.key,
      reason: 'wait for proposal review (remote-solver accept <issue>)',
    };
  }

  if (phase === 'specifying') {
    if (!change.proposal) {
      return {kind: 'advance', issue: issue.key, to: 'proposing', reason: 'proposal.md is missing'};
    }
    if (change.missingBaseline.length) {
      return agent(
        issue.key,
        'restore-baseline',
        'sdd-baseline',
        phase,
        pr ? String(pr.id) : '',
        `no baseline for ${change.missingBaseline.join(', ')}`,
      );
    }
    if (!change.delta || !pr) {
      return agent(
        issue.key,
        'create-initial-specs',
        'sdd-specify',
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
    return {
      kind: 'wait',
      issue: issue.key,
      reason: 'wait for spec review (remote-solver accept <issue>)',
    };
  }

  if (phase === 'designing') {
    if (!change.delta) {
      return {kind: 'advance', issue: issue.key, to: 'specifying', reason: 'delta spec is missing'};
    }
    if (!change.design || !pr) {
      return agent(
        issue.key,
        'create-design',
        'sdd-design',
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
    return {
      kind: 'wait',
      issue: issue.key,
      reason: 'wait for design review (remote-solver accept <issue>)',
    };
  }

  if (phase === 'tasking') {
    if (!change.design) {
      return {kind: 'advance', issue: issue.key, to: 'designing', reason: 'design.md is missing'};
    }
    if (!change.tasks || !pr) {
      return agent(
        issue.key,
        'create-tasks',
        'sdd-tasks',
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
        'sdd-implement',
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
        'sdd-verify',
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
      'sdd-accept',
      phase,
      pr ? String(pr.id) : String(merged[0].id),
      'archive the change',
    );
  }
  return mergeOrWait(issue.key, pr, merged, names.includes('sdd:auto-merge'));
}

const HUMAN_NEXT: Partial<Record<Phase, Phase>> = {
  proposing: 'specifying',
  specifying: 'designing',
  designing: 'tasking',
};

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
  const gate = writingGate(phase, change);
  const required =
    phase === 'proposing' ? 'proposal.md' : phase === 'specifying' ? 'specs' : 'design.md';
  if (!gate.artifact) {
    return {
      kind: 'wait',
      issue: issue.key,
      reason: `Missing ${path.join(changeDir(issue.key), required)}`,
    };
  }
  if (gate.open) {
    const heading = phase === 'designing' ? 'Open decisions' : 'Open questions';
    return {
      kind: 'wait',
      issue: issue.key,
      reason: `#${issue.key} still has open items under ${heading}`,
    };
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
