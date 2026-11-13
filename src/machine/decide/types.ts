import type {ReviewView} from '../mark/review.ts';
import type {GateEvent, Phase} from '../phase/phase.ts';
import type {CheckState, Conversation, ThreadRecord} from '../port.ts';
import type {AgentAction, Skill} from './route.ts';

/** A rejected gate label leaves, and the writing phase stays. */
export type LabelFix = {drop?: string[]; stay?: Phase};

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

/** The review gate a person closes: `from` is the writing phase, `to` the gate phase. */
export type Gate = {artifact: string; from: Phase; to: Phase};

export type PullSnapshot = {
  id: string;
  title: string;
  state: string;
  review: ReviewView;
  checks: CheckState;
  /** Failed check runs as `name@completedAt`. Empty when the host named none. */
  failures?: readonly string[];
  /** The head does not apply onto the base. Absent when the host did not say. */
  conflict?: boolean;
  /** Threads and conversation from the one read. The board paints them without asking again. */
  reading?: {threads: ThreadRecord[]; notes: Conversation[]};
};

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
  /** Signature of an effect the label `sdd:refused` is holding. */
  refused: string | null;
  /** What the command said, on the lines after that signature. Empty when the refusal names only the effect. */
  refusalNote: string | null;
};

/** Labels, the hold, and the tip line, collapsed once. The decision does not read the label set. */
export type IssueNote = {body: string; manager?: boolean};

export type Settlement = {
  decision: Decision;
  transitions: Extract<Decision, {kind: 'advance'}>[];
  labels: string[];
};
