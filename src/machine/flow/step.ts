import type {ChangeView} from '../change/change.ts';
import type {Decision, PullSnapshot} from '../decide/policy.ts';
import type {FileSource, IssueRecord, Openspec, Review, Tracker} from '../port.ts';
import type {QueueConfig} from '../spy/service-config.ts';

import {readChange} from '../change/change.ts';
import {addedDiffLine, changedInDiff, foldChange, restoreChange} from '../change/fold.ts';
import {cycleRecord, decide, effectSignature, postRefusal, refusalBody} from '../decide/policy.ts';
import {gateAsk, openWait} from '../phase/labels.ts';
import {labelsAfterAdvance} from '../phase/phase.ts';
import {queueOf} from '../spy/queues.ts';
import {sameService} from '../spy/service-config.ts';
import {ownCycle, pullSnapshots} from '../spy/snapshot.ts';

/** A fold that would publish a spec with no requirement. The reason names that spec. */
export function emptyBaselineWait(text: string, capabilities: readonly string[]): string | null {
  if (!/at least one requirement|no requirement/i.test(text)) {
    return null;
  }
  const named =
    text.match(/openspec\/specs\/[A-Za-z0-9._/-]+\/spec\.md/)?.[0] ??
    (capabilities[0]
      ? `openspec/specs/${capabilities[0]}/spec.md`
      : 'openspec/specs/<capability>/spec.md');
  return `the rebuilt spec would have no requirement: ${named}`;
}
export async function applyLabels(
  tracker: Tracker,
  key: string,
  before: string[],
  after: string[],
): Promise<void> {
  const add = after.filter(label => !before.includes(label));
  const remove = before.filter(label => !after.includes(label));
  if (add.length || remove.length) {
    await tracker.editLabels(key, add, remove);
  }
}

async function closeIssue(tracker: Tracker, key: string, sentence: string): Promise<void> {
  await tracker.close(key, sentence);
}

type IssueRead = {
  tracker: Tracker;
  review?: Review;
  files: FileSource;
  queues: QueueConfig[];
  change?: ChangeView;
  /** Tip message. When set, the archive directory is not the folded bit. */
  tip?: string;
  pulls?: PullSnapshot[];
  issues?: IssueRecord[];
  /** Perform merge, archive, and unarchive, then read the issue again. */
  perform?: boolean;
  checkout?: () => Promise<string>;
  readTip?: () => Promise<string | undefined>;
  /** Replaces the archive command. Tests use this; the poll uses `foldChange`. */
  fold?: (root: string, key: string) => void;
  restore?: (root: string, key: string) => void;
  /** The OpenSpec binary. The poll supplies the adapter; a replaced `fold` does not need it. */
  openspec?: Openspec;
  /** This checkout. A foreign `service` waits before any label write. */
  root?: string;
  /** When set, a cycle reaches the decision only when this login holds it. */
  login?: string;
};

/** The service field names another directory. The verb and the poll share this wait. */
export function serviceWait(
  root: string,
  record: {key: string; service?: string},
): Decision | null {
  const declared = (record.service ?? '').trim();
  if (declared !== '' && !sameService(root, declared)) {
    return {kind: 'wait', issue: record.key, reason: `service is ${declared}`};
  }
  return null;
}

function nextLabels(before: string[], decision: Decision): string[] {
  let labels = before;
  if (decision.drop?.length) {
    const dropping = new Set(decision.drop);
    labels = labels.filter(name => !dropping.has(name));
  }
  if (decision.kind === 'advance') {
    return labelsAfterAdvance(labels, decision.to);
  }
  if (decision.stay && !labels.includes(`sdd:${decision.stay}`)) {
    return [...labels, `sdd:${decision.stay}`];
  }
  return labels;
}

type WalkCache = {
  change: ChangeView | undefined;
  tip: string | undefined;
  pulls: PullSnapshot[] | undefined;
};

type StepResult = {stop: Decision} | {again: WalkCache};

