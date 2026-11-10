import assert from 'node:assert/strict';
import {test} from 'vitest';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {memoryPorts} from '../adapters/github.ts';
import {change, issue, pull} from './harness.ts';
import {setPhase} from './labels.ts';
import {phaseOf, phaseRank, reachedRank} from './phase.ts';
import {accept, cycleRecord, decide, settle} from './policy.ts';

test('a gate label does not replace the writing phase', () => {
  assert.equal(phaseOf(['sdd:proposing', 'sdd:proposed']), 'proposing');
  assert.equal(phaseOf(['sdd:specifying', 'sdd:specified']), 'specifying');
  assert.equal(phaseOf(['sdd:designing', 'sdd:designed']), 'designing');
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
    scenario('Accepted wins over cancelled on the rank', () => {
      assert.equal(phaseOf(['sdd:accepted', 'sdd:cancelled']), 'accepted');
      assert.equal(reachedRank(['sdd:accepted', 'sdd:cancelled']), phaseRank('accepted'));
      assert.equal(reachedRank(['sdd:cancelled', 'sdd:tasking']), -1);
    });
  });

  requirement('A gate label is consent, not a phase', () => {
    scenario('The writing phase stays when the gate label is also on', () => {
      assert.equal(phaseOf(['sdd:proposing', 'sdd:proposed']), 'proposing');
    });
    scenario('A lone gate label is the writing phase it closes', () => {
      assert.equal(phaseOf(['sdd:proposed']), 'proposing');
      assert.equal(phaseOf(['sdd:specified']), 'specifying');
      assert.equal(phaseOf(['sdd:designed']), 'designing');
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

  requirement('The decision reads one cycle record', () => {
    scenario('A gate label and the phase it closes are one phase before the decision', () => {
      const recorded = issue(1, ['sdd:proposing', 'sdd:proposed']);
      const decision = decide(
        issue(1, ['sdd:proposing']),
        [],
        [pull(9)],
        change({proposal: true}),
        cycleRecord(recorded, ''),
      );
      assert.equal(decision.kind, 'advance');
      if (decision.kind === 'advance') {
        assert.equal(decision.to, 'specifying');
      }
    });
    scenario('An archive directory without the tip line is not folded', () => {
      const row = issue(1, ['sdd:tasking']);
      const decision = decide(
        row,
        [],
        [],
        change({archived: true, proposal: true, design: true, tasks: true}),
        cycleRecord(row, ''),
      );
      assert.notEqual(decision.kind === 'agent' ? decision.action : decision.kind, 'unarchive');
    });
    scenario('A tip line without the archive directory is folded', () => {
      const row = issue(1, ['sdd:tasking']);
      const decision = decide(
        row,
        [],
        [],
        change({design: true, tasks: true}),
        cycleRecord(row, 'Sdd-Archive: issue-1\n'),
      );
      assert.equal(decision.kind, 'unarchive');
    });
    scenario('Accept uses the same record', () => {
      const recorded = issue(1, ['sdd:cycle', 'sdd:designing', 'sdd:designed']);
      const decision = accept(
        issue(1, ['sdd:cycle', 'sdd:proposing']),
        change({proposal: true, delta: true, design: true}),
        cycleRecord(recorded, ''),
      );
      assert.equal(decision.kind, 'advance');
      if (decision.kind === 'advance') {
        assert.equal(decision.to, 'tasking');
      }
    });
  });
});
