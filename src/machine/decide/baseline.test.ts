import assert from 'node:assert/strict';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {readChange} from '../change/change.ts';
import {decide} from './policy.ts';
import type {FileSource} from '../port.ts';
import {action, change, issue, pull} from '../__tests__/harness.ts';

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
    scenario('A fenced Modified id finds its baseline', () => {
      const proposal = [
        '## Capabilities',
        '### Modified',
        '- `cache-first` keep the first hit',
        '- `board`: stations',
        '',
      ].join('\n');
      const source: FileSource = {
        exists: rel =>
          rel === 'openspec/changes/issue-1/proposal.md' ||
          rel === 'openspec/specs/cache-first/spec.md' ||
          rel === 'openspec/specs/board/spec.md',
        read: () => proposal,
        list: () => [],
      };
      const view = readChange('1', source);
      assert.deepEqual(view.capabilities, ['cache-first', 'board']);
      assert.deepEqual(view.missingBaseline, []);
      const decision = decide(issue(1, ['sdd:specifying']), [], [pull(9)], view);
      assert.notEqual(action(decision), 'restore-baseline');
    });
    scenario('A fenced Modified id with no file is restored', () => {
      const source: FileSource = {
        exists: rel => rel === 'openspec/changes/issue-1/proposal.md',
        read: () => '## Capabilities\n### Modified\n- `cache-first` keep the first hit\n',
        list: () => [],
      };
      const view = readChange('1', source);
      assert.deepEqual(view.missingBaseline, ['cache-first']);
      const decision = decide(issue(1, ['sdd:specifying']), [], [pull(9)], view);
      assert.equal(action(decision), 'restore-baseline');
    });
  });

  requirement('An Added shelf is published before the delta', () => {
    scenario('An unjudged Added id is restored before the delta', () => {
      const source: FileSource = {
        exists: rel => rel === 'openspec/changes/issue-1/proposal.md',
        read: () => '## Capabilities\n### Added\n- cache-first new\n',
        list: () => [],
      };
      const view = readChange('1', source);
      assert.deepEqual(view.missingBaseline, []);
      assert.deepEqual(view.unjudged, ['cache-first']);
      const decision = decide(issue(1, ['sdd:specifying']), [], [pull(9)], view);
      assert.equal(action(decision), 'restore-baseline');
    });
    scenario('A judged Added id is not restored again', () => {
      const source: FileSource = {
        exists: rel => rel === 'openspec/changes/issue-1/proposal.md',
        read: () => '## Capabilities\n### Added\n- cache-first new\n\n## Shelf\n- cache-first\n',
        list: () => [],
      };
      const view = readChange('1', source);
      assert.deepEqual(view.unjudged, []);
      const decision = decide(issue(1, ['sdd:specifying']), [], [pull(9)], view);
      assert.notEqual(action(decision), 'restore-baseline');
    });
    scenario('An Added id is not restored once a delta exists', () => {
      const decision = decide(
        issue(1, ['sdd:specifying']),
        [],
        [pull(9)],
        change({proposal: true, delta: true, unjudged: ['cache-first']}),
      );
      assert.notEqual(action(decision), 'restore-baseline');
    });
  });
});
