import assert from 'node:assert/strict';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {readChange} from './change.ts';
import {decide} from './policy.ts';
import type {FileSource} from './port.ts';
import {action, change, issue, pull} from './harness.ts';

spec('baseline', () => {
  requirement('A Modified id without a baseline is restored first', () => {
    scenario('Specifying restores a missing baseline before the delta', () => {
      const decision = decide(
        issue(1, ['sdd:specifying']),
        [],
        [pull(9)],
        change({proposal: true, missingBaseline: ['cache-first']}),
      );
      assert.equal(action(decision), 'restore-baseline');
    });
    scenario('A spec thread waits for the missing baseline', () => {
      const decision = decide(
        issue(1, ['sdd:specifying']),
        [],
        [pull(9, {review: {unanswered: false, rollback: 'specifying', layers: ['spec']}})],
        change({proposal: true, delta: true, missingBaseline: ['cache-first']}),
      );
      assert.equal(action(decision), 'restore-baseline');
    });
    scenario('An Added id without a baseline does not restore', () => {
      const source: FileSource = {
        exists: rel => rel === 'openspec/changes/issue-1/proposal.md',
        read: () => '## Capabilities\n### Added\n- cache-first new\n',
        list: () => [],
      };
      const view = readChange('1', source);
      assert.deepEqual(view.missingBaseline, []);
      const decision = decide(issue(1, ['sdd:specifying']), [], [pull(9)], view);
      assert.notEqual(action(decision), 'restore-baseline');
    });
  });
});
