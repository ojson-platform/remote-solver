import type {CheckState, Conversation, IssueRecord, ThreadRecord} from './port.ts';

import path from 'node:path';

import {cardGap, HEADINGS, specsReady, unslicedScenario, type ChangeView} from './change.ts';
import {changeDir} from './naming.ts';
import {
  archiveMark,
  foldedFromTip,
  GATE_CLOSES,
  labelsAfterAdvance,
  phaseOf,
  phaseRank,
  reachedRank,
  type GateEvent,
  type Phase,
} from './phase.ts';
import {ROBOT_MARK} from './marker.ts';
import {emptyReview, layerOfPhase, type ReviewView} from './review.ts';
import {ACTION_SKILL, LAYER_ACTION, type AgentAction, type Skill} from './route.ts';

export type Decision =
  | ({
      kind: 'agent';
      issue: string;
      action: AgentAction;
      skill: Skill;
      phase: Phase;
      pr: string;
      reason: string;
    } & LabelFix)
  /** `gate` names the open review. The ask is posted only when `sdd:wait-human` is not already set. */
  | ({kind: 'wait'; issue: string | null; reason: string; gate?: Gate} & LabelFix)
  | ({kind: 'done'; issue: string | null; reason: string} & LabelFix)
  /** `comment` is posted on the issue after the move. */
  | ({kind: 'advance'; issue: string; to: Phase; reason: string; comment?: string} & LabelFix)
  | ({kind: 'merge'; issue: string; pull: string; reason: string} & LabelFix)
  /** The machine folds the change. The same effect as a merge: perform, then read again. */
  | ({kind: 'archive'; issue: string; phase: Phase; pr: string; reason: string} & LabelFix)
  | ({kind: 'unarchive'; issue: string; phase: Phase; reason: string} & LabelFix);

/** A rejected gate label leaves, and the writing phase stays. */
type LabelFix = {drop?: string[]; stay?: Phase};

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
  /** The head does not apply onto the base. Absent when the host did not say. */
  conflict?: boolean;
  /** Threads and conversation from the one read. The board paints them without asking again. */
  reading?: {threads: ThreadRecord[]; notes: Conversation[]};
};

