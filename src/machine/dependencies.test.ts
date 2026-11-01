import assert from 'node:assert/strict';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {memoryPorts} from '../adapters/github.ts';
import {resolveCycle} from './flow.ts';
import {decide} from './policy.ts';
import {reviewOf} from './review.ts';
import {action, issue, pull, ready} from './harness.ts';

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
      const child = issue(2, ['sdd:cycle', 'sdd:cancelled'], {parent: '1'});
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
      const parent = issue(1, ['sdd:implementing'], {dependsOn: ['8']});
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
  });

  requirement('Parent and Depends are body lines', () => {
    scenario('A Parent line holds tasking', async () => {
      const {tracker} = memoryPorts({
        issues: [
          {
            key: '1',
            title: '#1: title',
            body: '',
            state: 'OPEN',
            labels: ['sdd:cycle', 'sdd:tasking'],
          },
          {
            key: '2',
            title: '#2: title',
            body: 'Parent: #1\n',
            state: 'OPEN',
            labels: ['sdd:cycle', 'sdd:specifying'],
          },
        ],
      });
      const issues = await tracker.listOpen();
      const parent = issues.find(item => item.key === '1');
      const decision = decide(parent!, issues, [pull(9)], ready);
      assert.equal(decision.kind, 'wait');
      if (decision.kind === 'wait') {
        assert.match(decision.reason, /#2/);
      }
    });
    scenario('A Depends line holds implementing', async () => {
      const {tracker} = memoryPorts({
        issues: [
          {
            key: '1',
            title: '#1: title',
            body: 'Depends: #8\n',
            state: 'OPEN',
            labels: ['sdd:cycle', 'sdd:implementing'],
          },
          {key: '8', title: '#8: title', body: '', state: 'OPEN', labels: []},
        ],
      });
      const issues = await tracker.listOpen();
      const parent = issues.find(item => item.key === '1');
      const decision = decide(parent!, issues, [pull(9)], ready);
      assert.equal(decision.kind, 'wait');
      if (decision.kind === 'wait') {
        assert.match(decision.reason, /#8/);
      }
    });
  });

  requirement('A parent rollback does not move a child', () => {
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
  });
});
