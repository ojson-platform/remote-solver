import assert from 'node:assert/strict';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {memoryPorts} from '../adapters/github.ts';
import {resolveCycle} from './flow.ts';
import {decide} from './policy.ts';
import {reviewOf} from './review.ts';
import {action, change, issue, pull, ready} from './harness.ts';

spec('dependencies', () => {
  requirement('Tasking waits until every child is specified', () => {
    scenario('A child still on specifying holds tasking', () => {
      const parent = issue(1, ['sdd:tasking']);
      const child = issue(2, ['sdd:cycle', 'sdd:specifying'], {parent: '1'});
      const decision = decide(parent, [parent, child], [pull(9)], ready);
      assert.equal(decision.kind, 'wait');
      if (decision.kind === 'wait') {
        assert.match(decision.reason, /#2/);
      }
    });
    scenario('A specified child lets tasking move on', () => {
      const parent = issue(1, ['sdd:tasking']);
      const child = issue(2, ['sdd:cycle', 'sdd:specified'], {parent: '1'});
      const decision = decide(parent, [parent, child], [pull(9)], ready);
      assert.deepEqual(decision, {
        kind: 'advance',
        issue: '1',
        to: 'implementing',
        reason: 'tasks exist',
      });
    });
    scenario('A cancelled child does not count as specified', () => {
      const parent = issue(1, ['sdd:tasking']);
      const child = issue(2, ['sdd:cycle', 'sdd:cancelled', 'sdd:tasking'], {parent: '1'});
      const decision = decide(parent, [parent, child], [pull(9)], ready);
      assert.equal(decision.kind, 'wait');
      if (decision.kind === 'wait') {
        assert.match(decision.reason, /#2/);
      }
    });
    scenario('Tasking still waits until every child is at least specified, then moves to implementing', () => {
      const parent = issue(1, ['sdd:tasking']);
      const slow = issue(2, ['sdd:cycle', 'sdd:specifying'], {parent: '1'});
      const waiting = decide(parent, [parent, slow], [pull(9)], ready);
      assert.equal(waiting.kind, 'wait');
      const fast = issue(2, ['sdd:cycle', 'sdd:specified'], {parent: '1'});
      assert.deepEqual(decide(parent, [parent, fast], [pull(9)], ready), {
        kind: 'advance',
        issue: '1',
        to: 'implementing',
        reason: 'tasks exist',
      });
    });
    scenario('A cancelled child still holds that wait, and the machine still names that child', () => {
      const parent = issue(1, ['sdd:tasking']);
      const child = issue(2, ['sdd:cycle', 'sdd:cancelled', 'sdd:tasking'], {parent: '1'});
      const decision = decide(parent, [parent, child], [pull(9)], ready);
      assert.equal(decision.kind, 'wait');
      if (decision.kind === 'wait') {
        assert.match(decision.reason, /#2/);
      }
    });
    scenario('A cancelled child still holds the tasking wait, and the machine still names that child', () => {
      const parent = issue(1, ['sdd:tasking']);
      const child = issue(2, ['sdd:cycle', 'sdd:cancelled', 'sdd:tasking'], {parent: '1'});
      const decision = decide(parent, [parent, child], [pull(9)], ready);
      assert.equal(decision.kind, 'wait');
      if (decision.kind === 'wait') {
        assert.match(decision.reason, /#2/);
      }
    });
  });

  requirement('Implementing waits for children and blockers after the tasks', () => {
    scenario('An open task runs before the children are checked', () => {
      const parent = issue(1, ['sdd:implementing']);
      const child = issue(2, ['sdd:cycle', 'sdd:specifying'], {parent: '1'});
      const decision = decide(parent, [parent, child], [pull(9)], {...ready, openTasks: 1});
      assert.equal(action(decision), 'implement-next-task');
    });
    scenario('A child that is not accepted holds implementing', () => {
      const parent = issue(1, ['sdd:implementing']);
      const child = issue(2, ['sdd:cycle', 'sdd:implementing'], {parent: '1'});
      const decision = decide(parent, [parent, child], [pull(9)], ready);
      assert.equal(decision.kind, 'wait');
      if (decision.kind === 'wait') {
        assert.match(decision.reason, /#2/);
      }
    });
    scenario('An open blocker holds implementing', () => {
      const parent = issue(1, ['sdd:implementing'], {blockedBy: ['8']});
      const blocker = issue(8, ['sdd:cycle', 'sdd:implementing']);
      const decision = decide(parent, [parent, blocker], [pull(9)], ready);
      assert.equal(decision.kind, 'wait');
      if (decision.kind === 'wait') {
        assert.match(decision.reason, /#8/);
      }
    });
    scenario('Finished tasks with no children move to verifying', () => {
      const decision = decide(issue(1, ['sdd:implementing']), [], [pull(9)], ready);
      assert.deepEqual(decision, {
        kind: 'advance',
        issue: '1',
        to: 'verifying',
        reason: 'no open tasks',
      });
    });
    scenario('A finished parent with a child short of accepted and an open blocker waits', () => {
      const parent = issue(1, ['sdd:implementing'], {dependsOn: ['8']});
      const child = issue(2, ['sdd:cycle', 'sdd:implementing'], {parent: '1'});
      const blocker = issue(8, ['sdd:cycle', 'sdd:implementing']);
      const archived = change({...ready, archived: true, openTasks: 0});
      const merged = pull(25, {state: 'MERGED'});
      const decision = decide(parent, [parent, child, blocker], [merged], archived);
      assert.equal(decision.kind, 'wait');
      if (decision.kind === 'wait') {
        assert.match(decision.reason, /#2/);
      }
    });
    scenario('Implementing still runs an open task before it looks at links', () => {
      const parent = issue(1, ['sdd:implementing'], {dependsOn: ['8']});
      const child = issue(2, ['sdd:cycle', 'sdd:implementing'], {parent: '1'});
      const blocker = issue(8, ['sdd:cycle', 'sdd:implementing']);
      const decision = decide(parent, [parent, child, blocker], [pull(9)], {...ready, openTasks: 1});
      assert.equal(action(decision), 'implement-next-task');
    });
    scenario(
      'With no open task, it waits until every child is accepted, then waits while a blocker is open, then moves to verifying',
      () => {
        const doneTasks = {...ready, openTasks: 0};
        const parent = issue(1, ['sdd:implementing'], {dependsOn: ['8']});
        const child = issue(2, ['sdd:cycle', 'sdd:implementing'], {parent: '1'});
        const blocker = issue(8, ['sdd:cycle', 'sdd:implementing']);
        assert.equal(decide(parent, [parent, child], [pull(9)], doneTasks).kind, 'wait');
        const childAccepted = issue(2, ['sdd:cycle', 'sdd:accepted'], {parent: '1'});
        const onBlocker = decide(parent, [parent, childAccepted, blocker], [pull(9)], doneTasks);
        assert.equal(onBlocker.kind, 'wait');
        if (onBlocker.kind === 'wait') {
          assert.match(onBlocker.reason, /#8/);
        }
        assert.deepEqual(decide(parent, [parent, childAccepted], [pull(9)], doneTasks), {
          kind: 'advance',
          issue: '1',
          to: 'verifying',
          reason: 'no open tasks',
        });
      },
    );
    scenario('A closed issue does not hold that wait', () => {
      const parent = issue(1, ['sdd:implementing'], {dependsOn: ['8'], blockedBy: ['8']});
      const decision = decide(parent, [parent], [pull(9)], ready);
      assert.deepEqual(decision, {
        kind: 'advance',
        issue: '1',
        to: 'verifying',
        reason: 'no open tasks',
      });
    });
    scenario('One issue on two of these links counts once for the wait', () => {
      const parent = issue(1, ['sdd:implementing'], {blockedBy: ['8'], dependsOn: ['8']});
      const blocker = issue(8, ['sdd:cycle', 'sdd:implementing']);
      const decision = decide(parent, [parent, blocker], [pull(9)], ready);
      assert.equal(decision.kind, 'wait');
      if (decision.kind === 'wait') {
        assert.match(decision.reason, /#8/);
        assert.doesNotMatch(decision.reason, /#8.*#8/);
      }
    });
  });

  requirement('No other phase move waits on a link', () => {
    scenario('No other phase move waits on a link', () => {
      const parent = issue(1, ['sdd:verifying'], {dependsOn: ['8'], blockedBy: ['8']});
      const child = issue(2, ['sdd:cycle', 'sdd:specifying'], {parent: '1'});
      const blocker = issue(8, ['sdd:cycle', 'sdd:implementing']);
      const decision = decide(parent, [parent, child, blocker], [pull(9, {checks: 'green'})], ready);
      assert.deepEqual(decision, {
        kind: 'advance',
        issue: '1',
        to: 'accepting',
        reason: 'checks are green',
      });
    });
  });

  requirement('A rollback does not move a linked issue', () => {
    scenario('A spec marker on the parent leaves the child in place', async () => {
      const parent = issue(1, ['Sandcastle', 'sdd:cycle', 'sdd:implementing']);
      const child = issue(2, ['Sandcastle', 'sdd:cycle', 'sdd:implementing'], {parent: '1'});
      const {tracker} = memoryPorts({
        issues: [
          {key: '1', title: '#1: title', body: '', state: 'OPEN', labels: [...parent.labels]},
          {
            key: '2',
            title: '#2: title',
            body: '',
            state: 'OPEN',
            labels: [...child.labels],
            parent: '1',
          },
        ],
      });
      const review = reviewOf([{resolved: false, body: 'sdd:layer=spec → specifying'}], []);
      await resolveCycle(
        {
          issues: [parent, child],
          cycles: [parent, child],
          pulls: new Map([
            ['1', [pull(9, {review})]],
            ['2', [pull(10)]],
          ]),
          changes: new Map([
            ['1', ready],
            ['2', {...ready, openTasks: 1}],
          ]),
        },
        tracker,
        [{name: 'Sandcastle'}],
      );
      assert.ok((await tracker.labels('1')).includes('sdd:specifying'));
      assert.equal((await tracker.labels('1')).includes('sdd:implementing'), false);
      assert.deepEqual(await tracker.labels('2'), ['Sandcastle', 'sdd:cycle', 'sdd:implementing']);
    });
    scenario('Rolling this issue back does not move the linked issue', () => {
      const parent = issue(1, ['sdd:implementing']);
      const child = issue(2, ['sdd:cycle', 'sdd:implementing'], {parent: '1'});
      const decision = decide(
        parent,
        [parent, child],
        [pull(9, {review: {unanswered: false, rollback: 'specifying', layers: []}})],
        ready,
      );
      assert.deepEqual(decision, {
        kind: 'advance',
        issue: '1',
        to: 'specifying',
        reason: 'review thread sent the change back',
      });
    });
  });
});
