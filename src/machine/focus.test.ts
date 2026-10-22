import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'vitest';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import type {FileSource, Review, Tracker, Vcs} from './port.ts';
import {changeDir} from './naming.ts';
import {endStep, observedSignal, type RunMarks} from './focus.ts';
import {openWindow, type WindowComment} from '../window/window.ts';

const KEY = '1';

type ThreadSeed = {id: string; body: string; resolved?: boolean};

type Run = {
  commits?: number;
  signal?: 'Wait' | 'Hand-off' | null;
  files?: readonly string[];
  diff?: string;
  threads?: readonly ThreadSeed[];
  comments?: WindowComment[];
  requirements?: readonly {capability: string; name: string; causes: readonly string[]}[];
  boundaries?: readonly {capability: string; causes: readonly string[]}[];
  places?: readonly {file: string; line: number; causes: readonly string[]}[];
  pulls?: 'one' | 'none';
};

function source(paths: readonly string[]): FileSource {
  return {
    exists: rel => paths.includes(rel),
    read: () => '',
    list: rel => {
      const prefix = rel.endsWith('/') ? rel : `${rel}/`;
      return paths.filter(item => item.startsWith(prefix));
    },
  };
}

async function run(over: Run = {}): Promise<{comments: WindowComment[]; posted: string[]}> {
  const comments = (over.comments ?? []).map(comment => ({...comment}));
  const posted: string[] = [];
  const tracker = {
    async comments() {
      return comments.map(comment => ({...comment}));
    },
    async comment(_key: string, body: string) {
      posted.push(body);
      comments.push({body});
    },
  } as Pick<Tracker, 'comments' | 'comment'>;
  const review = {
    async pulls() {
      if (over.pulls === 'none') {
        return [];
      }
      return [{id: '9', title: '#1: title', state: 'OPEN', checks: 'green' as const}];
    },
    async range() {
      return {head: 'abc', base: 'base'};
    },
    async threadList() {
      return (over.threads ?? []).map(thread => ({
        id: thread.id,
        comment: '1',
        path: 'src/a.ts',
        line: 1,
        resolved: thread.resolved ?? false,
        body: thread.body,
      }));
    },
  } as Pick<Review, 'pulls' | 'range' | 'threadList'>;
  const vcs = {
    filesAt: () => source(over.files ?? []),
    async compare() {
      return {commits: '1', diff: over.diff ?? ''};
    },
  } as Pick<Vcs, 'compare' | 'filesAt'>;
  await endStep(
    KEY,
    {commits: over.commits ?? 0, signal: over.signal},
    {
      tracker,
      review,
      vcs,
      requirements: over.requirements,
      boundaries: over.boundaries,
      places: over.places,
    },
  );
  return {comments, posted};
}

function dir(): string {
  return changeDir(KEY);
}

function file(name: string): string {
  return path.join(dir(), name);
}

async function proveASignalWithNewTextAppendsAComment(): Promise<void> {
  const older = 'sdd:focus\nPlan solid\n';
  const {comments, posted} = await run({
    commits: 1,
    files: [file('notes.md')],
    comments: [{body: older}, {body: 'sdd:focus\nCode solid\n', manager: true}],
  });
  assert.equal(posted.length, 1);
  assert.equal(posted[0].startsWith('sdd:focus\n'), true);
  assert.equal(comments[0]?.body, older);
  assert.equal(comments[1]?.manager, true);
  assert.equal(comments[2]?.body, posted[0]);
}

async function proveTheSameTextAddsNothing(): Promise<void> {
  const same = 'sdd:focus\nChange solid\n';
  const {comments, posted} = await run({
    signal: 'Wait',
    files: [file('notes.md')],
    comments: [{body: same}, {body: 'sdd:focus\nPlan gap\n', manager: true}],
  });
  assert.deepEqual(posted, []);
  assert.equal(comments.length, 2);
  assert.equal(comments[0]?.body, same);
}

