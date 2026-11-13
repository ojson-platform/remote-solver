import assert from 'node:assert/strict';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {failedCheckMarks} from '../../adapters/tracker/github.ts';
import {decide, settle} from './policy.ts';
import {action, change, issue, pull, ready} from '../__tests__/harness.ts';

spec('verifying', () => {
  requirement('Verifying needs an open pull request', () => {
    scenario('Verifying without an open pull request waits', () => {
      const decision = decide(issue(1, ['sdd:verifying']), [], [], ready);
      assert.equal(decision.kind, 'wait');
    });
  });

  requirement('Red checks follow a marker, otherwise they are classified', () => {
    scenario('Red checks with a code marker return to implementing', () => {
      const decision = decide(
        issue(1, ['sdd:verifying']),
        [],
        [
          pull(9, {
            checks: 'red',
            review: {unanswered: false, rollback: 'implementing', layers: ['code']},
          }),
        ],
        ready,
      );
      assert.deepEqual(decision, {
        kind: 'advance',
        issue: '1',
        to: 'implementing',
        reason: 'review thread sent the change back',
      });
    });
    scenario('Red checks with no marker are classified', () => {
      const decision = decide(issue(1, ['sdd:verifying']), [], [pull(9, {checks: 'red'})], ready);
      assert.equal(action(decision), 'classify-failures');
    });
  });

  requirement('Only green checks without a marker reach accepting', () => {
    scenario('Pending checks wait', () => {
      const decision = decide(
        issue(1, ['sdd:verifying']),
        [],
        [pull(9, {checks: 'pending'})],
        ready,
      );
      assert.equal(decision.kind, 'wait');
    });
    scenario('Green checks with a design marker roll back', () => {
      const decision = decide(
        issue(1, ['sdd:verifying']),
        [],
        [
          pull(9, {
            checks: 'green',
            review: {unanswered: false, rollback: 'designing', layers: ['design']},
          }),
        ],
        ready,
      );
      assert.deepEqual(decision, {
        kind: 'advance',
        issue: '1',
        to: 'designing',
        reason: 'review thread sent the change back',
      });
    });
    scenario('Green checks move to accepting', () => {
      const decision = decide(issue(1, ['sdd:verifying']), [], [pull(9, {checks: 'green'})], ready);
      assert.deepEqual(decision, {
        kind: 'advance',
        issue: '1',
        to: 'accepting',
        reason: 'checks are green',
      });
    });
  });

  requirement('A merge conflict returns to implementing for a rebase', () => {
    scenario('A conflicting pull request leaves verifying for a rebase', () => {
      const settlement = settle(
        issue(1, ['sdd:verifying']),
        [],
        [pull(9, {checks: 'none', conflict: true})],
        ready,
      );
      assert.equal(settlement.labels.includes('sdd:implementing'), true);
      assert.equal(settlement.labels.includes('sdd:verifying'), false);
      assert.equal(settlement.decision.kind, 'agent');
      if (settlement.decision.kind === 'agent') {
        assert.equal(settlement.decision.action, 'fix-implementation');
        assert.equal(settlement.decision.skill, 'fix');
        assert.match(settlement.decision.reason, /rebase/);
      }
    });
    scenario('Implementing rebases a conflicting pull request', () => {
      const decision = decide(
        issue(1, ['sdd:implementing']),
        [],
        [pull(9, {conflict: true})],
        change({...ready, openTasks: 1}),
      );
      assert.equal(decision.kind, 'agent');
      if (decision.kind === 'agent') {
        assert.equal(decision.action, 'fix-implementation');
        assert.equal(decision.skill, 'fix');
      }
      assert.notEqual(decision.kind, 'advance');
    });
  });

  requirement('A red run is named in the classify reason', () => {
    scenario('Two completions of one check are different decisions', () => {
      const name = 'Test on Node.js 20.x';
      const earlier = decide(
        issue(1, ['sdd:verifying']),
        [],
        [pull(9, {checks: 'red', failures: [`${name}@2026-11-12T12:33:00Z`]})],
        ready,
      );
      const later = decide(
        issue(1, ['sdd:verifying']),
        [],
        [pull(9, {checks: 'red', failures: [`${name}@2026-11-12T12:59:00Z`]})],
        ready,
      );
      assert.equal(earlier.kind, 'agent');
      assert.equal(later.kind, 'agent');
      if (earlier.kind === 'agent' && later.kind === 'agent') {
        assert.notEqual(earlier.reason, later.reason);
        assert.match(earlier.reason, /Test on Node\.js 20\.x@2026-11-12T12:33:00Z/);
        assert.match(later.reason, /Test on Node\.js 20\.x@2026-11-12T12:59:00Z/);
      }
    });
    scenario('A cancelled check is not the name', () => {
      assert.deepEqual(
        failedCheckMarks({
          state: 'OPEN',
          statusCheckRollup: [
            {name: 'Test on Node.js 22.x', conclusion: 'CANCELLED', completedAt: '2026-11-12T12:59:10Z'},
            {name: 'Test on Node.js 20.x', conclusion: 'FAILURE', completedAt: '2026-11-12T12:59:01Z'},
          ],
        }),
        ['Test on Node.js 20.x@2026-11-12T12:59:01Z'],
      );
      assert.deepEqual(
        failedCheckMarks({
          state: 'OPEN',
          statusCheckRollup: [{name: 'units', conclusion: 'FAILURE'}],
        }),
        [],
      );
      const unnamed = decide(issue(1, ['sdd:verifying']), [], [pull(9, {checks: 'red'})], ready);
      assert.equal(unnamed.kind, 'agent');
      if (unnamed.kind === 'agent') {
        assert.equal(unnamed.reason, 'red checks');
      }
    });
  });
});
