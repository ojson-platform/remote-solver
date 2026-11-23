/**
 * What a decision reason says. Page, plaque, focus, and the several-pull hold
 * read this. They do not match the sentence themselves.
 */

/** Specify and later phases stop here. Plan still opens the pull request. */
export const NO_OPEN_PULL = 'no open pull request';

const SEVERAL_OPEN = 'cycle stopped until one open PR remains';
const WAIT_MERGE = 'wait for merge of PR #';
const WAIT_GREEN = 'wait for green checks before merge of PR #';
/** Accepting has no merged pull request to close on. */
export const NEEDS_MERGED = 'accepted needs a merged pull request';
const WAIT_CHILDREN = 'wait for children';
const WAIT_BLOCKERS = 'wait for blockers';
const WAIT_HUMAN = 'sdd:wait-human is set';
const SERVICE = 'service is ';
const CHECKS = 'checks are ';
const NO_TASK = 'no task for ';
const NO_CARD = 'no card for ';
const CARD_REVISION = 'the delta revision is not the card';
const PUBLISH_PROPOSAL = 'publish proposal';
const ARCHIVE_REFUSED = 'archive refused:';
const ARCHIVE_TAIL = 'archive refused: ';
const EMPTY_BASELINE = 'the rebuilt spec would have no requirement';
const EMPTY_BASELINE_COLON = 'the rebuilt spec would have no requirement:';
const REFUSED = 'refused ';
const REFUSED_ARCHIVE = 'refused archive:';

export type ReasonKind =
  | 'green-merge'
  | 'merge-wait'
  | 'children'
  | 'blockers'
  | 'several-pulls'
  | 'wait-human'
  | 'wrong-service'
  | 'checks-running'
  | 'no-task'
  | 'no-card'
  | 'card-revision'
  | 'publish-proposal'
  | 'archive-refused'
  | 'empty-baseline'
  | 'refused'
  | 'no-open-pull'
  | 'too-many'
  | 'missing-proposal'
  | 'missing-delta'
  | 'missing-design'
  | 'missing-tasks'
  | 'sent-back'
  | 'conflict'
  | 'return-delta'
  | 'enter-cycle'
  | 'not-archived'
  | 'needs-merged'
  | 'cancelled'
  | 'proposal-stamp'
  | 'rebase'
  | 'other';

export type ReasonRead = {
  kind: ReasonKind;
  /** First `#` followed by digits. */
  issue: string | undefined;
  /** Every such id, the first time it appears. */
  issues: string[];
  /** Digits in the first `merge of PR #`. The page uses this for a merge wait. */
  mergePull: string | undefined;
  /** Digits when the reason begins with the merge wait. The tail uses this. */
  anchoredMerge: string | undefined;
  /** Ids after the colon of a several-pull stop. Empty when that is not the reason. */
  pullIds: string[];
  /**
   * Trimmed text after `archive refused: `. Absent when the reason does not
   * have that space. An empty string is the prefix with nothing after it.
   */
  archiveTail: string | undefined;
  /** The action named by `refused <action>:`. */
  action: string | undefined;
  questions: boolean;
  decisions: boolean;
  /** `specified` appears. A child wait prefers this to `accepted`. */
  specified: boolean;
  accepted: boolean;
  /** Names a merge, an archive, or a finished cycle, so several open pulls replace the wait. */
  holdExit: boolean;
  /** The card sentence is the stamp mismatch and nothing after it. */
  cardExact: boolean;
  refusedArchive: boolean;
  archiveMark: boolean;
  baselineMark: boolean;
  /** The colon form: the page shows the whole reason. */
  baselineColon: boolean;
  refusedMark: boolean;
};

const TASKS_GAP = new Set<ReasonKind>(['missing-tasks', 'card-revision', 'no-card', 'no-task']);

/** Missing tasks, a stale card, a missing card, or a scenario with no task. */
export function tasksGap(read: ReasonRead): boolean {
  return TASKS_GAP.has(read.kind);
}

