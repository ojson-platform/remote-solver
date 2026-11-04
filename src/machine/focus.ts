import {type FileSource, type Review, type Tracker, type Vcs} from './port.ts';

import {isFocusRecord, unmarkedLine} from './marker.ts';
import {changeDir} from './naming.ts';
import {markerOf} from './review.ts';

/** How a step run ended. A run with none leaves the record unchanged. */
export type Signal = 'Publish' | 'Wait' | 'Hand-off';

export type FocusComment = {body: string; manager?: boolean};

/** Layer names the legacy ledger reader still recognizes, in record order. */
export const FOCUS_LAYERS = ['Change', 'Plan', 'Specify', 'Design', 'Tasks', 'Code'] as const;

type StepDeps = {
  tracker: Pick<Tracker, 'comments' | 'comment'>;
  review: Pick<Review, 'pulls' | 'range' | 'threadList'>;
  vcs: Pick<Vcs, 'compare' | 'filesAt' | 'contentCommit'>;
};

function hasChangeDir(key: string, files: FileSource): boolean {
  const root = changeDir(key);
  return files.list(root).length > 0;
}

function canonical(body: string): string {
  const text = body.replace(/\s+$/, '');
  const split = text.indexOf('\n');
  const first = unmarkedLine(split === -1 ? text : text.slice(0, split));
  const rest = split === -1 ? '' : text.slice(split + 1).replace(/\s+$/, '');
  return rest === '' ? first : `${first}\n${rest}`;
}

function latestFocus(comments: readonly FocusComment[]): string | undefined {
  let body: string | undefined;
  for (const comment of comments) {
    if (comment.manager || !isFocusRecord(comment.body)) {
      continue;
    }
    body = comment.body;
  }
  return body;
}

function handedOff(body: string): boolean {
  const name = markerOf(body);
  return name !== null && name !== 'note' && name !== 'fixed' && name !== 'begin';
}

/** What a step run had already left on the issue and the pull request. */
export type RunMarks = {
  waiting: boolean;
  comments: number;
  threads: readonly string[];
  spoken: readonly string[];
};

/** Labels, comments, and layer markers already on the cycle. */
export async function runMarks(
  key: string,
  deps: {
    tracker: Pick<Tracker, 'labels' | 'comments'>;
    review: Pick<Review, 'pulls' | 'threadList' | 'comments'>;
  },
): Promise<RunMarks> {
  const labels = await deps.tracker.labels(key);
  const comments = await deps.tracker.comments(key);
  const open = (await deps.review.pulls(key)).filter(pull => pull.state === 'OPEN');
  const threads: string[] = [];
  const spoken: string[] = [];
  if (open.length === 1 && open[0]) {
    for (const thread of await deps.review.threadList(open[0].id)) {
      if (!thread.resolved && handedOff(thread.body)) {
        threads.push(thread.id);
      }
    }
    for (const comment of await deps.review.comments(open[0].id)) {
      if (handedOff(comment.body)) {
        spoken.push(comment.body);
      }
    }
  }
  return {waiting: labels.includes('sdd:wait-human'), comments: comments.length, threads, spoken};
}

/**
 * A commit is Publish. A new layer marker is Hand-off. A wait label gained in
 * the run, or a new comment while that label is on, is Wait. Nothing new is no signal.
 */
export function observedSignal(commits: number, before: RunMarks, after: RunMarks): Signal | null {
  if (commits > 0) {
    return 'Publish';
  }
  const knownThreads = new Set(before.threads);
  const knownSpoken = new Set(before.spoken);
  const handed =
    after.threads.some(id => !knownThreads.has(id)) ||
    after.spoken.some(body => !knownSpoken.has(body));
  if (handed) {
    return 'Hand-off';
  }
  const waited = after.waiting && (!before.waiting || after.comments > before.comments);
  if (waited) {
    return 'Wait';
  }
  return null;
}

/**
 * Post one focus comment through the tracker port. Skips when the change
 * directory is absent or the canonical body matches the latest focus comment.
 */
export async function postFocusComment(
  key: string,
  body: string,
  deps: {
    tracker: Pick<Tracker, 'comments' | 'comment'>;
    vcs: Pick<Vcs, 'filesAt'>;
  },
): Promise<boolean> {
  if (!hasChangeDir(key, deps.vcs.filesAt(key))) {
    return false;
  }
  const text = body.endsWith('\n') ? body : `${body}\n`;
  const latest = latestFocus(await deps.tracker.comments(key));
  if (latest !== undefined && canonical(latest) === canonical(text)) {
    return false;
  }
  await deps.tracker.comment(key, text);
  return true;
}

/** Prose after the marker line of a focus comment. */
export function focusProse(body: string): string | undefined {
  if (!isFocusRecord(body)) {
    return undefined;
  }
  const prose = body.split('\n').slice(1).join('\n').replace(/\s+$/, '');
  return prose === '' ? undefined : prose;
}

/** First sentence of focus prose through `.`, `!`, or `?`, or the first line when none appear. */
export function firstFocusSentence(body: string): string | undefined {
  const prose = focusProse(body);
  if (prose === undefined) {
    return undefined;
  }
  const flat = prose.replace(/\n+/g, ' ').trim();
  const match = flat.match(/^([\s\S]*?[.!?])(?:\s|$)/);
  if (match) {
    return match[1].trim();
  }
  const firstLine = prose.split('\n')[0]?.trim() ?? '';
  return firstLine === '' ? undefined : firstLine;
}

/** Step runs no longer append a layer ledger; phase skills write focus after Publish. */
export async function endStep(
  _key: string,
  _outcome: {commits: number; signal?: Signal | null},
  _deps: StepDeps,
): Promise<void> {}