function cycleRecordOf(
  open: IssueRecord[],
  key: string,
  options: IssueRead,
): IssueRecord | undefined {
  return open.find(issue => {
    if (issue.key !== key) {
      return false;
    }
    if (options.login !== undefined) {
      return ownCycle(issue, options.login, options.queues);
    }
    return (
      queueOf(issue.labels, options.queues) !== undefined && issue.labels.includes('sdd:cycle')
    );
  });
}

/** A forward move has no page of its own. A return stops the walk so the window can show it. */
export function pauseAdvance(reason: string): boolean {
  if (reason.includes('→') || reason.startsWith('sdd:auto-')) {
    return false;
  }
  return reason !== 'tasks exist' && reason !== 'no open tasks' && reason !== 'checks are green';
}

/** Advance keeps walking when the move has no page. Accepted and a finished cycle close the issue and stop. */
async function writeAdvance(
  key: string,
  options: IssueRead,
  decision: Extract<Decision, {kind: 'advance' | 'done'}>,
): Promise<StepResult | null> {
  if (decision.kind === 'advance') {
    if (decision.comment) {
      await options.tracker.comment(key, decision.comment);
    }
    if (decision.to === 'accepted') {
      await closeIssue(
        options.tracker,
        key,
        'SDLC accepted: the pull request is merged and the baseline is in trunk.',
      );
      return {stop: {kind: 'done', issue: key, reason: decision.reason}};
    }
    return null;
  }
  if (decision.reason === 'finished cycle') {
    await closeIssue(
      options.tracker,
      key,
      'SDLC finished: the pull request is merged and the change is archived.',
    );
    return {stop: decision};
  }
  return {stop: decision};
}

/** Merge, archive, and unarchive drop the cached read so the next step sees the new tip. */
async function performEffect(
  key: string,
  options: IssueRead,
  decision: Decision,
  view: ChangeView,
  cache: WalkCache,
  pulls: PullSnapshot[],
): Promise<StepResult> {
  if (decision.kind === 'merge') {
    if (!options.review) {
      return {stop: decision};
    }
    await options.review.merge(decision.pull);
    return {again: await reread(options, cache)};
  }
  if ((decision.kind === 'archive' || decision.kind === 'unarchive') && options.checkout) {
    const folded = await foldEffect(key, options, decision, view, pulls);
    if ('stop' in folded) {
      return folded;
    }
    if (folded.wrote && decision.kind === 'unarchive') {
      return {stop: decision};
    }
    if (folded.wrote) {
      return {again: await reread(options, cache)};
    }
  }
  return {stop: decision};
}

async function reread(options: IssueRead, cache: WalkCache): Promise<WalkCache> {
  return {
    change: undefined,
    pulls: undefined,
    tip: options.readTip ? await options.readTip() : cache.tip,
  };
}

/** Capability ids named by `spec/<capability>` before the command's rule text. */
function refusedSpecIds(text: string): string[] {
  const head = text.split(':')[0] ?? '';
  return [...head.matchAll(/spec\/([A-Za-z0-9._/-]+)/g)]
    .map(match => match[1])
    .filter((id): id is string => Boolean(id));
}

/** A thread already quoted this command, open or resolved. */
function commandAlreadyThreaded(pulls: readonly PullSnapshot[], pull: string, command: string): boolean {
  const snapshot = pulls.find(item => item.id === pull);
  for (const thread of snapshot?.reading?.threads ?? []) {
    const bodies = thread.comments ?? [thread.body];
    if (bodies.some(body => body.includes(command))) {
      return true;
    }
  }
  return false;
}

/** Open the spec thread. False when the diff has no line to anchor, or the review port refuses. */
async function openSpecThread(
  key: string,
  dir: string,
  pull: string,
  capability: string,
  command: string,
  review: NonNullable<IssueRead['review']>,
): Promise<boolean> {
  const range = await review.range(pull);
  const specPath = `openspec/changes/issue-${key}/specs/${capability}/spec.md`;
  const line = addedDiffLine(dir, range.base ?? '', range.head, specPath);
  if (line === null || range.head === '') {
    return false;
  }
  try {
    await review.openThread(pull, {
      commit: range.head,
      path: specPath,
      line,
      side: 'right',
      body: `sdd:layer=spec → specifying\n${command}`,
    });
  } catch {
    return false;
  }
  return true;
}

