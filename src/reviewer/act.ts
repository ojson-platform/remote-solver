import {reviewOf} from '../machine/review.ts';
import type {CheckState, Conversation, Review, Thread, Vcs} from '../machine/port.ts';
import {placeOnDiff} from './place.ts';
import {assembleDossier, type Dossier} from './dossier.ts';
import type {Remark, Verdict} from './verdict.ts';

export type Judge = (dossier: Dossier) => Promise<Verdict> | Verdict;

export type ReviewPass =
  | {action: 'wait'; reason: string}
  | {action: 'unjudged'; reason: string}
  | {action: 'clean'}
  | {action: 'remarks'; items: Remark[]};

export function reviewedNote(head: string): string {
  return `sdd:note reviewed ${head}`;
}

export function reviewStep(input: {
  checks: CheckState;
  threads: Thread[];
  comments: Conversation[];
  head: string;
}): {kind: 'wait'; reason: string} | {kind: 'merge'} | {kind: 'judge'} {
  if (input.checks !== 'green') {
    return {kind: 'wait', reason: `checks are ${input.checks}`};
  }
  const view = reviewOf(input.threads, input.comments);
  if (view.unanswered) {
    return {kind: 'wait', reason: 'unanswered comment'};
  }
  if (view.layers.length > 0) {
    return {kind: 'wait', reason: 'open layer'};
  }
  if (!input.head) {
    return {kind: 'wait', reason: 'head does not resolve'};
  }
  const note = reviewedNote(input.head);
  if (input.comments.some(comment => comment.body.includes(note))) {
    return {kind: 'merge'};
  }
  return {kind: 'judge'};
}

/** Remarks that are posted. Blank lines are dropped. */
export function spokenRemarks(items: Remark[]): Remark[] {
  return items
    .map(item => ({...item, body: item.body.trim()}))
    .filter(item => item.body.length > 0);
}

/** `unjudged` posts nothing. A clean verdict notes the head, then merges. Remarks are one review. */
export function applyReview(
  verdict: Verdict,
  pull: string,
  head: string,
  review: Pick<Review, 'say' | 'flag' | 'merge'>,
): void {
  if (verdict.kind === 'unjudged') {
    return;
  }
  if (verdict.kind === 'clean') {
    review.say(pull, reviewedNote(head));
    review.merge(pull);
    return;
  }
  const notes = spokenRemarks(verdict.items);
  if (notes.length > 0) {
    review.flag(pull, head, notes);
  }
}

/**
 * One ready issue. The pass reads the pull request, the range, and the change
 * through the ports it was given.
 */
export async function passReview(
  deps: {login: string; review: Review; vcs: Vcs; judge: Judge},
  item: {issue: string; pull: string},
): Promise<ReviewPass> {
  if (deps.login.endsWith('[bot]')) {
    return {action: 'wait', reason: 'reviewer login is a bot'};
  }
  const pulls = deps.review.pulls(item.issue);
  const range = deps.review.range(item.pull);
  const step = reviewStep({
    checks: pulls.find(pull => pull.id === item.pull)?.checks ?? 'none',
    threads: deps.review.threads(item.pull),
    comments: deps.review.comments(item.pull),
    head: range.head,
  });
  if (step.kind === 'wait') {
    return {action: 'wait', reason: step.reason};
  }
  if (step.kind === 'merge') {
    deps.review.merge(item.pull);
    return {action: 'clean'};
  }
  const span = range.base ? deps.vcs.compare(range.base, range.head) : null;
  if (range.base && !span) {
    return {action: 'wait', reason: 'range does not resolve'};
  }
  const built = assembleDossier({
    issue: item.issue,
    pull: item.pull,
    head: range.head,
    base: span ? range.base : null,
    commits: span?.commits ?? '',
    diff: span?.diff ?? '',
    files: deps.vcs.filesAt(item.issue),
  });
  if (built.kind === 'wait') {
    return {action: 'wait', reason: built.reason};
  }
  const verdict = await deps.judge(built.dossier);
  const placed =
    verdict.kind === 'remarks'
      ? {kind: 'remarks' as const, items: verdict.items.map(item => placeOnDiff(span?.diff ?? '', item))}
      : verdict;
  applyReview(placed, item.pull, range.head, deps.review);
  if (placed.kind === 'remarks') {
    return {action: 'remarks', items: spokenRemarks(placed.items)};
  }
  if (placed.kind === 'clean') {
    return {action: 'clean'};
  }
  return {action: 'unjudged', reason: placed.reason};
}
