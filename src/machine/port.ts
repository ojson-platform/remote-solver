/**
 * Ports the machine needs. Adapters live elsewhere: GitHub issues, GitHub pull
 * requests, git, sandcastle — and, later, Tracker, Arcanum, arc, another runtime.
 * Marker grammar stays above these seams.
 */

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
  reviewCheck: CheckState;
};

/** A review thread after the adapter has decided whether the machine wrote it. */
export type Thread = {resolved: boolean; body: string};

/** A conversation comment. `robot` is the machine's login or a bot. */
export type Conversation = {body: string; robot: boolean};

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

export type Runtime = {
  run(skill: SkillRun): Promise<SkillOutcome>;
};
