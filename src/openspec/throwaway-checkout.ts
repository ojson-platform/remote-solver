import {execFileSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

import {archiveIssue, runOpenspec} from './openspec-cli.ts';

export type ThrowawayCheckout = {
  root: string;
  issueKey: string;
};

type BaselineMap = Record<string, string>;

type ChangeInput = {
  proposal: string;
  deltas: Record<string, string>;
};

function git(root: string, args: string[]): void {
  execFileSync('git', args, {cwd: root, stdio: 'ignore'});
}

export function rmThrowaway(root: string): void {
  rmSync(root, {recursive: true, force: true});
}

export function baselineSpec(root: string, capability: string): string {
  return readFileSync(path.join(root, 'openspec', 'specs', capability, 'spec.md'), 'utf8');
}

export function foldOrderDelta(): string {
  return `## RENAMED Requirements
- FROM: \`### Requirement: Alpha\`
- TO: \`### Requirement: Gamma\`

## REMOVED Requirements
### Requirement: Beta

## MODIFIED Requirements
### Requirement: Gamma

The system SHALL apply gamma modified behavior.

#### Scenario: gamma scenario
- **WHEN** x
- **THEN** y

## ADDED Requirements
### Requirement: Delta

The system SHALL apply delta behavior.

#### Scenario: delta scenario
- **WHEN** a
- **THEN** b
`;
}

export function throwawayWithArchive(
  slug: string,
  input: {baselines: BaselineMap; change: ChangeInput},
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

  archiveIssue(root, issueKey);

  return {root, issueKey};
}