async function proveNoSignalLeavesThePlaque(): Promise<void> {
  const body = 'sdd:focus\nChange solid\n';
  const {comments, posted} = await run({
    files: [file('notes.md')],
    diff: 'diff --git a/src/a.ts\n',
    comments: [{body}],
  });
  assert.deepEqual(posted, []);
  assert.equal(comments.length, 1);
  const root = mkdtempSync(path.join(tmpdir(), 'focus-plaque-'));
  const arcadia = path.join(root, 'arcadia');
  const home = path.join(root, 'home.yaml');
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(path.join(checkout, 'openspec'), {recursive: true});
  writeFileSync(
    path.join(checkout, 'openspec', 'config.yaml'),
    'sdd:\n  queues:\n    - name: alpha\n',
  );
  writeFileSync(home, `watch:\n  - alpha\nroots:\n  arcadia: ${arcadia}\n`);
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => 'ada',
      tickets: () => [
        {
          key: KEY,
          title: KEY,
          assignee: 'ada',
          queue: 'alpha',
          sddService: 'services/billing',
          labels: ['sdd:cycle', 'sdd:implementing'],
          comments,
        },
      ],
    },
  );
  window.openCard(KEY);
  const plaque = window.sidebar().find(block => block.kind === 'focus');
  assert.deepEqual(plaque, {kind: 'focus', body: 'Change solid\n'});
  rmSync(root, {recursive: true, force: true});
}

async function proveNoChangeFileMeansNoFocusComment(): Promise<void> {
  const {posted} = await run({
    commits: 1,
    files: [],
    diff: 'diff --git a/src/a.ts\n+line\n',
    threads: [{id: 'PRRT_9', body: 'sdd:layer=code → implementing the file fails'}],
  });
  assert.deepEqual(posted, []);
}

async function proveChangeIsSolidWhenTheDirectoryExists(): Promise<void> {
  const {posted} = await run({
    commits: 1,
    files: [file('notes.md')],
  });
  assert.deepEqual(posted, ['sdd:focus\nChange solid\n']);
}

async function proveCodeIsOmittedWithoutADiff(): Promise<void> {
  const {posted} = await run({
    commits: 1,
    files: [file('notes.md')],
    diff: '',
    threads: [{id: 'PRRT_9', body: 'sdd:layer=code → implementing the file fails'}],
    places: [{file: 'src/a.ts', line: 3, causes: ['here']}],
  });
  assert.equal(posted.length, 1);
  assert.equal(posted[0].includes('Code'), false);
  assert.equal(posted[0].includes('PRRT_9'), false);
  assert.equal(posted[0].includes('src/a.ts'), false);
}

async function proveASpecMarkerLandsOnSpecify(): Promise<void> {
  const {posted} = await run({
    signal: 'Hand-off',
    files: [file('specs/preset/spec.md')],
    threads: [{id: 'PRRT_4', body: 'sdd:layer=spec → specifying the remark asks for a scenario'}],
  });
  assert.deepEqual(posted, [
    [
      'sdd:focus',
      'Change solid',
      'Specify thread PRRT_4',
      'specifying the remark asks for a scenario',
      '',
    ].join('\n'),
  ]);
}

async function proveChangeTakesNoThread(): Promise<void> {
  const {posted} = await run({
    commits: 1,
    files: [file('specs/preset/spec.md')],
    threads: [{id: 'PRRT_4', body: 'sdd:layer=spec → specifying the remark asks for a scenario'}],
  });
  const change = posted[0]?.split('\n').find(line => line.startsWith('Change '));
  assert.equal(change, 'Change solid');
}

async function proveARequirementPointerNamesTheRequirement(): Promise<void> {
  const {posted} = await run({
    commits: 1,
    files: [file('specs/preset/spec.md')],
    requirements: [
      {
        capability: 'preset',
        name: 'The cache keeps the first hit',
        causes: ['the scenario is not observed', 'the name stays'],
      },
    ],
  });
  assert.deepEqual(posted, [
    [
      'sdd:focus',
      'Change solid',
      'Specify requirement preset The cache keeps the first hit',
      'the scenario is not observed; the name stays',
      '',
    ].join('\n'),
  ]);
}

async function proveTheCommentHasNoCoverageCount(): Promise<void> {
  const {posted} = await run({
    commits: 1,
    files: [file('specs/preset/spec.md')],
    diff: 'diff --git a/src/a.ts\n@@ -1 +1 @@\n+coverage 12/40\nDIFF_BODY_UNIQUE\n',
    threads: [
      {
        id: 'PRRT_1',
        body: 'sdd:layer=spec → specifying the scenario is missing\nretry 1/3\ncoverage 12/40\ndiff --git a/src/a.ts\n+added',
      },
    ],
  });
  assert.equal(posted.length, 1);
  const body = posted[0] ?? '';
  assert.equal(body.includes('the scenario is missing'), true);
  assert.equal(body.includes('retry 1/3'), true);
  assert.equal(body.includes('12/40'), false);
  assert.equal(body.includes('DIFF_BODY_UNIQUE'), false);
  assert.equal(body.includes('diff --git'), false);
  assert.equal(body.includes('+added'), false);
  assert.equal(body.includes('+coverage'), false);
}

