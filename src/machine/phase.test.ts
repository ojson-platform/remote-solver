import assert from 'node:assert/strict';
import {test} from 'vitest';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {memoryPorts} from '../adapters/github.ts';
import {change, issue} from './harness.ts';
import {setPhase} from './labels.ts';
import {phaseOf} from './phase.ts';
import {settle} from './policy.ts';

test('a gate label wins over the phase it closes', () => {
  assert.equal(phaseOf(['sdd:proposing', 'sdd:proposed']), 'proposed');
  assert.equal(phaseOf(['sdd:specifying', 'sdd:specified']), 'specified');
  assert.equal(phaseOf(['sdd:designing', 'sdd:designed']), 'designed');
  assert.equal(phaseOf(['sdd:accepting', 'sdd:accepted']), 'accepted');
});

test('otherwise the earliest phase label wins', () => {
  assert.equal(phaseOf(['sdd:proposing', 'sdd:specified']), 'proposing');
  assert.equal(phaseOf(['sdd:specifying', 'sdd:tasking']), 'specifying');
  assert.equal(phaseOf(['sdd:tasking']), 'tasking');
  assert.equal(phaseOf(['sdd:cycle']), null);
});

spec('phase', () => {
  requirement('A cycle with no phase enters proposing', () => {
    scenario('The cycle label alone enters proposing', () => {
      const settled = settle(issue(1, ['sdd:cycle']), [], [], change());
      assert.deepEqual(
        settled.transitions.map(step => step.to),
        ['proposing'],
      );
      assert.ok(settled.labels.includes('sdd:proposing'));
    });
  });

  requirement('Cancelled ends the cycle', () => {
    scenario('Cancelled with a phase label is done', () => {
      const settled = settle(issue(1, ['sdd:cancelled', 'sdd:proposing']), [], [], change());
      assert.equal(settled.decision.kind, 'done');
      assert.deepEqual(settled.transitions, []);
    });
  });

  requirement('Accepted wins over every other phase label', () => {
    scenario('Accepted wins over accepting', () => {
      assert.equal(phaseOf(['sdd:accepting', 'sdd:accepted']), 'accepted');
    });
  });

  requirement('A gate label wins only over the phase it closes', () => {
    scenario('The gate wins over the phase it closes', () => {
      assert.equal(phaseOf(['sdd:proposing', 'sdd:proposed']), 'proposed');
    });
    scenario('Otherwise the earliest label wins', () => {
      assert.equal(phaseOf(['sdd:proposing', 'sdd:specified']), 'proposing');
    });
  });

  requirement('The machine does not set a gate label', () => {
    scenario('Set refuses a gate label', async () => {
      const {tracker} = memoryPorts({
        issues: [
          {key: '7', title: '#7: title', body: '', state: 'OPEN', labels: ['sdd:proposing']},
        ],
      });
      await assert.rejects(setPhase('7', 'proposed', tracker), /gate label sdd:proposed/);
      assert.deepEqual(await tracker.labels('7'), ['sdd:proposing']);
    });
  });
});