export function writingGate(phase: Phase, change: ChangeView): {artifact: boolean; open: number} {
  if (phase === 'proposing') {
    return {artifact: change.proposal, open: change.openQuestions};
  }
  if (phase === 'specifying') {
    return {artifact: specsReady(change), open: 0};
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
  return stampBehind(phase, change);
}

/** The phase file's stamp is behind its input. Empty revisions are the test harness, not a checkout. */
export function stampBehind(phase: Phase, change: ChangeView): string | null {
  if (
    phase === 'specifying' &&
    change.delta &&
    change.proposalRevision !== '' &&
    change.specStamp !== change.proposalRevision
  ) {
    return 'the proposal revision is not the stamp';
  }
  if (
    phase === 'designing' &&
    change.design &&
    change.specsRevision !== '' &&
    change.designStamp !== change.specsRevision
  ) {
    return 'the spec revision is not the stamp';
  }
  if (
    phase === 'tasking' &&
    change.tasks &&
    change.tasksInputRevision !== '' &&
    change.tasksStamp !== change.tasksInputRevision
  ) {
    return 'the design revision is not the stamp';
  }
  return null;
}

const GATE_OF: Partial<Record<Phase, GateEvent>> = {
  proposing: 'proposed',
  specifying: 'specified',
  designing: 'designed',
};

const AUTO_OF: Partial<Record<Phase, string>> = {
  proposing: 'sdd:auto-plan',
  specifying: 'sdd:auto-spec',
  designing: 'sdd:auto-design',
};

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
function linkWait(issue: IssueRecord, issues: IssueRecord[]): Decision | null {
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

function agent(
  issue: string,
  action: AgentAction,
  phase: Phase,
  pr: string,
  reason: string,
): Decision {
  return {kind: 'agent', issue, action, skill: ACTION_SKILL[action], phase, pr, reason};
}

/** One reading of a cycle: the phase, the hold, and whether the tip is the archive commit. */
export type CycleRecord = {
  phase: Phase | null;
  /** The ask, when `sdd:wait-human` is on. Absent when the person is not holding the issue. */
  hold: string | null;
  /** The tip message carries `Sdd-Archive` for this issue. */
  folded: boolean;
  cycle: boolean;
  autoPlan: boolean;
  autoSpec: boolean;
  autoDesign: boolean;
  autoMerge: boolean;
  /** A gate label on the issue. The same event as `sdd accept`. */
  accept: GateEvent | null;
  /** Signature of an effect the last empty run refused. A later person comment clears it. */
  refused: string | null;
};

/** Labels, the hold, and the tip line, collapsed once. The decision does not read the label set. */
export type IssueNote = {body: string; manager?: boolean};

/** `phase`, `action`, and `reason` of one effect. */
export function effectSignature(part: {phase: string; action: string; reason: string}): string {
  return `${part.phase}\0${part.action}\0${part.reason}`;
}

export function refusalBody(signature: string): string {
  return `sdd:refused\n${signature}`;
}

/** The refusal still in force. A later person comment clears every older one. */
export function refusalOf(notes: readonly IssueNote[]): string | null {
  for (let index = notes.length - 1; index >= 0; index -= 1) {
    const note = notes[index];
    if (note.manager) {
      return null;
    }
    const lines = note.body.split('\n').map(line => line.trim()).filter(line => line !== '');
    const head = lines[0]?.startsWith(ROBOT_MARK) ? lines[0].slice(ROBOT_MARK.length).trim() : lines[0];
    if (head === 'sdd:refused') {
      return lines[1] ?? '';
    }
  }
  return null;
}

function blockRepeated(decision: Decision, refused: string | null): Decision {
  if (refused === null) {
    return decision;
  }
  const effect =
    decision.kind === 'agent'
      ? {phase: decision.phase, action: decision.action, reason: decision.reason}
      : decision.kind === 'archive'
        ? {phase: decision.phase, action: 'archive', reason: decision.reason}
        : decision.kind === 'unarchive'
          ? {phase: decision.phase, action: 'unarchive', reason: decision.reason}
          : null;
  if (!effect || refused !== effectSignature(effect)) {
    return decision;
  }
  return {kind: 'wait', issue: decision.issue, reason: `refused ${effect.action}: ${effect.reason}`};
}

export function cycleRecord(issue: IssueRecord, tip: string, notes: readonly IssueNote[] = []): CycleRecord {
  const names = issue.labels;
  const accept: GateEvent | null = names.includes('sdd:designed')
    ? 'designed'
    : names.includes('sdd:specified')
      ? 'specified'
      : names.includes('sdd:proposed')
        ? 'proposed'
        : null;
  const phase = phaseOf(names) ?? (accept ? (GATE_CLOSES[accept] ?? null) : null);
  return {
    phase,
    hold:
      names.includes('sdd:wait-human') && phase
        ? `sdd:wait-human is set on ${phase}. Do the ask on the issue.`
        : null,
    folded: foldedFromTip(tip, issue.key),
    cycle: names.includes('sdd:cycle'),
    autoPlan: names.includes('sdd:auto-plan'),
    autoSpec: names.includes('sdd:auto-spec'),
    autoDesign: names.includes('sdd:auto-design'),
    autoMerge: names.includes('sdd:auto-merge'),
    accept,
    refused: refusalOf(notes),
  };
}

/** A test harness that still says `archived` stands for the tip line. A passed tip replaces it. */
function legacyTip(issue: IssueRecord, change: ChangeView): string {
  return change.archived ? archiveMark(issue.key) : '';
}

/** Archived with a merged pull request and none open: the cycle is finished. */
function finishedCycle(pulls: PullSnapshot[], folded: boolean, phase: Phase | null): boolean {
  if (phase === 'cancelled') {
    return false;
  }
  if (!folded) {
    return false;
  }
  if (pulls.some(pr => pr.state === 'OPEN')) {
    return false;
  }
  return pulls.some(pr => pr.state === 'MERGED');
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
  record: CycleRecord = cycleRecord(issue, legacyTip(issue, change)),
): Decision {
  return blockRepeated(decideOpen(issue, issues, pulls, change, record), record.refused);
}

function decideOpen(
  issue: IssueRecord,
  issues: IssueRecord[],
  pulls: PullSnapshot[],
  change: ChangeView,
  record: CycleRecord = cycleRecord(issue, legacyTip(issue, change)),
): Decision {
  if (record.phase === 'cancelled') {
    return {kind: 'done', issue: issue.key, reason: 'cancelled'};
  }
  const open = pulls.filter(pr => pr.state === 'OPEN');
  const phase = record.phase;
  if (open.length > 1) {
    const openTask =
      phase === 'implementing' &&
      change.tasks &&
      change.openTasks > 0 &&
      !open.some(pr => pr.conflict);
    if (openTask) {
      return agent(
        issue.key,
        'implement-next-task',
        phase,
        String(open[0].id),
        'next open task',
      );
    }
    return {
      kind: 'wait',
      issue: issue.key,
      reason: severalOpenReason(open.map(pr => pr.id)),
    };
  }
  if (!phase) {
    return {kind: 'advance', issue: issue.key, to: 'proposing', reason: 'enter the cycle'};
  }
  if (finishedCycle(pulls, record.folded, phase)) {
    const held = linkWait(issue, issues);
    if (held) {
      const openTask =
        phase === 'implementing' &&
        change.tasks &&
        change.openTasks > 0 &&
        !open.some(pr => pr.conflict);
      if (openTask) {
        return agent(issue.key, 'implement-next-task', phase, '', 'next open task');
      }
      return held;
    }
    return {kind: 'done', issue: issue.key, reason: 'finished cycle'};
  }
  if (phase === 'accepted') {
    if (!record.folded) {
      return {kind: 'wait', issue: issue.key, reason: 'the change is not archived'};
    }
    const acceptedMerged = pulls.filter(item => item.state === 'MERGED');
    return mergeOrWait(issue.key, open[0], acceptedMerged, false);
  }
  // A repair must not commit on top of the archive commit. Accepting still rolls back first; the next step of this settlement restores the change while that commit is the tip. A merged pull request stays archived.
  if (
    phaseRank(phase) < phaseRank('accepting') &&
    record.folded &&
    !pulls.some(pr => pr.state === 'MERGED')
  ) {
    return {kind: 'unarchive', issue: issue.key, phase, reason: 'return the delta to the change'};
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

  // `out` is not in the map, so it does not move the phase. On verifying the
  // checks must already be red or green; pending does not roll back.
  // A classified marker moves before a held review gate (ADR-0028).
  const back = feedback.rollback;
  const checksKnown = pr?.checks === 'red' || pr?.checks === 'green';
  if (back && phaseRank(back) < phaseRank(phase) && (phase !== 'verifying' || checksKnown)) {
    return {
      kind: 'advance',
      issue: issue.key,
      to: back,
      reason: 'review thread sent the change back',
    };
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
  // The plan does not read the checkout. Added is a published shelf only after ## Shelf lists it.
  if (phase === 'specifying' && !change.delta && change.unjudged.length) {
    return agent(
      issue.key,
      'restore-baseline',
      phase,
      pr ? String(pr.id) : '',
      `shelf not published for ${change.unjudged.join(', ')}`,
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

  const auto = (tag: string) =>
    tag === 'sdd:auto-plan'
      ? record.autoPlan
      : tag === 'sdd:auto-spec'
        ? record.autoSpec
        : tag === 'sdd:auto-design'
          ? record.autoDesign
          : tag === 'sdd:auto-merge'
            ? record.autoMerge
            : false;

  // Forward: the gate label and `sdd accept` are the same event. A failed
  // guard drops the label. It does not store the gate as a phase.
  const gate = GATE_OF[phase];
  const autoTag = AUTO_OF[phase];
  const person = gate !== undefined && record.accept === gate;
  const granted = person || (autoTag !== undefined && auto(autoTag) && record.hold === null);
  const blocker = gate ? gateBlocker(issue.key, phase, change) : null;
  let patch: LabelFix = {};
  if (granted && gate && pr && !blocker) {
    const next = HUMAN_NEXT[phase] as Phase;
    const reason = person ? `${phase} → ${next}` : autoTag;
    if (reason !== undefined) {
      return person
        ? {
            kind: 'advance',
            issue: issue.key,
            to: next,
            reason,
            comment: `sdd:accept ${phase} → ${next}`,
          }
        : {kind: 'advance', issue: issue.key, to: next, reason};
    }
  }
  if (person && gate) {
    patch = {drop: [`sdd:${gate}`], stay: phase};
  }
  const hand = (decision: Decision): Decision =>
    patch.drop || patch.stay ? {...decision, ...patch} : decision;

  // A skill stopped for a person, or the machine opened the review gate.
  // The gate holds when no classified thread asks for a layer.
  if (record.hold !== null) {
    const review =
      phase === 'proposing'
        ? {artifact: 'proposal', to: 'proposed' as const}
        : phase === 'specifying'
          ? {artifact: 'spec', to: 'specified' as const}
          : phase === 'designing'
            ? {artifact: 'design', to: 'designed' as const}
            : null;
    if (review && !gateBlocker(issue.key, phase, change)) {
      return hand(reviewGate(issue.key, review.artifact, phase, review.to));
    }
    return hand({
      kind: 'wait',
      issue: issue.key,
      reason: `sdd:wait-human is set on ${phase}. Do the ask on the issue.`,
    });
  }

  if (phase === 'proposing') {
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
        reason: `${change.openQuestions} open question(s) in proposal.md`,
      });
    }
    return hand(reviewGate(issue.key, 'proposal', 'proposing', 'proposed'));
  }

  if (phase === 'specifying') {
    if (!change.proposal) {
      return hand({kind: 'advance', issue: issue.key, to: 'proposing', reason: 'proposal.md is missing'});
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
    if (!pr) {
      return hand(
        agent(
          issue.key,
          'create-initial-specs',
          phase,
          '',
          change.delta
            ? 'publish the delta spec to the pull request'
            : 'publish the change to the pull request',
        ),
      );
    }
    if (stampBehind(phase, change)) {
      return hand(
        agent(
          issue.key,
          'create-initial-specs',
          phase,
          String(pr.id),
          'the proposal revision is not the stamp',
        ),
      );
    }
    return hand(reviewGate(issue.key, 'spec', 'specifying', 'specified'));
  }

  if (phase === 'designing') {
    if (!specsReady(change)) {
      return hand({kind: 'advance', issue: issue.key, to: 'specifying', reason: 'delta spec is missing'});
    }
    if (!change.design || !pr) {
      return hand(
        agent(
          issue.key,
          'create-design',
          phase,
          pr ? String(pr.id) : '',
          change.design ? 'publish design.md to the pull request' : 'write design.md and publish it',
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
    if (stampBehind(phase, change)) {
      return hand(
        agent(
          issue.key,
          'create-design',
          phase,
          pr ? String(pr.id) : '',
          'the spec revision is not the stamp',
        ),
      );
    }
    return hand(reviewGate(issue.key, 'design', 'designing', 'designed'));
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
    if (stampBehind(phase, change)) {
      return agent(
        issue.key,
        'create-tasks',
        phase,
        pr ? String(pr.id) : '',
        'the design revision is not the stamp',
      );
    }
    const cut = cardGap(change) ?? unslicedScenario(change);
    if (cut) {
      return agent(issue.key, 'create-tasks', phase, pr ? String(pr.id) : '', cut);
    }
    const held = linkWait(issue, issues);
    if (held) {
      return held;
    }
    return {kind: 'advance', issue: issue.key, to: 'implementing', reason: 'tasks exist'};
  }

  if (phase === 'implementing') {
    if (!change.tasks) {
      return {kind: 'advance', issue: issue.key, to: 'tasking', reason: 'tasks.md is missing'};
    }
    if (pr?.conflict) {
      return agent(issue.key, 'fix-implementation', phase, String(pr.id), 'rebase onto the base');
    }
    const card = cardGap(change);
    if (card) {
      return {kind: 'advance', issue: issue.key, to: 'tasking', reason: card};
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
    const slice = unslicedScenario(change);
    if (slice) {
      return {kind: 'advance', issue: issue.key, to: 'tasking', reason: slice};
    }
    const held = linkWait(issue, issues);
    if (held) {
      return held;
    }
    return {kind: 'advance', issue: issue.key, to: 'verifying', reason: 'no open tasks'};
  }

  if (phase === 'verifying') {
    if (!pr) {
      return {kind: 'wait', issue: issue.key, reason: 'verifying needs an open pull request'};
    }
    if (pr.conflict) {
      return {
        kind: 'advance',
        issue: issue.key,
        to: 'implementing',
        reason: 'pull request conflicts with the base',
      };
    }
    if (pr.checks === 'red') {
      return agent(issue.key, 'classify-failures', phase, String(pr.id), 'red checks');
    }
    if (pr.checks !== 'green') {
      return {kind: 'wait', issue: issue.key, reason: `checks are ${pr.checks}`};
    }
    const held = linkWait(issue, issues);
    if (held) {
      return held;
    }
    return {kind: 'advance', issue: issue.key, to: 'accepting', reason: 'checks are green'};
  }

  if (phase !== 'accepting') {
    return {kind: 'wait', issue: issue.key, reason: `unknown phase ${phase}`};
  }
  if (!pr && merged.length === 0) {
    return {kind: 'wait', issue: issue.key, reason: 'accepting needs the pull request'};
  }
  if (!record.folded) {
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
  return mergeOrWait(issue.key, pr, merged, record.autoMerge);
}

export function accept(
  issue: IssueRecord,
  change: ChangeView,
  record: CycleRecord = cycleRecord(issue, legacyTip(issue, change)),
): Decision {
  if (!record.cycle) {
    return {kind: 'wait', issue: issue.key, reason: `#${issue.key} has no sdd:cycle label`};
  }
  const phase = record.phase;
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
  tip?: string,
): Settlement {
  const message = tip ?? legacyTip(issue, change);
  let labels = [...issue.labels];
  const transitions: Settlement['transitions'] = [];
  for (let step = 0; step < 12; step += 1) {
    const decision = decide(
      {...issue, labels},
      issues,
      pulls,
      change,
      cycleRecord({...issue, labels}, message),
    );
    if (decision.drop?.length) {
      const dropping = new Set(decision.drop);
      labels = labels.filter(name => !dropping.has(name));
    }
    if (decision.kind !== 'advance') {
      if (decision.stay && !labels.includes(`sdd:${decision.stay}`)) {
        labels = [...labels, `sdd:${decision.stay}`];
      }
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
