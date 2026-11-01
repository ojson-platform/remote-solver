import assert from 'node:assert/strict';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {machine} from '../adapters/compose.ts';
import {memoryPorts} from '../adapters/github.ts';
import {files} from '../machine/harness.ts';
import type {FileSource} from '../machine/port.ts';
import {applyReview, passReview} from './act.ts';
import {assembleDossier} from './dossier.ts';
import {placeOnDiff} from './place.ts';
import {describeQueue, reviewQueue} from './plan.ts';
import {runReview} from './run.ts';
import {parseVerdict} from './verdict.ts';

function namedFiles(entries: Record<string, string>): FileSource {
  return {
    exists: rel => rel in entries,
    read: rel => entries[rel] ?? '',
    list: rel => Object.keys(entries).filter(name => name.startsWith(`${rel}/`)),
  };
}

const reviewedHead = 'abc123';

const reviewDiff = `diff --git a/src/cache.ts b/src/cache.ts
--- a/src/cache.ts
+++ b/src/cache.ts
@@ -10,3 +12,4 @@
 keep
+added
 same
`;

spec('reviewer', () => {
  const accepting = ['sdd:cycle', 'sdd:accepting', 'sdd:auto-review'];

  requirement('Only one accepting pull request is reviewed', () => {
    scenario('Auto-merge skips the reviewer', () => {
      const items = reviewQueue([{key: '11', labels: [...accepting, 'sdd:auto-merge']}], () => []);
      assert.equal(items[0]?.kind, 'skip');
      if (items[0]?.kind === 'skip') {
        assert.match(items[0].reason, /auto-merge/);
      }
    });
    scenario('Auto-review before accepting is skipped', () => {
      const items = reviewQueue(
        [{key: '13', labels: ['sdd:cycle', 'sdd:implementing', 'sdd:auto-review']}],
        () => [],
      );
      assert.equal(items[0]?.kind, 'skip');
      if (items[0]?.kind === 'skip') {
        assert.match(items[0].reason, /accepting/);
      }
    });
    scenario('An issue without auto-review is left out', () => {
      const items = reviewQueue([{key: '14', labels: ['sdd:cycle', 'sdd:accepting']}], () => [
        {id: '15', state: 'OPEN'},
      ]);
      assert.deepEqual(items, []);
    });
    scenario('Several open pull requests wait', () => {
      const items = reviewQueue([{key: '11', labels: accepting}], () => [
        {id: '3', state: 'OPEN'},
        {id: '4', state: 'OPEN'},
      ]);
      assert.equal(items[0]?.kind, 'wait');
    });
    scenario('One open pull request is ready', () => {
      const items = reviewQueue([{key: '12', labels: accepting}], () => [
        {id: '15', state: 'OPEN'},
      ]);
      assert.deepEqual(items, [{kind: 'ready', issue: '12', pull: '15'}]);
    });
    scenario('An empty queue says so', () => {
      assert.deepEqual(describeQueue([]), ['no sdd:auto-review issues']);
    });
  });

  requirement('The reviewer waits until the pull request is quiet', () => {
    scenario('Pending checks wait', async () => {
      const passed = await passReview(
        {
          review: memoryPorts({
            pulls: {'11': [{id: '15', title: '#11: title', state: 'OPEN'}]},
            checks: {'15': {checks: 'pending'}},
            ranges: {'15': {head: reviewedHead, base: 'def'}},
          }).review,
          vcs: {
            filesAt: () => files,
            compare: () => null,
            push() {},
            head: () => '',
            published: () => true,
            dirty: () => [],
          },
          judge: () => {
            throw new Error('judge');
          },
        },
        {issue: '11', pull: '15'},
      );
      assert.deepEqual(passed, {action: 'wait', reason: 'checks are pending'});
    });
    scenario('An unanswered comment waits', async () => {
      const {review, calls} = memoryPorts({
        pulls: {'11': [{id: '15', title: '#11: title', state: 'OPEN'}]},
        checks: {'15': {checks: 'green'}},
        ranges: {'15': {head: reviewedHead, base: 'def'}},
        comments: {'15': [{robot: false, body: 'please rebase'}]},
      });
      const passed = await passReview(
        {
          review,
          vcs: {
            filesAt: () => files,
            compare: () => null,
            push() {},
            head: () => '',
            published: () => true,
            dirty: () => [],
          },
          judge: () => {
            throw new Error('judge');
          },
        },
        {issue: '11', pull: '15'},
      );
      assert.deepEqual(passed, {action: 'wait', reason: 'unanswered comment'});
      assert.equal(calls.includes('merge:15'), false);
    });
    scenario('An open layer does not call the judge', async () => {
      let called = 0;
      const box = memoryPorts({
        pulls: {'11': [{id: '15', title: '#11: title', state: 'OPEN'}]},
        checks: {'15': {checks: 'green'}},
        ranges: {'15': {head: reviewedHead, base: 'def'}},
        comments: {'15': [{robot: true, body: '🤖 sdd:layer=code → implementing'}]},
      });
      const passed = await passReview(
        {
          review: box.review,
          vcs: {
            filesAt: () => files,
            compare: () => null,
            push() {},
            head: () => '',
            published: () => true,
            dirty: () => [],
          },
          judge: () => {
            called += 1;
            return {kind: 'clean'};
          },
        },
        {issue: '11', pull: '15'},
      );
      assert.deepEqual(passed, {action: 'wait', reason: 'open layer'});
      assert.equal(called, 0);
      assert.equal(box.calls.includes('merge:15'), false);
      assert.equal(box.calls.includes('say'), false);
    });
    scenario('A reviewed head merges without the judge', async () => {
      const box = memoryPorts({
        pulls: {'11': [{id: '15', title: '#11: title', state: 'OPEN'}]},
        checks: {'15': {checks: 'green'}},
        ranges: {'15': {head: reviewedHead, base: 'def'}},
        comments: {'15': [{robot: true, body: `🤖 sdd:note reviewed ${reviewedHead}`}]},
      });
      const passed = await passReview(
        {
          review: box.review,
          vcs: {
            filesAt: () => files,
            compare: () => null,
            push() {},
            head: () => '',
            published: () => true,
            dirty: () => [],
          },
          judge: () => {
            throw new Error('judge');
          },
        },
        {issue: '11', pull: '15'},
      );
      assert.deepEqual(passed, {action: 'clean'});
      assert.ok(box.calls.includes('merge:15'));
    });
    scenario('An empty head does not match another note', async () => {
      const box = memoryPorts({
        pulls: {'11': [{id: '15', title: '#11: title', state: 'OPEN'}]},
        checks: {'15': {checks: 'green'}},
        ranges: {'15': {head: '', base: 'def'}},
        comments: {'15': [{robot: true, body: `🤖 sdd:note reviewed ${reviewedHead}`}]},
      });
      const passed = await passReview(
        {
          review: box.review,
          vcs: {
            filesAt: () => files,
            compare: () => null,
            push() {},
            head: () => '',
            published: () => true,
            dirty: () => [],
          },
          judge: () => ({kind: 'clean'}),
        },
        {issue: '11', pull: '15'},
      );
      assert.deepEqual(passed, {action: 'wait', reason: 'head does not resolve'});
      assert.equal(box.calls.includes('merge:15'), false);
    });
  });

  requirement('The verdict posts a note, remarks, or nothing', () => {
    scenario('An empty answer posts nothing and the command fails', async () => {
      const quiet = memoryPorts();
      await applyReview(
        {kind: 'unjudged', reason: 'empty answer'},
        '15',
        reviewedHead,
        quiet.review,
      );
      assert.deepEqual(quiet.calls, []);
      const {tracker, review, calls} = memoryPorts({
        issues: [
          {
            key: '11',
            title: '#11: title',
            body: '',
            state: 'OPEN',
            labels: ['sdd:cycle', 'sdd:accepting', 'sdd:auto-review'],
          },
        ],
        pulls: {'11': [{id: '15', title: '#11: title', state: 'OPEN'}]},
        checks: {'15': {checks: 'green'}},
        ranges: {'15': {head: reviewedHead, base: 'def'}},
      });
      const box = machine(process.cwd(), {
        config: {queues: [{name: 'Sandcastle'}]},
        tracker,
        review,
        vcs: {
          filesAt: () => namedFiles({'openspec/changes/archive/issue-11/proposal.md': 'why'}),
          compare: () => ({commits: 'abc', diff: 'diff --git a/a'}),
          push() {},
          head: () => '',
          published: () => true,
          dirty: () => [],
        },
      });
      const logged = console.log;
      console.log = () => {};
      let code = 0;
      try {
        code = await runReview(box, () => ({kind: 'unjudged', reason: 'empty answer'}));
      } finally {
        console.log = logged;
      }
      assert.equal(code, 1);
      assert.equal(calls.includes('say'), false);
      assert.equal(calls.includes('merge:15'), false);
    });
    scenario('A clean verdict notes the head and merges', async () => {
      const clean = memoryPorts();
      await applyReview({kind: 'clean'}, '15', reviewedHead, clean.review);
      assert.ok(clean.calls.includes(`body:🤖 sdd:note reviewed ${reviewedHead}`));
      assert.ok(clean.calls.includes('merge:15'));
    });
    scenario('Remarks are one comment and carry no robot mark', async () => {
      const remarks = memoryPorts();
      await applyReview(
        {
          kind: 'remarks',
          items: [
            {body: '  '},
            {body: 'Scenario TTL is missing'},
            {body: 'The diff skips the requirement'},
          ],
        },
        '15',
        reviewedHead,
        remarks.review,
      );
      assert.ok(
        remarks.calls.includes('body:Scenario TTL is missing\n\nThe diff skips the requirement'),
      );
      assert.equal(
        remarks.calls.some(call => call.includes('🤖')),
        false,
      );
      assert.equal(remarks.calls.includes('merge:15'), false);
    });
    scenario('A remark that carries a marker is dropped', () => {
      const verdict = parseVerdict(
        'remark: sdd:layer=code\nremark: 🤖 rebase\nremark: Scenario TTL is missing',
      );
      assert.deepEqual(verdict, {kind: 'remarks', items: [{body: 'Scenario TTL is missing'}]});
    });
    scenario('At most five remarks are kept', () => {
      const verdict = parseVerdict(
        ['one', 'two', 'three', 'four', 'five', 'six'].map(item => `remark: ${item}`).join('\n'),
      );
      assert.equal(verdict.kind, 'remarks');
      if (verdict.kind === 'remarks') {
        assert.deepEqual(
          verdict.items.map(item => item.body),
          ['one', 'two', 'three', 'four', 'five'],
        );
      }
    });
    scenario('Clean and an empty answer are read from the text', () => {
      assert.deepEqual(parseVerdict('clean'), {kind: 'clean'});
      assert.deepEqual(parseVerdict(''), {kind: 'unjudged', reason: 'empty answer'});
    });
  });

  requirement('A remark lands on a diff line only when that line is in the diff', () => {
    scenario('A line in the diff stays on that line', () => {
      assert.deepEqual(
        placeOnDiff(reviewDiff, {body: 'on the addition', path: 'src/cache.ts', line: 13}),
        {
          body: 'on the addition',
          path: 'src/cache.ts',
          line: 13,
        },
      );
    });
    scenario('A line outside the hunk keeps the file', () => {
      assert.deepEqual(
        placeOnDiff(reviewDiff, {body: 'elsewhere', path: 'src/cache.ts', line: 99}),
        {
          body: 'elsewhere',
          path: 'src/cache.ts',
        },
      );
    });
    scenario('A file outside the diff is left on the conversation', () => {
      assert.deepEqual(
        placeOnDiff(reviewDiff, {body: 'no such file', path: 'src/other.ts', line: 1}),
        {
          body: 'no such file',
        },
      );
    });
  });

  requirement('A dossier that cannot be assembled waits', () => {
    scenario('No base waits before the diff', async () => {
      let called = 0;
      const box = memoryPorts({
        pulls: {'11': [{id: '15', title: '#11: title', state: 'OPEN'}]},
        checks: {'15': {checks: 'green'}},
        ranges: {'15': {head: reviewedHead, base: null}},
      });
      const passed = await passReview(
        {
          review: box.review,
          vcs: {
            filesAt: () => files,
            compare: () => null,
            push() {},
            head: () => '',
            published: () => true,
            dirty: () => [],
          },
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
    scenario('A missing range waits', async () => {
      let called = 0;
      const box = memoryPorts({
        pulls: {'11': [{id: '15', title: '#11: title', state: 'OPEN'}]},
        checks: {'15': {checks: 'green'}},
        ranges: {'15': {head: reviewedHead, base: 'def'}},
      });
      const passed = await passReview(
        {
          review: box.review,
          vcs: {
            filesAt: () => namedFiles({'openspec/changes/archive/issue-11/proposal.md': 'why'}),
            compare: () => null,
            push() {},
            head: () => '',
            published: () => true,
            dirty: () => [],
          },
          judge: () => {
            called += 1;
            return {kind: 'clean'};
          },
        },
        {issue: '11', pull: '15'},
      );
      assert.deepEqual(passed, {action: 'wait', reason: 'range does not resolve'});
      assert.equal(called, 0);
    });
    scenario('An empty diff waits', () => {
      const built = assembleDossier({
        issue: '11',
        pull: '15',
        head: reviewedHead,
        base: 'def',
        commits: '',
        diff: '  ',
        files: namedFiles({'openspec/changes/issue-11/proposal.md': 'why'}),
      });
      assert.deepEqual(built, {kind: 'wait', reason: 'diff is empty'});
    });
    scenario('A change with no files waits', () => {
      const built = assembleDossier({
        issue: '11',
        pull: '15',
        head: reviewedHead,
        base: 'def',
        commits: 'abc',
        diff: 'diff --git a/a',
        files,
      });
      assert.deepEqual(built, {kind: 'wait', reason: 'change has no files'});
    });
    scenario('An archived change still fills the dossier', () => {
      const built = assembleDossier({
        issue: '11',
        pull: '15',
        head: reviewedHead,
        base: 'def',
        commits: 'abc',
        diff: 'diff --git a/a',
        files: namedFiles({'openspec/changes/archive/issue-11/proposal.md': 'why'}),
      });
      assert.equal(built.kind, 'ready');
      if (built.kind === 'ready') {
        assert.match(built.dossier.change, /why/);
      }
    });
  });
});
