import assert from 'node:assert/strict';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {linkedTitle, memoryPorts} from '../../adapters/tracker/github.ts';
import {decide, settle} from './policy.ts';
import {publish} from '../../sdd.ts';
import {change, issue, pull} from '../__tests__/harness.ts';

spec('pull-request', () => {
  requirement('Several open pull requests hold the phase line', () => {
    scenario('Two open pull requests stop proposing', () => {
      const decision = decide(
        issue(1, ['sdd:proposing']),
        [],
        [pull(3), pull(4)],
        change({proposal: true}),
      );
      assert.equal(decision.kind, 'wait');
      if (decision.kind === 'wait') {
        assert.match(decision.reason, /3, 4/);
      }
    });
    scenario('A gate label does not move while two pull requests are open', () => {
      const settled = settle(
        issue(1, ['sdd:proposing', 'sdd:proposed']),
        [],
        [pull(3), pull(4)],
        change({proposal: true}),
      );
      assert.equal(settled.decision.kind, 'wait');
      assert.deepEqual(settled.transitions, []);
      assert.ok(settled.labels.includes('sdd:proposed'));
      assert.equal(settled.labels.includes('sdd:specifying'), false);
    });
    scenario('Two open pull requests block entering the cycle', () => {
      const settled = settle(issue(1, ['sdd:cycle']), [], [pull(3), pull(4)], change());
      assert.deepEqual(settled.transitions, []);
      assert.equal(settled.labels.includes('sdd:proposing'), false);
    });
    scenario('An open task still runs while two pull requests are open', () => {
      const decision = decide(
        issue(1, ['sdd:implementing']),
        [],
        [pull(3), pull(4)],
        change({tasks: true, openTasks: 1}),
      );
      assert.equal(decision.kind, 'agent');
      if (decision.kind === 'agent') {
        assert.equal(decision.action, 'implement-next-task');
      }
    });
    scenario('An open task still runs when one of two pull requests conflicts', () => {
      const decision = decide(
        issue(1, ['sdd:implementing']),
        [],
        [pull(3, {conflict: true}), pull(4)],
        change({tasks: true, openTasks: 1}),
      );
      assert.equal(decision.kind, 'agent');
      if (decision.kind === 'agent') {
        assert.equal(decision.action, 'implement-next-task');
      }
    });
  });

  requirement('None creates a pull request, one is reused', () => {
    scenario('No open pull request is created with the given title', async () => {
      const titles: string[] = [];
      const pushed: string[] = [];
      const memory = memoryPorts();
      const id = await publish(
        {key: '7', title: '#7: land the change'},
        {
          review: {
            pulls: key => memory.review.pulls(key),
            ensurePull: (key, title, body) => {
              titles.push(title);
              return memory.review.ensurePull(key, title, body);
            },
          } as never,
          vcs: {dirty: async () => [], push: async key => void pushed.push(key)},
        },
      );
      assert.equal(id, '#7: pull new');
      assert.deepEqual(titles, ['#7: land the change']);
      assert.deepEqual(pushed, ['7']);
    });
    scenario('One open pull request is reused', async () => {
      const memory = memoryPorts({pulls: {'7': [{id: '9', title: '#7: existing', state: 'OPEN'}]}});
      const pushed: string[] = [];
      const id = await publish(
        {key: '7', title: '#7: again'},
        {
          review: memory.review,
          vcs: {dirty: async () => [], push: async key => void pushed.push(key)},
        },
      );
      assert.equal(id, '#7: pull 9');
      assert.deepEqual(pushed, ['7']);
    });
    scenario('A title without the key prefix does not belong to the issue', () => {
      assert.equal(linkedTitle('7', 'unrelated'), false);
      assert.equal(linkedTitle('7', '#7: change'), true);
    });
  });
});
