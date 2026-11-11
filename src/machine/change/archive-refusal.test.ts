import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

import {vi} from 'vitest';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {runOpenspec} from './__tests__/openspec-cli.ts';
import {rmThrowaway, type ThrowawayCheckout} from './__tests__/throwaway-checkout.ts';

spec('archive-refusal', () => {
  vi.setConfig({testTimeout: 20_000});
  requirement('The archive refuses a baseline that would have no requirement', () => {
    scenario('The archive refuses with a non-zero exit and does not commit', () => {
      let box: ThrowawayCheckout | undefined;
      try {
        box = throwawayBeforeArchive('refusal-empty', {
          baselines: {
            'refusal-cap': `## Purpose
Placeholder purpose for refusal-cap in this throwaway checkout fixture.

## Requirements

### Requirement: Only

The system SHALL keep the only behavior.

#### Scenario: only
- **WHEN** w
- **THEN** t
`,
          },
          change: {
            proposal: '## Outcome\n\nRemove the last requirement so the baseline would be empty.\n',
            deltas: {
              'refusal-cap': `## REMOVED Requirements
### Requirement: Only
`,
            },
          },
        });
        const headBefore = gitRevParse(box.root);
        const result = runOpenspec(box.root, ['archive', box.issueKey, '--yes']);
        assert.notEqual(result.status, 0, result.stderr || result.stdout);
        const headAfter = gitRevParse(box.root);
        assert.equal(headAfter, headBefore);
      } finally {
        if (box) {
          rmThrowaway(box.root);
        }
      }
    });
  });
});

function gitRevParse(root: string): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
}

function git(root: string, args: string[]): void {
  execFileSync('git', args, {cwd: root, stdio: 'ignore'});
}

function throwawayBeforeArchive(
  slug: string,
  input: {
    baselines: Record<string, string>;
    change: {proposal: string; deltas: Record<string, string>};
  },
): ThrowawayCheckout {
  const root = mkdtempSync(path.join(tmpdir(), `openspec-${slug}-`));
  git(root, ['init', '-b', 'master']);
  git(root, ['config', 'user.email', 'openspec-test@example.com']);
  git(root, ['config', 'user.name', 'OpenSpec Test']);

  const init = runOpenspec(root, ['init', '--tools', 'none', '--force']);
  if (init.status !== 0) {
    throw new Error(`openspec init failed: ${init.stderr || init.stdout}`);
  }

  for (const [capability, specBody] of Object.entries(input.baselines)) {
    const dir = path.join(root, 'openspec', 'specs', capability);
    mkdirSync(dir, {recursive: true});
    writeFileSync(path.join(dir, 'spec.md'), specBody);
  }

  git(root, ['add', '-A']);
  git(root, ['commit', '-m', 'baseline']);

  const issueKey = `issue-${slug}`;
  const changeRoot = path.join(root, 'openspec', 'changes', issueKey);
  mkdirSync(changeRoot, {recursive: true});
  writeFileSync(path.join(changeRoot, 'proposal.md'), input.change.proposal);

  for (const [capability, delta] of Object.entries(input.change.deltas)) {
    const dir = path.join(changeRoot, 'specs', capability);
    mkdirSync(dir, {recursive: true});
    writeFileSync(path.join(dir, 'spec.md'), delta);
  }

  const validate = runOpenspec(root, ['validate', '--all', '--strict', '--no-interactive']);
  if (validate.status !== 0) {
    throw new Error(`openspec validate failed: ${validate.stderr || validate.stdout}`);
  }

  return {root, issueKey};
}
