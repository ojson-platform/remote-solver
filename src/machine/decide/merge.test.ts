import assert from 'node:assert/strict';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {memoryPorts} from '../../adapters/tracker/github.ts';
import {resolveIssue} from '../flow/flow.ts';
import type {ChangeView} from '../change/change.ts';
import {decide, settle, type Decision, type PullSnapshot} from './policy.ts';
import type {IssueRecord} from '../port.ts';
import {reviewOf} from '../mark/review.ts';
import {action, asFolded, change, files, foldedTip, issue, pull} from '../__tests__/harness.ts';

function onDisk(
  row: IssueRecord,
  issues: IssueRecord[],
  pulls: PullSnapshot[],
  view: ChangeView,
): Decision {
  return decide(row, issues, pulls, view, view.archived ? asFolded(row) : undefined);
}

function settled(
  row: IssueRecord,
  issues: IssueRecord[],
  pulls: PullSnapshot[],
  view: ChangeView,
): ReturnType<typeof settle> {
  return settle(row, issues, pulls, view, view.archived ? foldedTip(row.key) : undefined);
}

spec('merge', () => {
  requirement('An early archived change is restored', () => {
    scenario('Tasking restores an archived change', () => {
      const decision = onDisk(
        issue(1, ['sdd:tasking']),
        [],
        [pull(9)],
        change({archived: true, design: true, tasks: true}),
      );
      assert.equal(action(decision), 'unarchive');
    });
    scenario('An archived change is restored before an unlabeled thread', () => {
      const review = reviewOf([{resolved: false, body: 'please rename'}], []);
      const decision = onDisk(
        issue(1, ['sdd:tasking']),
        [],
        [pull(9, {review})],
        change({archived: true, design: true, tasks: true}),
      );
      assert.equal(action(decision), 'unarchive');
    });
    scenario('Implementing restores an archived change before a code repair', () => {
      const decision = onDisk(
        issue(1, ['sdd:implementing']),
        [],
        [
          pull(9, {
            review: {unanswered: false, rollback: 'implementing', layers: ['code']},
          }),
        ],
        change({archived: true}),
      );
      assert.equal(action(decision), 'unarchive');
    });
    scenario('Accepting with a code thread restores before the repair', () => {
      const walked = settled(
        issue(1, ['sdd:accepting']),
        [],
        [
          pull(9, {
            review: {unanswered: false, rollback: 'implementing', layers: ['code']},
          }),
        ],
        change({archived: true}),
      );
      assert.deepEqual(
        walked.transitions.map(step => step.to),
        ['implementing'],
      );
      assert.equal(action(walked.decision), 'unarchive');
    });
    scenario('A merged pull request stays archived', () => {
      const decision = onDisk(
        issue(1, ['sdd:implementing']),
        [],
        [pull(9, {state: 'MERGED'})],
        change({archived: true, design: true, tasks: true}),
      );
      assert.notEqual(action(decision), 'unarchive');
    });
  });

  requirement('Accepting archives before it merges', () => {
    scenario('Accepting archives a change that is still open', () => {
      const decision = onDisk(issue(1, ['sdd:accepting']), [], [pull(9)], change({proposal: true}));
      assert.equal(action(decision), 'archive');
    });
    scenario('Accepting with no pull request does not archive', () => {
      const decision = onDisk(issue(1, ['sdd:accepting']), [], [], change({proposal: true}));
      assert.equal(decision.kind, 'wait');
      assert.notEqual(action(decision), 'archive');
    });
    scenario('Auto-merge merges a green archived pull request', () => {
      const decision = onDisk(
        issue(1, ['sdd:accepting', 'sdd:auto-merge']),
        [],
        [pull(9, {checks: 'green'})],
        change({archived: true}),
      );
      assert.equal(decision.kind, 'merge');
    });
    scenario('Without auto-merge the person merges', () => {
      const decision = onDisk(
        issue(1, ['sdd:accepting']),
        [],
        [pull(9, {checks: 'green'})],
        change({archived: true}),
      );
      assert.equal(decision.kind, 'wait');
      if (decision.kind === 'wait') {
        assert.match(decision.reason, /wait for merge/);
      }
    });
    scenario('Auto-merge waits for green checks', () => {
      const decision = onDisk(
        issue(1, ['sdd:accepting', 'sdd:auto-merge']),
        [],
        [pull(9, {checks: 'pending'})],
        change({archived: true}),
      );
      assert.equal(decision.kind, 'wait');
      assert.notEqual(decision.kind, 'merge');
    });
  });

  requirement('Accepted does not merge', () => {
    scenario('Accepted with an open change does not archive it', () => {
      const decision = onDisk(
        issue(1, ['sdd:accepted']),
        [],
        [pull(9, {state: 'MERGED'})],
        change({proposal: true}),
      );
      assert.equal(decision.kind, 'wait');
      assert.notEqual(action(decision), 'archive');
    });
    scenario('A merged archived pull request closes the issue', async () => {
      const {tracker, review} = memoryPorts({
        issues: [
          {
            key: '5',
            title: '#5: title',
            body: '',
            state: 'OPEN',
            labels: ['Sandcastle', 'sdd:cycle', 'sdd:accepted'],
          },
        ],
        pulls: {'5': [{id: '9', title: '#5: title', state: 'MERGED'}]},
      });
      const decision = await resolveIssue('5', {
        tracker,
        review,
        files,
        queues: [{name: 'Sandcastle'}],
        change: change({archived: true}),
        tip: foldedTip('5'),
      });
      assert.equal(decision.kind, 'done');
      assert.equal((await tracker.issue('5')).state, 'CLOSED');
    });
    scenario('A merged pull request beside an open one stays open', () => {
      const decision = onDisk(
        issue(1, ['sdd:accepting']),
        [],
        [pull(9, {checks: 'green'}), pull(8, {state: 'MERGED'})],
        change({archived: true}),
      );
      assert.equal(decision.kind, 'wait');
      if (decision.kind === 'wait') {
        assert.match(decision.reason, /wait for merge of PR #9/);
      }
    });
    scenario('Accepted waits while the pull request is open', () => {
      const decision = onDisk(
        issue(1, ['sdd:accepted', 'sdd:auto-merge']),
        [],
        [pull(9, {checks: 'green'})],
        change({archived: true}),
      );
      assert.equal(decision.kind, 'wait');
      assert.notEqual(decision.kind, 'merge');
    });
  });
});