test('a marker lands on its mirror layer, and Plan and Tasks with no thread are solid', async () => {
  const {posted} = await run({
    commits: 1,
    files: [file('proposal.md'), file('design.md'), file('tasks.md'), file('specs/preset/spec.md')],
    diff: 'diff --git a/src/a.ts\n+line\n',
    threads: [
      {id: 'P1', body: 'sdd:layer=proposal → proposing the outcome line is wrong'},
      {id: 'D1', body: 'sdd:layer=design → designing the boundary is missing'},
      {id: 'T1', body: 'sdd:layer=tasks → tasking the slice is too big'},
      {id: 'C1', body: 'sdd:layer=code → implementing the test fails'},
      {id: 'OUT', body: 'sdd:layer=out → implementing not this cycle'},
      {id: 'NOTE', body: 'sdd:note leave this'},
    ],
    boundaries: [{capability: 'preset', causes: ['the boundary names no command']}],
  });
  assert.deepEqual(posted, [
    [
      'sdd:focus',
      'Change solid',
      'Plan thread P1',
      'proposing the outcome line is wrong',
      'Specify solid',
      'Design thread D1; boundary preset',
      'designing the boundary is missing',
      'the boundary names no command',
      'Tasks thread T1',
      'tasking the slice is too big',
      'Code thread C1',
      'implementing the test fails',
      '',
    ].join('\n'),
  ]);
  assert.equal(posted[0]?.includes('OUT'), false);
  assert.equal(posted[0]?.includes('leave this'), false);
});

test('a review place names the file and the line on Code', async () => {
  const {posted} = await run({
    commits: 1,
    files: [file('notes.md')],
    diff: 'diff --git a/src/a.ts\n+line\n',
    places: [{file: 'src/a.ts', line: 4, causes: ['the check failed']}],
  });
  assert.deepEqual(posted, [
    ['sdd:focus', 'Change solid', 'Code src/a.ts:4', 'the check failed', ''].join('\n'),
  ]);
});

test('a commit is Publish, a new marker is Hand-off, a new wait is Wait, and a still cycle is no signal', () => {
  const quiet: RunMarks = {waiting: false, comments: 0, threads: [], spoken: []};
  assert.equal(observedSignal(1, quiet, quiet), 'Publish');
  assert.equal(observedSignal(0, quiet, quiet), null);
  assert.equal(observedSignal(0, quiet, {...quiet, waiting: true, comments: 1}), 'Wait');
  assert.equal(
    observedSignal(0, {...quiet, waiting: true, comments: 1}, {...quiet, waiting: true, comments: 1}),
    null,
  );
  assert.equal(observedSignal(0, quiet, {...quiet, threads: ['T1']}), 'Hand-off');
  assert.equal(
    observedSignal(0, quiet, {...quiet, spoken: ['sdd:layer=code → implementing the test fails']}),
    'Hand-off',
  );
  assert.equal(
    observedSignal(
      0,
      {...quiet, spoken: ['sdd:layer=spec → kept']},
      {...quiet, spoken: ['sdd:layer=spec → kept']},
    ),
    null,
  );
});

spec('focus', () => {
  requirement('Focus is a new issue comment after a signal', () => {
    scenario('A signal with new text appends a comment', async () => {
      await proveASignalWithNewTextAppendsAComment();
    });
    scenario('The same text adds nothing', async () => {
      await proveTheSameTextAddsNothing();
    });
    scenario('No signal leaves the plaque', async () => {
      await proveNoSignalLeavesThePlaque();
    });
    scenario('No change file means no focus comment', async () => {
      await proveNoChangeFileMeansNoFocusComment();
    });
  });
  requirement('A layer is written when its file exists', () => {
    scenario('Change is solid when the directory exists', async () => {
      await proveChangeIsSolidWhenTheDirectoryExists();
    });
    scenario('Code is omitted without a diff', async () => {
      await proveCodeIsOmittedWithoutADiff();
    });
  });
  requirement('A marker lands on the mirror name', () => {
    scenario('A spec marker lands on Specify', async () => {
      await proveASpecMarkerLandsOnSpecify();
    });
    scenario('Change takes no thread', async () => {
      await proveChangeTakesNoThread();
    });
  });
  requirement('A gap is one pointer and a why line', () => {
    scenario('A requirement pointer names the requirement', async () => {
      await proveARequirementPointerNamesTheRequirement();
    });
    scenario('The comment has no coverage count', async () => {
      await proveTheCommentHasNoCoverageCount();
    });
  });
});
