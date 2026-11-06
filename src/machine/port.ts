/**
 * Ports the machine needs. Adapters live elsewhere: GitHub issues, GitHub pull
 * requests, git, sandcastle — and, later, Tracker, Arcanum, arc, another runtime.
 * Marker grammar stays above these seams.
 */

import type {Phase} from './phase.ts';
import type {SkillMode} from './skill.ts';

export type IssueKey = string;

export type IssueRecord = {
  key: IssueKey;
  title: string;
  body: string;
  state: string;
  labels: string[];
  /** Login of the assignee. Empty when the issue is unassigned. */
  assignee?: string;
  /**
   * Directory of the service, relative to the repository root or absolute.
   * Empty when the chat's directory is the service.
   */
  service?: string;
  /**
   * Cycle hook field the port already returned.
   * Absent when the port did not. The machine does not create the field.
   */
  sddHooks?: unknown;
  parent?: IssueKey;
  dependsOn: IssueKey[];
  blockedBy: IssueKey[];
  blocks: IssueKey[];
};

export type IssueLinkKind = 'parent' | 'blocks' | 'blocked-by' | 'depends-on';

export type CheckState = 'green' | 'red' | 'pending' | 'none';

export type Pull = {
  id: string;
  title: string;
  state: string;
  checks: CheckState;
  /** The head does not apply onto the base. Absent when the host did not say. */
  conflict?: boolean;
};

/** A review thread after the adapter has decided whether the machine wrote it. */
export type Thread = {resolved: boolean; body: string};

/**
 * The same thread with the handles a skill needs to answer it: the thread id
 * for `thread resolve`, the latest comment id for `thread reply`, and where it sits.
 */
export type ThreadRecord = Thread & {
  id: string;
  comment: string;
  path: string;
  line: number | null;
  /** Every comment body in host order. Omitted only on older memory seeds without a list. */
  comments?: string[];
};

/** A conversation comment. `robot` is a spy mark or an ignored commenter. */
export type Conversation = {body: string; robot: boolean};

/** One remark. `path` and `line` are set only when they sit on the pull request diff. */
export type ReviewNote = {body: string; path?: string; line?: number};

export type Tracker = {
  login(): Promise<string>;
  listOpen(): Promise<IssueRecord[]>;
  issue(key: IssueKey): Promise<IssueRecord>;
  /** Give the issue to this login, replacing whoever holds it. */
  assign(key: IssueKey, login: string): Promise<void>;
  labels(key: IssueKey): Promise<string[]>;
  editLabels(key: IssueKey, add: string[], remove: string[]): Promise<void>;
  updateBody(key: IssueKey, body: string): Promise<void>;
  comment(key: IssueKey, body: string): Promise<void>;
  /** Issue comments in order. A manager comment is not an `sdd:focus` record. */
  comments(key: IssueKey): Promise<{body: string; manager?: boolean}[]>;
  close(key: IssueKey, comment: string): Promise<void>;
  /** Write one host issue link. Does not change the body. */
  link(key: IssueKey, kind: IssueLinkKind, other: IssueKey): Promise<void>;
  /** How a person moves the phase in this tracker. Pure: no tracker call. */
  phaseHint(from: Phase, to: Phase): string;
};

export type ThreadTarget = {
  commit: string;
  path: string;
  /** Omit for a file-level review thread (GitHub `subject_type: file`). */
  line?: number;
  body: string;
  side?: 'right' | 'left';
  plain?: boolean;
  /** When set, the host opens a thread on the file without a line anchor. */
  subject_type?: 'file';
};

export type Review = {
  pulls(key: IssueKey): Promise<Pull[]>;
  threads(pull: string): Promise<Thread[]>;
  /** The threads with their handles. What `sdd threads` prints for a skill. */
  threadList(pull: string): Promise<ThreadRecord[]>;
  comments(pull: string): Promise<Conversation[]>;
  /**
   * The open pull request, or a new one. Several open pull requests are the
   * machine's stop, applied before this is called.
   */
  ensurePull(key: IssueKey, title: string, body: string): Promise<string>;
  openThread(pull: string, target: ThreadTarget): Promise<void>;
  reply(pull: string, comment: string, body: string): Promise<void>;
  /** Issue comment on the pull request. The adapter adds the spy mark. */
  say(pull: string, body: string): Promise<void>;
  /** Issue comment on the pull request. The body is posted unchanged. */
  speak(pull: string, body: string): Promise<void>;
  /**
   * One published review that requests changes. A note with a file becomes a
   * thread on that file or line. Notes without a file stay in the review body.
   */
  flag(pull: string, head: string, notes: ReviewNote[]): Promise<void>;
  /** Head and base commits of an open pull request. */
  range(pull: string): Promise<{head: string; base: string | null}>;
  resolveThread(thread: string): Promise<void>;
  /** Text the agent reads: check names, conclusions, logs. */
  checksText(pull: string): Promise<string>;
  /** Rebase the pull request into the base branch. Already merged is success. */
  merge(pull: string): Promise<void>;
};