function issueKeys(reason: string): string[] {
  const keys: string[] = [];
  for (const match of reason.matchAll(/#(\d+)/g)) {
    const key = match[1];
    if (key !== undefined && !keys.includes(key)) {
      keys.push(key);
    }
  }
  return keys;
}

function pullIds(reason: string): string[] {
  if (!reason.startsWith(SEVERAL_OPEN)) {
    return [];
  }
  return (reason.split(':')[1] ?? '')
    .split(',')
    .map(id => id.trim().replace(/^#/, ''))
    .filter(id => id !== '');
}

function kindOf(reason: string): ReasonKind {
  if (reason.startsWith(WAIT_GREEN)) {
    return 'green-merge';
  }
  if (reason.startsWith(WAIT_MERGE)) {
    return 'merge-wait';
  }
  if (reason.startsWith(WAIT_CHILDREN)) {
    return 'children';
  }
  if (reason.startsWith(WAIT_BLOCKERS)) {
    return 'blockers';
  }
  if (reason.startsWith(SEVERAL_OPEN)) {
    return 'several-pulls';
  }
  if (reason.startsWith(WAIT_HUMAN)) {
    return 'wait-human';
  }
  if (reason.startsWith(SERVICE)) {
    return 'wrong-service';
  }
  if (reason.startsWith(CHECKS) && reason !== 'checks are red' && reason !== 'checks are green') {
    return 'checks-running';
  }
  if (reason.startsWith(NO_TASK)) {
    return 'no-task';
  }
  if (reason.startsWith(NO_CARD)) {
    return 'no-card';
  }
  if (reason.startsWith(CARD_REVISION)) {
    return 'card-revision';
  }
  if (reason.startsWith(PUBLISH_PROPOSAL)) {
    return 'publish-proposal';
  }
  if (reason.startsWith(ARCHIVE_REFUSED)) {
    return 'archive-refused';
  }
  if (reason.startsWith(EMPTY_BASELINE)) {
    return 'empty-baseline';
  }
  if (reason.startsWith(REFUSED)) {
    return 'refused';
  }
  switch (reason) {
    case NO_OPEN_PULL:
      return 'no-open-pull';
    case 'Too many mechanical transitions':
      return 'too-many';
    case 'proposal.md is missing':
      return 'missing-proposal';
    case 'delta spec is missing':
      return 'missing-delta';
    case 'design.md is missing':
      return 'missing-design';
    case 'tasks.md is missing':
      return 'missing-tasks';
    case 'review thread sent the change back':
      return 'sent-back';
    case 'pull request conflicts with the base':
      return 'conflict';
    case 'return the delta to the change':
      return 'return-delta';
    case 'enter the cycle':
      return 'enter-cycle';
    case 'the change is not archived':
      return 'not-archived';
    case NEEDS_MERGED:
      return 'needs-merged';
    case 'cancelled':
      return 'cancelled';
    case 'the proposal revision is not the stamp':
      return 'proposal-stamp';
    case 'rebase onto the base':
      return 'rebase';
    default:
      return 'other';
  }
}

/** Several open pull requests stop the cycle before any step, until a person leaves one. */
export function severalOpenReason(ids: string[]): string {
  return `${SEVERAL_OPEN}: ${ids.join(', ')}`;
}

/** A merge the person still has to send. */
export function mergeWaitReason(id: string): string {
  return `${WAIT_MERGE}${id}`;
}

/** Green checks still outstanding before that merge. */
export function greenMergeReason(id: string): string {
  return `${WAIT_GREEN}${id}`;
}

/** The reason, read once. Callers branch on `kind` and the flags. */
export function readReason(reason: string): ReasonRead {
  const issues = issueKeys(reason);
  return {
    kind: kindOf(reason),
    issue: issues[0],
    issues,
    mergePull: /merge of PR #(\d+)/.exec(reason)?.[1],
    anchoredMerge: new RegExp(`^${WAIT_MERGE}(\\d+)`).exec(reason)?.[1],
    pullIds: pullIds(reason),
    archiveTail: reason.startsWith(ARCHIVE_TAIL) ? reason.slice(ARCHIVE_TAIL.length).trim() : undefined,
    action: /^refused ([a-z-]+):/.exec(reason)?.[1],
    questions: reason.includes('Open questions'),
    decisions: reason.includes('open decision'),
    specified: reason.includes('specified'),
    accepted: reason.includes('accepted'),
    holdExit: /merge|archiv|finished/i.test(reason),
    cardExact: reason === CARD_REVISION,
    refusedArchive: reason.startsWith(REFUSED_ARCHIVE),
    archiveMark: reason.startsWith(ARCHIVE_REFUSED),
    baselineMark: reason.startsWith(EMPTY_BASELINE),
    baselineColon: reason.startsWith(EMPTY_BASELINE_COLON),
    refusedMark: reason.startsWith(REFUSED),
  };
}
