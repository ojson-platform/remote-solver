export type ChangeView = {
  proposal: boolean;
  delta: boolean;
  design: boolean;
  tasks: boolean;
  archived: boolean;
  openQuestions: number;
  openDecisions: number;
  openTasks: number;
  /** Id of the first open task. Empty when `tasks.md` names none. */
  openTask?: string;
  /** Ids under Added and Modified. Empty when the proposal names none. */
  capabilities: string[];
  missingBaseline: string[];
  /** Added ids `## Shelf` does not list yet. The baseline look has not been published. */
  unjudged: string[];
  /** Hash of `proposal.md`. Empty when the caller did not read a checkout. */
  proposalRevision: string;
  /** Hash of the delta specs. */
  specsRevision: string;
  /** Hash of the delta specs and `design.md`, the input `tasks.md` absorbs. */
  tasksInputRevision: string;
  /** `sdd-absorbed` shared by every delta spec. Empty when any spec omits it. */
  specStamp: string;
  /** `sdd-absorbed` in `design.md`. */
  designStamp: string;
  /** `sdd-absorbed` in `tasks.md`. */
  tasksStamp: string;
  /** A spec changed in the latest commit and its `sdd-absorbed` line did not. */
  specDrift: boolean;
  /** `design.md` changed in the latest commit and its `sdd-absorbed` line did not. */
  designDrift: boolean;
  /** `tasks.md` changed in the latest commit and its `sdd-absorbed` line did not. */
  tasksDrift: boolean;
  /** Scenario titles under ADDED and MODIFIED in the delta. */
  deltaScenarios: string[];
  /** Scenario titles named on the task cards. */
  cardScenarios: string[];
  /** `sdd-delta` shared by every task card. Empty when any card omits it. */
  cardRevision: string;
  /** Scenario titles named by an open or checked line in `tasks.md`. */
  slicedScenarios: string[];
};

/** What a plaque and an open spine need from one branch, plus a mark of its text. */
export type BranchFacts = {
  fingerprint: string;
  questions: number;
  decisions: number;
  tasks?: {done: number; open: number};
  proposal?: string;
  design?: string;
  tasksFile?: string;
  specs: {id: string; file: string}[];
};

/** One delta spec and its baseline, as read for the plaque and the spine. */
export type BranchSpecText = {
  id: string;
  rel: string;
  delta: string;
  baseline: string;
};

/**
 * The branch bytes one read produced.
 * The plaque summary and the spine are projections of this text.
 * `baselines` lists capability ids whose `openspec/specs/<id>/spec.md` exists.
 */
export type BranchText = {
  proposal: string;
  design: string;
  tasks: string;
  /** Bodies of `tasks/<id>.md` for the ids listed in `tasks.md`, in that order. */
  taskFiles?: {id: string; body: string}[];
  specs: BranchSpecText[];
  baselines: string[];
  /** Active change directory, or the archive when that is the only copy. */
  root?: string;
};
