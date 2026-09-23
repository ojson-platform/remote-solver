import type {Machine} from '../adapters/compose.ts';
import {passReview, type Judge} from './act.ts';
import {sandcastleJudge} from './judge.ts';
import {describe, describeQueue, reviewQueue} from './plan.ts';

export type {Judge};

/**
 * One pass over open issues. A judge passed in replaces the machine runtime.
 * The command does not pass one.
 */
export async function runReview(box: Machine, judge?: Judge): Promise<void> {
  const login = box.tracker.login();
  if (login.endsWith('[bot]')) {
    console.log('reviewer login is a bot');
    return;
  }
  const chosen = judge ?? (dossier => sandcastleJudge(box.runtime, dossier));
  const items = reviewQueue(box.tracker.listOpen(), key => box.review.pulls(key));
  if (items.length === 0) {
    console.log(describeQueue(items)[0]);
    return;
  }
  for (const item of items) {
    if (item.kind !== 'ready') {
      console.log(describe(item));
      continue;
    }
    const result = await passReview({login, review: box.review, vcs: box.vcs, judge: chosen}, item);
    console.log(describe(item, result));
  }
}
