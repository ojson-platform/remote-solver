import assert from 'node:assert/strict';
import {test} from 'node:test';

import {memoryPorts, type MemorySeed} from '../adapters/github.ts';
import type {FileSource, Vcs} from '../machine/port.ts';
import {applyReview, passReview, reviewStep} from './act.ts';
import {assembleDossier} from './dossier.ts';
import {parseVerdict} from './verdict.ts';

const head = 'abc123';
const files: FileSource = {exists: () => false, read: () => '', list: () => []};

function tree(entries: Record<string, string>): FileSource {
  return {
    exists: rel => rel in entries,
    read: rel => entries[rel] ?? '',
    list: rel => Object.keys(entries).filter(name => name.startsWith(`${rel}/`)),
  };
}

function surface(
  seed: MemorySeed,
  source: FileSource = files,
  span: {commits: string; diff: string} | null = null,
) {
  const memory = memoryPorts(seed);
  const vcs: Vcs = {
    filesAt: () => source,
    compare: () => span,
    push() {},
    head: () => '',
  };
  return {review: memory.review, calls: memory.calls, vcs};
}

const green = {
  pulls: {'11': [{id: '15', title: '#11', state: 'OPEN'}]},
  checks: {'15': {checks: 'green' as const}},
  ranges: {'15': {head, base: 'def'}},
};

test('an empty model answer is unjudged, and a forbidden remark is dropped', () => {
  assert.deepEqual(parseVerdict(''), {kind: 'unjudged'});
  assert.deepEqual(parseVerdict('clean'), {kind: 'clean'});
  assert.deepEqual(parseVerdict('remark: sdd:layer=code\nremark: Scenario TTL is missing'), {
    kind: 'remarks',
    items: ['Scenario TTL is missing'],
  });
});

test('a pull request with pending checks waits, and an open layer does not call the judge', async () => {
  const pending = reviewStep({checks: 'pending', threads: [], comments: [], head});
  assert.deepEqual(pending, {kind: 'wait', reason: 'checks are pending'});
  const unanswered = reviewStep({
    checks: 'green',
    threads: [],
    comments: [{robot: false, body: 'please rebase'}],
    head,
  });
  assert.deepEqual(unanswered, {kind: 'wait', reason: 'unanswered comment'});
  let called = 0;
  const box = surface({
    ...green,
    comments: {'15': [{robot: true, body: '🤖 sdd:layer=code → implementing'}]},
  });
  const passed = await passReview(
    {
      login: '3y3',
      review: box.review,
      vcs: box.vcs,
      judge: () => {
        called += 1;
        return {kind: 'clean'};
      },
    },
    {issue: '11', pull: '15'},
  );
  assert.deepEqual(passed, {action: 'wait', reason: 'open layer'});
  assert.equal(called, 0);
  assert.deepEqual(
    box.calls.filter(call => call.startsWith('merge') || call === 'say' || call === 'speak'),
    [],
  );
});

test('a reviewed head merges without the judge', async () => {
  const box = surface({
    ...green,
    comments: {'15': [{robot: true, body: `🤖 sdd:note reviewed ${head}`}]},
  });
  const passed = await passReview(
    {
      login: '3y3',
      review: box.review,
      vcs: box.vcs,
      judge: () => {
        throw new Error('judge');
      },
    },
    {issue: '11', pull: '15'},
  );
  assert.deepEqual(passed, {action: 'clean'});
  assert.ok(box.calls.includes('merge:15'));
  assert.equal(box.calls.includes('say'), false);
});

test('an empty head waits, and does not match a note for some other head', async () => {
  const box = surface({
    ...green,
    ranges: {'15': {head: '', base: 'def'}},
    comments: {'15': [{robot: true, body: `🤖 sdd:note reviewed ${head}`}]},
  });
  const passed = await passReview(
    {login: '3y3', review: box.review, vcs: box.vcs, judge: () => ({kind: 'clean'})},
    {issue: '11', pull: '15'},
  );
  assert.deepEqual(passed, {action: 'wait', reason: 'head does not resolve'});
  assert.equal(box.calls.includes('merge:15'), false);
});

test('a pull request with no base waits before the diff', async () => {
  let called = 0;
  const box = surface({...green, ranges: {'15': {head, base: null}}});
  const passed = await passReview(
    {
      login: '3y3',
      review: box.review,
      vcs: box.vcs,
      judge: () => {
        called += 1;
        return {kind: 'clean'};
      },
    },
    {issue: '11', pull: '15'},
  );
  assert.deepEqual(passed, {action: 'wait', reason: 'base does not resolve'});
  assert.equal(called, 0);
});

