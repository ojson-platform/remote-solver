/**
 * Ports the machine needs. Adapters live elsewhere: GitHub issues, GitHub pull
 * requests, git, sandcastle — and, later, Tracker, Arcanum, arc, another runtime.
 * Marker grammar stays above these seams.
 */

import type {SkillMode} from './skill.ts';

export type IssueKey = string;

export type IssueRecord = {
  key: IssueKey;
  title: string;
  body: string;
  state: string;
  labels: string[];
  parent?: IssueKey;
  dependsOn: IssueKey[];
};

export type CheckState = 'green' | 'red' | 'pending' | 'none';

export type Pull = {
  id: string;
  title: string;
  state: string;
  checks: CheckState;
};

/** A review thread after the adapter has decided whether the machine wrote it. */
export type Thread = {resolved: boolean; body: string};

/** A conversation comment. `robot` is a spy mark or an ignored commenter. */
export type Conversation = {body: string; robot: boolean};

/** One remark. `path` and `line` are set only when they sit on the pull request diff. */
export type ReviewNote = {body: string; path?: string; line?: number};

export type Tracker = {
  login(): string;
  listOpen(): IssueRecord[];
  issue(key: IssueKey): IssueRecord;
  labels(key: IssueKey): string[];
  editLabels(key: IssueKey, add: string[], remove: string[]): void;
  updateBody(key: IssueKey, body: string): void;
  comment(key: IssueKey, body: string): void;
  close(key: IssueKey, comment: string): void;
};

export type ThreadTarget = {commit: string; path: string; line: number; body: string};

export type Review = {
  pulls(key: IssueKey): Pull[];
  threads(pull: string): Thread[];
  comments(pull: string): Conversation[];
  ensurePull(key: IssueKey, title: string, body: string): string;
  openThread(pull: string, target: ThreadTarget): void;
  reply(pull: string, comment: string, body: string): void;
  /** Issue comment on the pull request. The adapter adds the spy mark. */
  say(pull: string, body: string): void;
  /** Issue comment on the pull request. The body is posted unchanged. */
  speak(pull: string, body: string): void;
  /**
   * One published review that requests changes. A note with a file becomes a
   * thread on that file or line. Notes without a file stay in the review body.
   */
  flag(pull: string, head: string, notes: ReviewNote[]): void;
  /** Head and base commits of an open pull request. */
  range(pull: string): {head: string; base: string | null};
  resolveThread(thread: string): void;
  /** Text the agent reads: check names, conclusions, logs. */
  checksText(pull: string): string;
  /** Rebase the pull request into the base branch. Already merged is success. */
  merge(pull: string): void;
};

export type FileSource = {
  exists(rel: string): boolean;
  read(rel: string): string;
  /** Paths relative to the repo root. Empty when nothing is there. */
  list(rel: string): string[];
};

export type Vcs = {
  filesAt(key: IssueKey): FileSource;
  /**
   * Commits on `base..head` and the three-dot diff.
   * A missing object is a failed range, not an empty diff.
   */
  compare(base: string, head: string): {commits: string; diff: string} | null;
  /** Push the issue branch `sdd/<key>` and set its upstream. */
  push(key: IssueKey): void;
  /** HEAD of the checkout this adapter was opened on. */
  head(): string;
};

export type SkillRun = {
  skill: string;
  action: string;
  key: IssueKey;
  phase: string;
  pull: string;
};

/** What one skill run changed. Zero commits leaves the issue idle. */
export type SkillOutcome = {
  commits: number;
};

/** One prompt, one answer. The runtime owns the sandbox, the model, and the base branch. */
export type RuntimeAsk = {
  name: string;
  mode: SkillMode;
  promptFile: string;
  promptArgs: Record<string, string>;
  /** Worktree branch, cut from the runtime's base branch. */
  branch: string;
  /** The answer is the text inside this tag. */
  outputTag: string;
};

export type Runtime = {
  run(skill: SkillRun): Promise<SkillOutcome>;
  ask(request: RuntimeAsk): Promise<string>;
};
