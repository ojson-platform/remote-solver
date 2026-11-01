import assert from 'node:assert/strict';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {memoryPorts} from '../adapters/github.ts';
import {resolveIssue} from './flow.ts';
import {decide} from './policy.ts';
import {reviewOf} from './review.ts';
import {action, change, files, issue, pull} from './harness.ts';

spec('merge', () => {
  requirement('An early archived change is restored', () => {
    scenario('Tasking restores an archived change', () => {
      const decision = decide(
        issue(1, ['sdd:tasking']),
        [],
        [pull(9)],
        change({archived: true, design: true, tasks: true}),
      );
      assert.equal(action(decision), 'unarchive');
    });
    scenario('An archived change is restored before an unlabeled thread', () => {
      const review = reviewOf([{resolved: false, body: 'please rename'}], []);
      const decision = decide(
        issue(1, ['sdd:tasking']),
        [],
        [pull(9, {review})],
        change({archived: true, design: true, tasks: true}),
      );
      assert.equal(action(decision), 'unarchive');
    });
  });

  requirement('Accepting archives before it merges', () => {
    scenario('Accepting archives a change that is still open', () => {
      const decision = decide(issue(1, ['sdd:accepting']), [], [pull(9)], change({proposal: true}));
      assert.equal(action(decision), 'archive');
    });
    scenario('Accepting with no pull request does not archive', () => {
      const decision = decide(issue(1, ['sdd:accepting']), [], [], change({proposal: true}));
      assert.equal(decision.kind, 'wait');
      assert.notEqual(action(decision), 'archive');
    });
    scenario('Auto-merge merges a green archived pull request', () => {
      const decision = decide(
        issue(1, ['sdd:accepting', 'sdd:auto-merge']),
        [],
        [pull(9, {checks: 'green'})],
        change({archived: true}),
      );
      assert.equal(decision.kind, 'merge');
    });
    scenario('Without auto-merge the person merges', () => {
      const decision = decide(
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
      const decision = decide(
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
    scenario('Accepted with an open change archives it', () => {
      const decision = decide(
        issue(1, ['sdd:accepted']),
        [],
        [pull(9, {state: 'MERGED'})],
        change({proposal: true}),
      );
      assert.equal(action(decision), 'archive');
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
      });
      assert.equal(decision.kind, 'done');
      assert.equal((await tracker.issue('5')).state, 'CLOSED');
    });
    scenario('Accepted waits while the pull request is open', () => {
      const decision = decide(
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
