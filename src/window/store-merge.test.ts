import assert from 'node:assert/strict';
import {test} from 'vitest';

import {mergeReviewsPreservingLocal, mergeThreadIntoReview} from './store.ts';
import type {WindowReview} from './types.ts';

test('mergeReviewsPreservingLocal keeps a locally held thread when the spy map replaces the review', () => {
  const key = '1';
  const path = 'openspec/changes/issue-1/proposal.md';
  const prev = new Map([
    [
      key,
      mergeThreadIntoReview(undefined, {
        file: path,
        line: null,
        comments: ['held only'],
      }),
    ],
  ]);
  const incoming = new Map([
    [
      key,
      {
        threads: [
          {
            file: path,
            line: null,
            lines: ['from github'],
            comments: ['from github'],
          },
        ],
      } satisfies WindowReview,
    ],
  ]);
  const merged = mergeReviewsPreservingLocal(prev, incoming);
  const reading = merged.get(key);
  assert.ok(reading);
  const bodies = reading.threads.flatMap(t => [...(t.comments ?? t.lines)]);
  assert.ok(bodies.some(b => b.trim() === 'held only'));
  assert.ok(bodies.some(b => b.trim() === 'from github'));
});

test('mergeThreadIntoReview ignores a duplicate thread body on the same file and line bucket', () => {
  const path = 'openspec/changes/issue-1/proposal.md';
  const once = mergeThreadIntoReview(undefined, {
    file: path,
    line: null,
    comments: ['same'],
  });
  const twice = mergeThreadIntoReview(once, {
    file: path,
    line: null,
    comments: ['same'],
  });
  assert.equal(twice.threads.length, 1);
});
