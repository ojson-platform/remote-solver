import assert from 'node:assert/strict';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {memoryPorts} from '../../adapters/tracker/github.ts';
import {readChange} from '../change/change.ts';
import {resolveIssue} from '../flow/flow.ts';
import {accept, decide, settle} from './policy.ts';
import {change, files, issue, pull, ready} from '../__tests__/harness.ts';

spec('review-gate', () => {
  requirement('The machine opens the review once', () => {
    scenario('A published proposal is asked once', async () => {
      const {tracker, review, calls} = memoryPorts({
        issues: [
          {
            key: '5',
            title: '#5: title',
            body: '',
            state: 'OPEN',
            labels: ['Sandcastle', 'sdd:cycle', 'sdd:proposing'],
          },
        ],
        pulls: {'5': [{id: '9', title: '#5: title', state: 'OPEN'}]},
      });
      const options = {
        tracker,
        review,
        files,
        queues: [{name: 'Sandcastle'}],
        change: {...readChange('5', files), proposal: true},
      };
      assert.equal((await resolveIssue('5', options)).kind, 'wait');
      assert.ok((await tracker.labels('5')).includes('sdd:wait-human'));
      const asks = () => calls.filter(call => call.includes('Review the proposal'));
      assert.equal(asks().length, 1);
      assert.match(asks()[0], /replace the label `sdd:proposing` with `sdd:proposed`/);
      assert.match(asks()[0], /sdd accept 5/);
      const held = await resolveIssue('5', options);
      assert.equal(asks().length, 1);
      assert.equal(held.kind, 'wait');
      if (held.kind === 'wait') {
        assert.deepEqual(held.gate, {artifact: 'proposal', from: 'proposing', to: 'proposed'});
      }
    });
    scenario('An open question is not the review gate', () => {
      const held = decide(
        issue(1, ['sdd:proposing', 'sdd:wait-human']),
        [],
        [pull(9)],
        change({proposal: true, openQuestions: 1}),
      );
      assert.equal(held.kind, 'wait');
      if (held.kind === 'wait') {
        assert.equal(held.gate, undefined);
        assert.equal(held.reason, 'sdd:wait-human is set on proposing. Do the ask on the issue.');
      }
    });
    scenario('A wait on implementing points at the ask', () => {
      const held = decide(
        issue(1, ['sdd:implementing', 'sdd:wait-human']),
        [],
        [pull(9)],
        change(),
      );
      assert.equal(held.kind, 'wait');
      if (held.kind === 'wait') {
        assert.equal(held.gate, undefined);
        assert.equal(
          held.reason,
          'sdd:wait-human is set on implementing. Do the ask on the issue.',
        );
      }
    });
  });

  requirement('An auto tag skips the review', () => {
    scenario('Auto-plan advances a ready proposal', () => {
      const decision = decide(
        issue(1, ['sdd:proposing', 'sdd:auto-plan']),
        [],
        [pull(9)],
        change({proposal: true}),
      );
      assert.deepEqual(decision, {
        kind: 'advance',
        issue: '1',
        to: 'specifying',
        reason: 'sdd:auto-plan',
      });
    });
    scenario('Auto-spec does not lift an open review', () => {
      const held = decide(
        issue(1, ['sdd:specifying', 'sdd:wait-human', 'sdd:auto-spec']),
        [],
        [pull(9)],
        change({proposal: true, delta: true}),
      );
      assert.equal(held.kind, 'wait');
      if (held.kind === 'wait') {
        assert.deepEqual(held.gate, {artifact: 'spec', from: 'specifying', to: 'specified'});
      }
    });
    scenario('Auto-spec advances a ready delta', () => {
      const decision = decide(
        issue(1, ['sdd:specifying', 'sdd:auto-spec']),
        [],
        [pull(9)],
        change({proposal: true, delta: true}),
      );
      assert.deepEqual(decision, {
        kind: 'advance',
        issue: '1',
        to: 'designing',
        reason: 'sdd:auto-spec',
      });
    });
    scenario('Auto-spec advances when no capability is named', () => {
      const decision = decide(
        issue(1, ['sdd:specifying', 'sdd:auto-spec']),
        [],
        [pull(9)],
        change({proposal: true}),
      );
      assert.deepEqual(decision, {
        kind: 'advance',
        issue: '1',
        to: 'designing',
        reason: 'sdd:auto-spec',
      });
    });
  });

  requirement('A person closes the gate on the issue', () => {
    scenario('A past review ask does not hold the next phase', async () => {
      const {tracker, review} = memoryPorts({
        issues: [
          {
            key: '5',
            title: '#5: title',
            body: '',
            state: 'OPEN',
            labels: ['Sandcastle', 'sdd:cycle', 'sdd:tasking'],
          },
        ],
        pulls: {'5': [{id: '9', title: '#5: title', state: 'OPEN'}]},
      });
      await tracker.comment(
        '5',
        'Review the design. To accept it, replace the label `sdd:designing` with `sdd:designed` on this issue, or run `sdd accept 5`.',
      );
      const decision = await resolveIssue('5', {
        tracker,
        review,
        files,
        queues: [{name: 'Sandcastle'}],
        change: {...readChange('5', files), design: true},
      });
      assert.equal(decision.kind, 'agent');
      if (decision.kind === 'agent') {
        assert.equal(decision.action, 'create-tasks');
        assert.equal(decision.reason, 'write tasks.md and publish it');
      }
    });
    scenario('Proposed on a ready proposal moves to specifying', async () => {
      const {tracker, review, calls} = memoryPorts({
        issues: [
          {
            key: '5',
            title: '#5: title',
            body: '',
            state: 'OPEN',
            labels: ['Sandcastle', 'sdd:cycle', 'sdd:proposing', 'sdd:proposed', 'sdd:wait-human'],
          },
        ],
        pulls: {'5': [{id: '9', title: '#5: title', state: 'OPEN'}]},
      });
      await resolveIssue('5', {
        tracker,
        review,
        files,
        queues: [{name: 'Sandcastle'}],
        change: {...readChange('5', files), proposal: true},
      });
      assert.ok((await tracker.labels('5')).includes('sdd:specifying'));
      assert.equal((await tracker.labels('5')).includes('sdd:wait-human'), true);
      assert.ok(calls.some(call => call.includes('sdd:accept proposing → specifying')));
      assert.ok(calls.some(call => call.includes('Review the spec')));
    });
    scenario('Specified over a missing delta drops the gate', async () => {
      const {tracker, review, calls} = memoryPorts({
        issues: [
          {
            key: '5',
            title: '#5: title',
            body: '',
            state: 'OPEN',
            labels: ['Sandcastle', 'sdd:cycle', 'sdd:specified'],
          },
        ],
        pulls: {'5': [{id: '9', title: '#5: title', state: 'OPEN'}]},
      });
      const options = {
        tracker,
        review,
        files,
        queues: [{name: 'Sandcastle'}],
        change: {...readChange('5', files), proposal: true, capabilities: ['section-text']},
      };
      const decision = await resolveIssue('5', options);
      assert.equal(decision.kind, 'agent');
      if (decision.kind === 'agent') {
        assert.equal(decision.action, 'create-initial-specs');
      }
      const labels = await tracker.labels('5');
      assert.ok(labels.includes('sdd:specifying'));
      assert.equal(labels.includes('sdd:specified'), false);
      assert.equal(calls.filter(call => call.startsWith('body:')).length, 0);
      await resolveIssue('5', options);
      assert.equal(calls.filter(call => call.startsWith('body:')).length, 0);
    });
    scenario('Specified with no named capability moves on', () => {
      const moved = settle(
        issue(1, ['sdd:cycle', 'sdd:specified']),
        [],
        [pull(9)],
        change({proposal: true}),
      );
      assert.deepEqual(
        moved.transitions.map(step => step.to),
        ['designing'],
      );
      assert.match(moved.transitions[0]?.comment ?? '', /sdd:accept specifying → designing/);
    });
    scenario('Designed over an open decision stays, then asks', () => {
      const open = change({proposal: true, delta: true, design: true, openDecisions: 1});
      const reverted = settle(issue(1, ['sdd:cycle', 'sdd:designed']), [], [pull(9)], open);
      assert.deepEqual(
        reverted.transitions.map(step => step.to),
        [],
      );
      assert.ok(reverted.labels.includes('sdd:designing'));
      assert.equal(reverted.labels.includes('sdd:designed'), false);
      assert.equal(reverted.decision.kind, 'wait');
      const closed = settle(issue(1, reverted.labels), [], [pull(9)], ready);
      assert.equal(closed.decision.kind, 'wait');
      if (closed.decision.kind === 'wait') {
        assert.deepEqual(closed.decision.gate, {
          artifact: 'design',
          from: 'designing',
          to: 'designed',
        });
      }
    });
  });

  requirement('Accept closes only a writing phase', () => {
    scenario('Accept advances a ready proposal', () => {
      const decision = accept(issue(1, ['sdd:cycle', 'sdd:proposing']), change({proposal: true}));
      assert.deepEqual(decision, {
        kind: 'advance',
        issue: '1',
        to: 'specifying',
        reason: 'proposing → specifying',
      });
    });
    scenario('Accept waits on an open question', () => {
      const blocked = accept(
        issue(1, ['sdd:cycle', 'sdd:proposing']),
        change({proposal: true, openQuestions: 1}),
      );
      assert.equal(blocked.kind, 'wait');
      if (blocked.kind === 'wait') {
        assert.match(blocked.reason, /Open questions/);
      }
    });
    scenario('Accept refuses accepting', () => {
      const decision = accept(issue(1, ['sdd:cycle', 'sdd:accepting']), change({archived: true}));
      assert.equal(decision.kind, 'wait');
    });
    scenario('Accept refuses an issue with no cycle label', () => {
      const decision = accept(issue(1, ['sdd:proposing']), change({proposal: true}));
      assert.equal(decision.kind, 'wait');
      if (decision.kind === 'wait') {
        assert.match(decision.reason, /sdd:cycle/);
      }
    });
  });
});
