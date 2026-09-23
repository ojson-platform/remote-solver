import {annotate} from '../adapters/actions.ts';
import type {Machine} from '../adapters/compose.ts';
import {passReview, type Judge} from './act.ts';
import {sandcastleJudge} from './judge.ts';
import {describe, describeQueue, reviewQueue} from './plan.ts';

export type {Judge};

/**
 * One pass over open issues. A judge passed in replaces the machine runtime.
 * The command does not pass one.
 */
/** `1` when a ready issue stayed unjudged. Wait, skip, clean, and remarks stay `0`. */
export async function runReview(box: Machine, judge?: Judge): Promise<number> {
  const chosen = judge ?? (dossier => sandcastleJudge(box.runtime, dossier));
  const items = reviewQueue(box.tracker.listOpen(), key => box.review.pulls(key));
  if (items.length === 0) {
    console.log(describeQueue(items)[0]);
    return 0;
  }
  let code = 0;
  for (const item of items) {
    if (item.kind !== 'ready') {
      console.log(describe(item));
      continue;
    }
    const result = await passReview({review: box.review, vcs: box.vcs, judge: chosen}, item);
    console.log(describe(item, result));
    if (result.action === 'unjudged') {
      annotate('error', `#${item.issue} unjudged`, result.reason);
      code = 1;
    }
    if (result.action === 'remarks') {
      for (const remark of result.items) {
        annotate('error', `#${item.issue} remark`, remark.body);
      }
    }
    if (result.action === 'wait') {
      annotate('warning', `#${item.issue} wait`, result.reason);
    }
  }
  return code;
}