async function foldEffect(
  key: string,
  options: IssueRead,
  decision: Extract<Decision, {kind: 'archive' | 'unarchive'}>,
  view: ChangeView,
  pulls: PullSnapshot[],
): Promise<{stop: Decision} | {wrote: true}> {
  const dir = await options.checkout?.();
  if (!dir) {
    return {stop: decision};
  }
  try {
    if (decision.kind === 'archive') {
      if (options.fold) {
        options.fold(dir, key);
      } else if (options.openspec) {
        foldChange(dir, key, options.openspec());
      } else {
        throw new Error('openspec executable is missing');
      }
    } else {
      (options.restore ?? restoreChange)(dir, key);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'fold failed';
    const baseline = emptyBaselineWait(reason, view.capabilities);
    if (baseline) {
      return {stop: {kind: 'wait', issue: key, reason: baseline}};
    }
    const shown = `archive refused: ${reason}`;
    if (decision.kind === 'archive' && options.review) {
      const range = await options.review.range(decision.pr);
      const capability = refusedSpecIds(reason).find(id =>
        changedInDiff(
          dir,
          range.base ?? '',
          range.head,
          `openspec/changes/issue-${key}/specs/${id}/spec.md`,
        ),
      );
      const repeated = capability !== undefined && commandAlreadyThreaded(pulls, decision.pr, reason);
      if (capability && !repeated) {
        const opened = await openSpecThread(
          key,
          dir,
          decision.pr,
          capability,
          reason,
          options.review,
        );
        if (opened) {
          return {stop: {kind: 'wait', issue: key, reason: shown}};
        }
      }
    }
    const signature = effectSignature({
      phase: decision.phase,
      action: decision.kind,
      reason: decision.reason,
    });
    await postRefusal(options.tracker, key, `${refusalBody(signature)}\n${shown}`);
    return {stop: {kind: 'wait', issue: key, reason: shown}};
  }
  return {wrote: true};
}

/** Read the issue, write the label move, then either stop or ask for another step. */
async function stepIssue(key: string, options: IssueRead, cache: WalkCache): Promise<StepResult> {
  const open = await options.tracker.listOpen();
  const record = cycleRecordOf(open, key, options);
  if (!record) {
    return {stop: {kind: 'done', issue: key, reason: 'not in the open cycle'}};
  }
  if (options.root) {
    const foreign = serviceWait(options.root, record);
    if (foreign) {
      return {stop: foreign};
    }
  }
  const view = cache.change ?? readChange(key, options.files);
  const loaded =
    cache.pulls ?? (options.review ? await pullSnapshots(options.review, key, options.files) : []);
  const notes = await options.tracker.comments(key);
  const others = (options.issues ?? open).map(issue => (issue.key === key ? record : issue));
  const decision = decide(
    record,
    others,
    loaded,
    view,
    cycleRecord(record, cache.tip ?? '', notes),
  );
  await applyLabels(options.tracker, key, record.labels, nextLabels(record.labels, decision));
  if (decision.kind === 'advance' || decision.kind === 'done') {
    const closed = await writeAdvance(key, options, decision);
    if (closed) {
      return closed;
    }
    if (decision.kind === 'advance' && pauseAdvance(decision.reason)) {
      return {stop: decision};
    }
    return {again: cache};
  }
  if (decision.kind === 'wait' && decision.gate && !record.labels.includes('sdd:wait-human')) {
    await openWait(key, gateAsk(key, decision.gate, options.tracker), options.tracker);
    return {stop: decision};
  }
  if (!options.perform) {
    return {stop: decision};
  }
  return performEffect(key, options, decision, view, cache, loaded);
}

/** One effect, written, then the issue is read again. Twelve effects is the stop. */
export async function walk(key: string, options: IssueRead): Promise<Decision> {
  let cache: WalkCache = {change: options.change, tip: options.tip, pulls: options.pulls};
  for (let step = 0; step < 12; step += 1) {
    const result = await stepIssue(key, options, cache);
    if ('stop' in result) {
      return result.stop;
    }
    cache = result.again;
  }
  return {kind: 'wait', issue: key, reason: 'Too many mechanical transitions'};
}
