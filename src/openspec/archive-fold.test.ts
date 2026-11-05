import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {openspecExecutable, runOpenspec} from './openspec-cli.ts';
import {
  baselineSpec,
  foldOrderDelta,
  rmThrowaway,
  throwawayWithArchive,
  type ThrowawayCheckout,
} from './throwaway-checkout.ts';

spec('archive-fold', () => {
  requirement('The archive applies a change delta in fold order', () => {
    scenario('The OpenSpec CLI applies a change delta onto baselines with openspec archive', () => {
      let box: ThrowawayCheckout | undefined;
      try {
        box = throwawayWithArchive('apply-delta', {
          baselines: {
            'fold-cap': baselineWithRequirement(
              'Keep',
              'The system SHALL keep the keep behavior.',
              'keep',
            ),
          },
          change: {
            proposal: '## Outcome\n\nApply one added requirement.\n',
            deltas: {
              'fold-cap': `## ADDED Requirements
### Requirement: Extra

The system SHALL apply extra behavior.

#### Scenario: extra
- **WHEN** e
- **THEN** x
`,
            },
          },
        });
        const text = baselineSpec(box.root, 'fold-cap');
        assert.match(text, /### Requirement: Keep/);
        assert.match(text, /### Requirement: Extra/);
        assert.match(text, /SHALL apply extra behavior/);
      } finally {
        if (box) {
          rmThrowaway(box.root);
        }
      }
    });

    scenario('The archive applies RENAMED, then REMOVED, then MODIFIED, then ADDED', () => {
      let box: ThrowawayCheckout | undefined;
      try {
        box = throwawayWithArchive('fold-order', {
          baselines: {
            'fold-order-cap': baselineAlphaBeta(),
          },
          change: {
            proposal: '## Outcome\n\nExercise all four delta sections.\n',
            deltas: {
              'fold-order-cap': foldOrderDelta(),
            },
          },
        });
        const text = baselineSpec(box.root, 'fold-order-cap');
        assert.doesNotMatch(text, /### Requirement: Alpha/);
        assert.doesNotMatch(text, /### Requirement: Beta/);
        assert.match(text, /### Requirement: Gamma/);
        assert.match(text, /SHALL apply gamma modified behavior/);
        assert.match(text, /### Requirement: Delta/);
        assert.match(text, /SHALL apply delta behavior/);
      } finally {
        if (box) {
          rmThrowaway(box.root);
        }
      }
    });

    scenario('Remote-solver assumes the CLI already behaves this way', () => {
      const exe = openspecExecutable();
      assert.match(exe, /openspec$/);
      assert.equal(runOpenspec(process.cwd(), ['--version']).status, 0);
      assert.equal(runOpenspec(process.cwd(), ['validate', '--help']).status, 0);
      const cli = readFileSync(new URL('./openspec-cli.ts', import.meta.url), 'utf8');
      assert.match(cli, /spawnSync\(\s*openspecExecutable\(\)/);
      assert.doesNotMatch(cli, /RENAMED Requirements/);
      assert.doesNotMatch(cli, /MODIFIED Requirements/);
    });
  });
});

function baselineWithRequirement(
  name: string,
  body: string,
  scenarioName: string,
): string {
  return `## Purpose
Placeholder purpose for fold-cap capability in this throwaway checkout fixture.

## Requirements

### Requirement: ${name}

${body}

#### Scenario: ${scenarioName}
- **WHEN** w
- **THEN** t
`;
}

function baselineAlphaBeta(): string {
  return `## Purpose
Placeholder purpose for fold-order-cap capability in this throwaway checkout fixture.

## Requirements

### Requirement: Alpha

The system SHALL keep alpha behavior.

#### Scenario: alpha
- **WHEN** a
- **THEN** a

### Requirement: Beta

The system SHALL keep beta behavior.

#### Scenario: beta
- **WHEN** b
- **THEN** b
`;
}
