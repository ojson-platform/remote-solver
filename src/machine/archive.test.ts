import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const acceptStep = path.join(packageRoot, 'skills/sdd-flow/steps/accept.md');
const openspecConfig = path.join(packageRoot, 'openspec/config.yaml');

const FIXTURE_KEY = '88';
const FIXTURE_CAPABILITY = 'archive-fold-cap';
const REMOVAL_MARKER = 'REMOVAL-PROSE-SHOULD-NOT-COPY-TO-BASELINE';

function git(root: string, args: string[]): void {
  execFileSync('git', args, {cwd: root, stdio: 'ignore'});
}

function archiveSection(body: string): string {
  const section = body.split(/^## /m).find(part => part.startsWith('archive\n'));
  assert.ok(section, 'accept step has ## archive');
  return section;
}

function requirementHeadings(specText: string): string[] {
  return [...specText.matchAll(/^### Requirement: (.+)$/gm)].map(match => match[1].trim());
}

function mixedDeltaFixture(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'sandcastle-archive-'));
  git(root, ['init', '-b', 'master']);
  git(root, ['config', 'user.email', 'archive@test.example']);
  git(root, ['config', 'user.name', 'Archive Test']);

  mkdirSync(path.join(root, 'openspec', 'specs', FIXTURE_CAPABILITY), {recursive: true});
  mkdirSync(
    path.join(root, 'openspec', 'changes', `issue-${FIXTURE_KEY}`, 'specs', FIXTURE_CAPABILITY),
    {recursive: true},
  );
  copyFileSync(openspecConfig, path.join(root, 'openspec', 'config.yaml'));

  writeFileSync(
    path.join(root, 'openspec', 'specs', FIXTURE_CAPABILITY, 'spec.md'),
    [
      `# ${FIXTURE_CAPABILITY}`,
      '',
      '## Purpose',
      '',
      'Baseline purpose stays.',
      '',
      '## Requirements',
      '',
      '### Requirement: Old name',
      '',
      'The system SHALL keep old behavior.',
      '',
      '#### Scenario: Old scenario',
      '',
      '- **WHEN** old',
      '- **THEN** old',
      '',
      '### Requirement: To remove',
      '',
      REMOVAL_MARKER,
      '',
      '#### Scenario: Remove me',
      '',
      '- **WHEN** remove',
      '- **THEN** remove',
      '',
    ].join('\n'),
  );

  writeFileSync(
    path.join(root, 'openspec', 'changes', `issue-${FIXTURE_KEY}`, 'specs', FIXTURE_CAPABILITY, 'spec.md'),
    [
      '## RENAMED Requirements',
      '',
      '- FROM: `### Requirement: Old name`',
      '- TO: `### Requirement: New name`',
      '',
      '## REMOVED Requirements',
      '',
      '### Requirement: To remove',
      '',
      '## MODIFIED Requirements',
      '',
      '### Requirement: New name',
      '',
      'The system SHALL apply modified body after rename.',
      '',
      '#### Scenario: New scenario',
      '',
      '- **WHEN** new',
      '- **THEN** new',
      '',
      '## ADDED Requirements',
      '',
      '### Requirement: Added req',
      '',
      'The system SHALL append added requirement.',
      '',
      '#### Scenario: Added scenario',
      '',
      '- **WHEN** added',
      '- **THEN** added',
      '',
    ].join('\n'),
  );

  writeFileSync(path.join(root, 'README.md'), 'fixture\n');
  git(root, ['add', '-A']);
  git(root, ['commit', '-m', 'init']);
  return root;
}

function runAcceptArchivePath(root: string): string {
  return execFileSync('openspec', ['archive', `issue-${FIXTURE_KEY}`, '--yes'], {
    cwd: root,
    encoding: 'utf8',
  });
}

spec('spec-archive', () => {
  requirement('The accept step folds a delta with the archive command', () => {
    scenario(
      'The accept step folds a delta with the archive command instead of editing the baseline by hand',
      () => {
        const section = archiveSection(readFileSync(acceptStep, 'utf8'));
        assert.match(section, /openspec archive issue-<issue> --yes/);
        assert.doesNotMatch(
          section,
          /Fold `openspec\/changes\/issue-<issue>\/specs\/` into `openspec\/specs\/<capability>\/spec\.md`/,
        );
      },
    );

    scenario('The command applies RENAMED, then REMOVED, then MODIFIED, then ADDED', () => {
      const section = archiveSection(readFileSync(acceptStep, 'utf8'));
      assert.match(section, /openspec archive issue-<issue> --yes/);
      const renamed = section.indexOf('RENAMED');
      const removed = section.indexOf('REMOVED');
      const modified = section.indexOf('MODIFIED');
      const added = section.indexOf('ADDED');
      assert.ok(renamed >= 0 && removed > renamed && modified > removed && added > modified);
    });

    scenario('The baseline shows the fold in section order', () => {
      const root = mixedDeltaFixture();
      try {
        runAcceptArchivePath(root);
        const baseline = readFileSync(
          path.join(root, 'openspec', 'specs', FIXTURE_CAPABILITY, 'spec.md'),
          'utf8',
        );
        assert.equal(baseline.includes(REMOVAL_MARKER), false);
        assert.equal(baseline.includes('### Requirement: Old name'), false);
        assert.equal(baseline.includes('### Requirement: To remove'), false);
        assert.match(baseline, /The system SHALL apply modified body after rename\./);
        assert.match(baseline, /The system SHALL append added requirement\./);
        assert.deepEqual(requirementHeadings(baseline), ['New name', 'Added req']);
      } finally {
        rmSync(root, {recursive: true, force: true});
      }
    });
  });
});
