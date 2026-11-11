import assert from 'node:assert/strict';

import {vi} from 'vitest';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {
  baselineSpec,
  rmThrowaway,
  throwawayWithArchive,
  type ThrowawayCheckout,
} from './__tests__/throwaway-checkout.ts';

const EXISTING_PURPOSE =
  'Stable purpose text that must survive archive unchanged in this fixture.';

spec('archive-purpose', () => {
  vi.setConfig({testTimeout: 20_000});
  requirement('Purpose is written only for a spec that did not exist', () => {
    scenario('On a spec that did not exist, the archive writes placeholder Purpose', () => {
      let box: ThrowawayCheckout | undefined;
      try {
        box = throwawayWithArchive('purpose-new', {
          baselines: {},
          change: {
            proposal: '## Outcome\n\nAdd a capability that had no baseline.\n',
            deltas: {
              'purpose-new-cap': `## ADDED Requirements
### Requirement: First

The system SHALL apply first behavior.

#### Scenario: first
- **WHEN** w
- **THEN** t
`,
            },
          },
        });
        const text = baselineSpec(box.root, 'purpose-new-cap');
        assert.match(text, /^## Purpose\nTBD - created by archiving change/m);
        assert.match(text, /### Requirement: First/);
      } finally {
        if (box) {
          rmThrowaway(box.root);
        }
      }
    });

    scenario("The archive leaves an existing spec's Purpose unchanged", () => {
      let box: ThrowawayCheckout | undefined;
      try {
        box = throwawayWithArchive('purpose-kept', {
          baselines: {
            'purpose-kept-cap': `## Purpose
${EXISTING_PURPOSE}

## Requirements

### Requirement: One

The system SHALL keep one behavior.

#### Scenario: one
- **WHEN** w
- **THEN** t
`,
          },
          change: {
            proposal: '## Outcome\n\nAdd one requirement without touching Purpose.\n',
            deltas: {
              'purpose-kept-cap': `## ADDED Requirements
### Requirement: Two

The system SHALL apply two behavior.

#### Scenario: two
- **WHEN** w
- **THEN** t
`,
            },
          },
        });
        const text = baselineSpec(box.root, 'purpose-kept-cap');
        const [, purposeBody] = text.split('## Requirements', 1)[0].split(/^## Purpose\n/m);
        assert.equal(purposeBody?.trimEnd(), EXISTING_PURPOSE);
        assert.match(text, /### Requirement: Two/);
      } finally {
        if (box) {
          rmThrowaway(box.root);
        }
      }
    });
  });
});