test('a missing git range waits and does not call the judge', async () => {
  let called = 0;
  const box = surface(green, tree({'openspec/changes/archive/issue-11/proposal.md': 'why'}), null);
  const passed = await passReview(
    {
      login: '3y3',
      review: box.review,
      vcs: box.vcs,
      judge: () => {
        called += 1;
        return {kind: 'clean'};
      },
    },
    {issue: '11', pull: '15'},
  );
  assert.deepEqual(passed, {action: 'wait', reason: 'range does not resolve'});
  assert.equal(called, 0);
  assert.equal(box.calls.includes('merge:15'), false);
});

test('an empty diff waits and is not a clean verdict', () => {
  const built = assembleDossier({
    issue: '11',
    pull: '15',
    head,
    base: 'def',
    commits: '',
    diff: '  ',
    files: tree({'openspec/changes/issue-11/proposal.md': 'why'}),
  });
  assert.deepEqual(built, {kind: 'wait', reason: 'diff is empty'});
});

test('an archived change still fills the dossier', () => {
  const built = assembleDossier({
    issue: '11',
    pull: '15',
    head,
    base: 'def',
    commits: 'abc',
    diff: 'diff --git a/a',
    files: tree({'openspec/changes/archive/issue-11/proposal.md': 'why'}),
  });
  assert.equal(built.kind, 'ready');
  if (built.kind === 'ready') {
    assert.match(built.dossier.change, /why/);
  }
});

test('a change with no files waits', () => {
  const built = assembleDossier({
    issue: '11',
    pull: '15',
    head,
    base: 'def',
    commits: 'abc',
    diff: 'diff --git a/a',
    files,
  });
  assert.deepEqual(built, {kind: 'wait', reason: 'change has no files'});
});

test('unjudged posts nothing, clean notes then merges, remarks speak once', () => {
  const quiet = memoryPorts();
  applyReview({kind: 'unjudged'}, '15', head, quiet.review);
  assert.deepEqual(quiet.calls, []);

  const clean = memoryPorts();
  applyReview({kind: 'clean'}, '15', head, clean.review);
  assert.deepEqual(clean.calls, ['say', `body:🤖 sdd:note reviewed ${head}`, 'merge:15']);

  const remarks = memoryPorts();
  applyReview(
    {kind: 'remarks', items: ['  ', 'Scenario TTL is missing', 'The diff skips the requirement']},
    '15',
    head,
    remarks.review,
  );
  assert.deepEqual(remarks.calls, [
    'speak',
    'body:Scenario TTL is missing\n\nThe diff skips the requirement',
  ]);
  assert.equal(
    remarks.calls.some(call => call.includes('🤖')),
    false,
  );
  assert.equal(
    remarks.calls.some(call => call.includes('sdd:layer=')),
    false,
  );
});

test('a clean verdict notes the head and merges, and remarks stay one person comment', async () => {
  const source = tree({'openspec/changes/archive/issue-11/proposal.md': 'why'});
  const span = {commits: 'abc change', diff: 'diff --git a/a'};
  const clean = surface(green, source, span);
  const cleaned = await passReview(
    {login: '3y3', review: clean.review, vcs: clean.vcs, judge: () => ({kind: 'clean'})},
    {issue: '11', pull: '15'},
  );
  assert.deepEqual(cleaned, {action: 'clean'});
  assert.ok(clean.calls.includes('say'));
  assert.ok(clean.calls.includes(`body:🤖 sdd:note reviewed ${head}`));
  assert.ok(clean.calls.includes('merge:15'));

  const remarks = surface(green, source, span);
  const remarked = await passReview(
    {
      login: '3y3',
      review: remarks.review,
      vcs: remarks.vcs,
      judge: () => ({kind: 'remarks', items: ['Scenario TTL is missing']}),
    },
    {issue: '11', pull: '15'},
  );
  assert.deepEqual(remarked, {action: 'remarks'});
  assert.ok(remarks.calls.includes('speak'));
  assert.ok(remarks.calls.includes('body:Scenario TTL is missing'));
  assert.equal(remarks.calls.includes('say'), false);
  assert.equal(remarks.calls.includes('merge:15'), false);
});

test('a bot login waits and does not merge', async () => {
  const box = surface(green, tree({'openspec/changes/archive/issue-11/proposal.md': 'why'}), {
    commits: 'abc',
    diff: 'diff',
  });
  const passed = await passReview(
    {
      login: 'github-actions[bot]',
      review: box.review,
      vcs: box.vcs,
      judge: () => ({kind: 'clean'}),
    },
    {issue: '11', pull: '15'},
  );
  assert.deepEqual(passed, {action: 'wait', reason: 'reviewer login is a bot'});
  assert.equal(box.calls.includes('merge:15'), false);
  assert.equal(box.calls.includes('say'), false);
});
