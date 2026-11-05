import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {vi} from 'vitest';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

vi.setConfig({testTimeout: 20_000});

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const acceptStep = path.join(packageRoot, 'skills/sdd-flow/steps/accept.md');
const openspecConfig = path.join(packageRoot, 'openspec/config.yaml');

const FIXTURE_KEY = '88';
const FIXTURE_CAPABILITY = 'archive-fold-cap';
const REMOVAL_MARKER = 'REMOVAL-PROSE-SHOULD-NOT-COPY-TO-BASELINE';

function git(root: string, args: string[]): string {
  return execFileSync('git', args, {cwd: root, encoding: 'utf8'});
}

function commitCount(root: string): number {
  const out = git(root, ['rev-list', '--count', 'HEAD']).trim();
  return Number(out);
}

function tipMessage(root: string): string {
  return git(root, ['log', '-1', '--format=%B']);
}

const DATED_ARCHIVE_DIR = /^\d{4}-\d{2}-\d{2}-issue-\d+$/;

function findDatedArchiveDir(root: string, key: string): string | undefined {
  const archiveRoot = path.join(root, 'openspec', 'changes', 'archive');
  if (!existsSync(archiveRoot)) {
    return undefined;
  }
  return readdirSync(archiveRoot).find(
    name => DATED_ARCHIVE_DIR.test(name) && name.endsWith(`issue-${key}`),
  );
}

/** Accept archive path through one commit, as `accept.md` ## archive describes. */
function acceptArchiveCommit(root: string, key: string): void {
  runAcceptArchivePath(root);
  const dated = findDatedArchiveDir(root, key);
  assert.ok(dated, 'openspec archive writes a dated archive directory');
  const archiveRoot = path.join(root, 'openspec', 'changes', 'archive');
  renameSync(path.join(archiveRoot, dated), path.join(archiveRoot, `issue-${key}`));
  execFileSync('openspec', ['validate', '--all', '--strict', '--no-interactive'], {
    cwd: root,
    stdio: 'ignore',
  });
  git(root, ['add', '-A']);
  git(root, ['commit', '-m', 'archive fold', '-m', `Sdd-Archive: issue-${key}`]);
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
      'Baseline purpose stays on this capability after archive folds the delta into the spec.',
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

  requirement('One commit holds the fold', () => {
    scenario('The step still makes one commit', () => {
      const section = archiveSection(readFileSync(acceptStep, 'utf8'));
      assert.match(section, /one commit/i);
      assert.doesNotMatch(section, /second commit|two commit/i);
      const root = mixedDeltaFixture();
      try {
        const before = commitCount(root);
        acceptArchiveCommit(root, FIXTURE_KEY);
        assert.equal(commitCount(root), before + 1);
      } finally {
        rmSync(root, {recursive: true, force: true});
      }
    });

    scenario('Its body contains a line Sdd-Archive: issue-<key>', () => {
      const section = archiveSection(readFileSync(acceptStep, 'utf8'));
      assert.match(section, /Sdd-Archive: issue-<issue>/);
      const root = mixedDeltaFixture();
      try {
        acceptArchiveCommit(root, FIXTURE_KEY);
        assert.match(tipMessage(root), /^Sdd-Archive: issue-88$/m);
      } finally {
        rmSync(root, {recursive: true, force: true});
      }
    });

    scenario('That commit stays the tip until unarchive', () => {
      const section = archiveSection(readFileSync(acceptStep, 'utf8'));
      assert.match(section, /Nothing is committed after it until unarchive/);
      const root = mixedDeltaFixture();
      try {
        acceptArchiveCommit(root, FIXTURE_KEY);
        const archiveTip = git(root, ['rev-parse', 'HEAD']).trim();
        assert.match(tipMessage(root), /^Sdd-Archive: issue-88$/m);
        writeFileSync(path.join(root, 'README.md'), 'later\n');
        git(root, ['add', 'README.md']);
        git(root, ['commit', '-m', 'after archive']);
        assert.notEqual(git(root, ['rev-parse', 'HEAD']).trim(), archiveTip);
        assert.match(
          git(root, ['log', '-1', '--format=%B', archiveTip]),
          /^Sdd-Archive: issue-88$/m,
        );
      } finally {
        rmSync(root, {recursive: true, force: true});
      }
    });

    scenario('The command archives to openspec/changes/archive/<date>-issue-<key>/', () => {
      const root = mixedDeltaFixture();
      try {
        runAcceptArchivePath(root);
        const dated = findDatedArchiveDir(root, FIXTURE_KEY);
        assert.ok(dated);
        assert.match(dated, DATED_ARCHIVE_DIR);
        assert.ok(
          existsSync(path.join(root, 'openspec', 'changes', 'archive', dated, 'specs', FIXTURE_CAPABILITY)),
        );
      } finally {
        rmSync(root, {recursive: true, force: true});
      }
    });

    scenario(
      'Before the commit, the step moves that directory to openspec/changes/archive/issue-<key>/',
      () => {
        const section = archiveSection(readFileSync(acceptStep, 'utf8'));
        assert.match(
          section,
          /openspec\/changes\/archive\/<date>-issue-<issue>\/.*openspec\/changes\/archive\/issue-<issue>/s,
        );
        const root = mixedDeltaFixture();
        try {
          acceptArchiveCommit(root, FIXTURE_KEY);
          assert.equal(findDatedArchiveDir(root, FIXTURE_KEY), undefined);
          assert.ok(
            existsSync(
              path.join(root, 'openspec', 'changes', 'archive', `issue-${FIXTURE_KEY}`, 'specs', FIXTURE_CAPABILITY),
            ),
          );
        } finally {
          rmSync(root, {recursive: true, force: true});
        }
      },
    );

    scenario('openspec validate --all --strict --no-interactive still runs before the commit', () => {
      const section = archiveSection(readFileSync(acceptStep, 'utf8'));
      const validate = section.indexOf('openspec validate --all --strict --no-interactive');
      const publish = section.indexOf('Publish');
      assert.ok(validate >= 0 && publish > validate);
      const root = mixedDeltaFixture();
      try {
        runAcceptArchivePath(root);
        const dated = findDatedArchiveDir(root, FIXTURE_KEY);
        assert.ok(dated);
        const archiveRoot = path.join(root, 'openspec', 'changes', 'archive');
        renameSync(
          path.join(archiveRoot, dated),
          path.join(archiveRoot, `issue-${FIXTURE_KEY}`),
        );
        execFileSync('openspec', ['validate', '--all', '--strict', '--no-interactive'], {
          cwd: root,
          stdio: 'ignore',
        });
        const uncommitted = git(root, ['status', '--porcelain']).trim();
        assert.ok(uncommitted.length > 0, 'validate runs before the archive commit');
      } finally {
        rmSync(root, {recursive: true, force: true});
      }
    });

    scenario('The archive commit is the tip', () => {
      const root = mixedDeltaFixture();
      try {
        acceptArchiveCommit(root, FIXTURE_KEY);
        assert.match(tipMessage(root), /^Sdd-Archive: issue-88$/m);
        assert.ok(
          existsSync(path.join(root, 'openspec', 'changes', 'archive', `issue-${FIXTURE_KEY}`)),
        );
        assert.equal(existsSync(path.join(root, 'openspec', 'changes', `issue-${FIXTURE_KEY}`)), false);
      } finally {
        rmSync(root, {recursive: true, force: true});
      }
    });
  });
});
