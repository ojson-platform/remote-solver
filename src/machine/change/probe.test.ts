import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';

import {vi} from 'vitest';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {probeArchive} from './fold.ts';
import {openspecExecutable} from './__tests__/openspec-cli.ts';
import {
  rmThrowaway,
  throwawayWithArchive,
  type ThrowawayCheckout,
} from './__tests__/throwaway-checkout.ts';

function status(root: string): string {
  return execFileSync('git', ['status', '--porcelain'], {cwd: root, encoding: 'utf8'});
}

function keptBaseline(): string {
  return `## Purpose
Placeholder purpose for the probe capability in this throwaway checkout fixture.

## Requirements

### Requirement: Keep

The system SHALL keep the keep behavior.

#### Scenario: keep
- **WHEN** w
- **THEN** t
`;
}

spec('spec-archive', () => {
  vi.setConfig({testTimeout: 20_000});
  requirement('Specify probes the fold before publish', () => {
    scenario('A probe that fails after the fold keeps the checkout', async () => {
      let box: ThrowawayCheckout | undefined;
      try {
        box = throwawayWithArchive(
          '8801',
          {
            baselines: {probe: keptBaseline()},
            change: {
              proposal: '## Outcome\n\nRemove the only requirement.\n',
              deltas: {
                probe: `## REMOVED Requirements
### Requirement: Keep
`,
              },
            },
          },
          {fold: false},
        );
        const before = status(box.root);
        await assert.rejects(
          async () => probeArchive(box!.root, '8801', openspecExecutable()),
          /requirement/,
        );
        assert.equal(status(box.root), before);
        assert.equal(existsSync(path.join(box.root, 'openspec', 'changes', 'issue-8801')), true);
        assert.equal(
          existsSync(path.join(box.root, 'openspec', 'changes', 'archive', 'issue-8801')),
          false,
        );
        assert.match(
          readFileSync(path.join(box.root, 'openspec', 'specs', 'probe', 'spec.md'), 'utf8'),
          /### Requirement: Keep/,
        );
      } finally {
        if (box) {
          rmThrowaway(box.root);
        }
      }
    });

    scenario('A probe that passes keeps the checkout', async () => {
      let box: ThrowawayCheckout | undefined;
      try {
        box = throwawayWithArchive(
          'LAVKAOPSCORE-8802',
          {
            baselines: {probe: keptBaseline()},
            change: {
              proposal: '## Outcome\n\nAdd one requirement.\n',
              deltas: {
                probe: `## ADDED Requirements
### Requirement: Extra

The system SHALL apply extra behavior.

#### Scenario: extra
- **WHEN** e
- **THEN** x
`,
              },
            },
          },
          {fold: false},
        );
        const before = status(box.root);
        probeArchive(box.root, 'LAVKAOPSCORE-8802', openspecExecutable());
        assert.equal(status(box.root), before);
        assert.equal(
          existsSync(path.join(box.root, 'openspec', 'changes', 'issue-LAVKAOPSCORE-8802')),
          true,
        );
        const baseline = readFileSync(
          path.join(box.root, 'openspec', 'specs', 'probe', 'spec.md'),
          'utf8',
        );
        assert.match(baseline, /### Requirement: Keep/);
        assert.equal(baseline.includes('### Requirement: Extra'), false);
      } finally {
        if (box) {
          rmThrowaway(box.root);
        }
      }
    });
  });
});
