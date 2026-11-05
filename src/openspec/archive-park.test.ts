import assert from 'node:assert/strict';
import {existsSync, readdirSync} from 'node:fs';
import path from 'node:path';

import {vi} from 'vitest';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {
  rmThrowaway,
  throwawayWithArchive,
  type ThrowawayCheckout,
} from './throwaway-checkout.ts';

spec('archive-park', () => {
  vi.setConfig({testTimeout: 20_000});
  requirement('The archive parks the change', () => {
    scenario('The OpenSpec CLI parks the change under the dated archive path', () => {
      let box: ThrowawayCheckout | undefined;
      try {
        box = throwawayWithArchive('park', {
          baselines: {
            'park-cap': `## Purpose
Placeholder purpose for park-cap in this throwaway checkout fixture.

## Requirements

### Requirement: One

The system SHALL keep one behavior.

#### Scenario: one
- **WHEN** w
- **THEN** t
`,
          },
          change: {
            proposal: '## Outcome\n\nPark the change under archive.\n',
            deltas: {
              'park-cap': `## ADDED Requirements
### Requirement: Two

The system SHALL apply two behavior.

#### Scenario: two
- **WHEN** w
- **THEN** t
`,
            },
          },
        });
        const activeChange = path.join(box.root, 'openspec', 'changes', box.issueKey);
        assert.equal(existsSync(activeChange), false);

        const archiveRoot = path.join(box.root, 'openspec', 'changes', 'archive');
        const parkedName = readdirSync(archiveRoot).find((name) => name.endsWith(`-${box.issueKey}`));
        assert.ok(parkedName, `expected dated archive dir for ${box.issueKey}`);
        assert.match(parkedName, /^\d{4}-\d{2}-\d{2}-issue-/);

        const parkedChange = path.join(archiveRoot, parkedName);
        assert.equal(existsSync(path.join(parkedChange, 'proposal.md')), true);
        assert.equal(
          existsSync(path.join(parkedChange, 'specs', 'park-cap', 'spec.md')),
          true,
        );
      } finally {
        if (box) {
          rmThrowaway(box.root);
        }
      }
    });
  });
});