export type FileSource = {
  exists(rel: string): boolean;
  read(rel: string): string;
  /** Paths relative to the repo root. Empty when nothing is there. */
  list(rel: string): string[];
  /** True when this read failed and the bytes are not the branch. */
  failed?: () => boolean;
};

/** A path in this package, linked as `.sandcastle/<to>` inside a checkout. */
export type Link = {from: string; to: string};

export type Vcs = {
  /** Checkout of `sdd/<key>`. Reuses a worktree that already has the branch, and creates one when missing. */
  prepare(key: IssueKey, options: {worktreesDir: string; links: Link[]}): Promise<string>;
  /** Tip of the local issue branch. Throws when the branch does not exist. */
  tip(key: IssueKey): Promise<string>;
  /** Files of the issue branch. Reading them is local and stays synchronous. */
  filesAt(key: IssueKey): FileSource;
  /**
   * Files the plaque and the spine read.
   * The parent of the tip when that tip is this issue's archive commit.
   * Absent on an adapter that has no git checkout.
   */
  contentAt?(key: IssueKey): FileSource;
  /**
   * Commit a pull-request diff ends at.
   * The parent when `head` is this issue's archive commit. Otherwise `head`.
   */
  contentCommit?(key: IssueKey, head: string): Promise<string>;
  /**
   * Commits on `base..head` and the three-dot diff.
   * A missing object is a failed range, not an empty diff.
   */
  compare(base: string, head: string): Promise<{commits: string; diff: string} | null>;
  /** Whether `base...head` has any diff text. Absent when the adapter only offers `compare`. */
  changed?(base: string, head: string): Promise<boolean>;
  /** Push the issue branch `sdd/<key>` and set its upstream. */
  push(key: IssueKey): Promise<void>;
  /** HEAD of the checkout this adapter was opened on. */
  head(): Promise<string>;
  /** `commit` is the tip of the remote issue branch `sdd/<key>`, or behind it. */
  published(key: IssueKey, commit: string): Promise<boolean>;
  /** Paths `git status` reports in this checkout: changed, staged, or untracked. Empty on a clean tree. */
  dirty(): Promise<string[]>;
};

/** The commit a pull-request diff ends at. The parent when `head` is this issue's archive commit. */
export async function diffEnd(
  vcs: Pick<Vcs, 'contentCommit'>,
  key: IssueKey,
  head: string,
): Promise<string> {
  return vcs.contentCommit ? await vcs.contentCommit(key, head) : head;
}

/** Files the plaque and the spine read. The tip when the adapter has no content tree. */
export function contentFiles(vcs: Pick<Vcs, 'contentAt' | 'filesAt'>, key: IssueKey): FileSource {
  return vcs.contentAt?.(key) ?? vcs.filesAt(key);
}

export type AgentUsage = {
  inputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  outputTokens: number;
};

/** Text the agent wrote, plus the session it left when the provider records one. */
export type AgentResult = {
  text: string;
  sessionId?: string;
  sessionFilePath?: string;
  usage?: AgentUsage;
};

export type SkillRun = {
  skill: string;
  action: string;
  key: IssueKey;
  phase: string;
  pull: string;
  mode: SkillMode;
  resumeSession?: string;
  /** `phase`, `action`, and `reason`. A retry resumes only this decision's chat. */
  signature?: string;
  /** Directory of the service. The step reads hooks there. Empty means the worktree root. */
  service?: string;
  /** Cycle hook field. The machine does not create it. */
  sddHooks?: unknown;
  /** Title and body already on the issue. The prompt carries them. */
  issue?: {title: string; body: string};
};

/** What one skill run changed. Zero commits leaves the issue idle. */
export type SkillOutcome = {
  commits: number;
  sessionId?: string;
  usage?: AgentUsage;
  /** Set when the run ended in Wait or Hand-off and made no commit. A commit is Publish. */
  signal?: 'Wait' | 'Hand-off' | null;
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
  /** Continue this chat. The prompt is the next turn. */
  resumeSession?: string;
  /** When set, this text is the whole prompt. The prompt file is not read. */
  prompt?: string;
};

export type Runtime = {
  run(skill: SkillRun): Promise<SkillOutcome>;
  ask(request: RuntimeAsk): Promise<AgentResult>;
};
