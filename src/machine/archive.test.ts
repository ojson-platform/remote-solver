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

const EMPTY_BASELINE_FIXTURE_KEY = '90';
const EMPTY_BASELINE_CAPABILITY = 'archive-refusal-cap';

const NEW_CAP_FIXTURE_KEY = '89';
const NEW_CAP_CAPABILITY = 'archive-purpose-new';
const NEW_CAP_PROPOSAL_GIST = 'gist words after the capability id in the proposal';
const EXISTING_BASELINE_PURPOSE =
  'Baseline purpose stays on this capability after archive folds the delta into the spec.';

const ARCHIVE_PLACEHOLDER_PURPOSE = /TBD - created by archiving change/;

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
  runAcceptArchivePath(root, key);
  const dated = findDatedArchiveDir(root, key);
  assert.ok(dated, 'openspec archive writes a dated archive directory');
  const archiveRoot = path.join(root, 'openspec', 'changes', 'archive');
  renameSync(path.join(archiveRoot, dated), path.join(archiveRoot, `issue-${key}`));
  applyPurposeFromProposal(root, key);
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

function purposeLine(specText: string): string {
  const match = specText.match(/(?:^|\n)## Purpose\r?\n(?:\r?\n)?(.+?)(?:\r?\n## |\s*$)/s);
  assert.ok(match, 'spec has a Purpose section');
  return match[1].trim();
}

function capabilityGistsFromProposal(proposalText: string): Map<string, string> {
  const gists = new Map<string, string>();
  for (const match of proposalText.matchAll(/^- `([^`]+)` (.+)$/gm)) {
    gists.set(match[1], match[2].trim());
  }
  return gists;
}

function replacePurpose(specText: string, purpose: string): string {
  return specText.replace(
    /(?:^|\n)## Purpose\r?\n(?:\r?\n)?.+?(?=\r?\n## Requirements)/s,
    `\n## Purpose\n\n${purpose}`,
  );
}

/** Proposal gist on new specs only, as `accept.md` ## archive describes. */
function applyPurposeFromProposal(root: string, key: string): void {
  const proposalPath = path.join(
    root,
    'openspec',
    'changes',
    'archive',
    `issue-${key}`,
    'proposal.md',
  );
  if (!existsSync(proposalPath)) {
    return;
  }
  const gists = capabilityGistsFromProposal(readFileSync(proposalPath, 'utf8'));
  for (const [capability, gist] of gists) {
    const specPath = path.join(root, 'openspec', 'specs', capability, 'spec.md');
    if (!existsSync(specPath)) {
      continue;
    }
    const specText = readFileSync(specPath, 'utf8');
    if (!ARCHIVE_PLACEHOLDER_PURPOSE.test(purposeLine(specText))) {
      continue;
    }
    writeFileSync(specPath, replacePurpose(specText, gist));
  }
}

function newCapabilityOnlyFixture(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'sandcastle-archive-purpose-'));
  git(root, ['init', '-b', 'master']);
  git(root, ['config', 'user.email', 'archive@test.example']);
  git(root, ['config', 'user.name', 'Archive Test']);

  mkdirSync(
    path.join(root, 'openspec', 'changes', `issue-${NEW_CAP_FIXTURE_KEY}`, 'specs', NEW_CAP_CAPABILITY),
    {recursive: true},
  );
  copyFileSync(openspecConfig, path.join(root, 'openspec', 'config.yaml'));

  writeFileSync(
    path.join(root, 'openspec', 'changes', `issue-${NEW_CAP_FIXTURE_KEY}`, 'proposal.md'),
    [
      '## Capabilities',
      '',
      '### Added',
      '',
      `- \`${NEW_CAP_CAPABILITY}\` ${NEW_CAP_PROPOSAL_GIST}`,
      '',
      '### Modified',
      '',
    ].join('\n'),
  );

  writeFileSync(
    path.join(
      root,
      'openspec',
      'changes',
      `issue-${NEW_CAP_FIXTURE_KEY}`,
      'specs',
      NEW_CAP_CAPABILITY,
      'spec.md',
    ),
    [
      '## ADDED Requirements',
      '',
      '### Requirement: First req',
      '',
      'The system SHALL apply the added requirement after archive.',
      '',
      '#### Scenario: Added only',
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
      '#### Scenario: New scenario',
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

function runAcceptArchivePath(root: string, key: string = FIXTURE_KEY): string {
  return execFileSync('openspec', ['archive', `issue-${key}`, '--yes'], {
    cwd: root,
    encoding: 'utf8',
  });
}

function runArchiveMaybeRefused(root: string, key: string): {status: number | null; output: string} {
  try {
    const output = execFileSync('openspec', ['archive', `issue-${key}`, '--yes'], {
      cwd: root,
      encoding: 'utf8',
    });
    return {status: 0, output};
  } catch (error) {
    const err = error as NodeJS.ErrnoException & {status?: number; stdout?: string; stderr?: string};
    const output = `${err.stdout ?? ''}${err.stderr ?? ''}`;
    return {status: err.status ?? null, output};
  }
}

function emptyBaselineFixture(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'sandcastle-archive-refusal-'));
  git(root, ['init', '-b', 'master']);
  git(root, ['config', 'user.email', 'archive@test.example']);
  git(root, ['config', 'user.name', 'Archive Test']);

  mkdirSync(path.join(root, 'openspec', 'specs', EMPTY_BASELINE_CAPABILITY), {recursive: true});
  mkdirSync(
    path.join(
      root,
      'openspec',
      'changes',
      `issue-${EMPTY_BASELINE_FIXTURE_KEY}`,
      'specs',
      EMPTY_BASELINE_CAPABILITY,
    ),
    {recursive: true},
  );
  copyFileSync(openspecConfig, path.join(root, 'openspec/config.yaml'));

  writeFileSync(
    path.join(root, 'openspec/specs', EMPTY_BASELINE_CAPABILITY, 'spec.md'),
    [
      `# ${EMPTY_BASELINE_CAPABILITY}`,
      '',
      '## Purpose',
      '',
      'Baseline purpose long enough that openspec validation accepts this fixture spec file.',
      '',
      '## Requirements',
      '',
      '### Requirement: Only requirement',
      '',
      'The system SHALL keep this sole requirement until archive refuses the fold.',
      '',
      '#### Scenario: Sole scenario',
      '',
      '- **WHEN** sole',
      '- **THEN** sole',
      '',
    ].join('\n'),
  );

  writeFileSync(
    path.join(
      root,
      'openspec',
      'changes',
      `issue-${EMPTY_BASELINE_FIXTURE_KEY}`,
      'specs',
      EMPTY_BASELINE_CAPABILITY,
      'spec.md',
    ),
    ['## REMOVED Requirements', '', '### Requirement: Only requirement', ''].join('\n'),
  );

  writeFileSync(path.join(root, 'README.md'), 'fixture\n');
  git(root, ['add', '-A']);
  git(root, ['commit', '-m', 'init']);
  return root;
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

  requirement("A new spec's Purpose is the proposal line", () => {
    scenario('A new spec does not keep the Purpose the command writes', () => {
      const root = newCapabilityOnlyFixture();
      try {
        acceptArchiveCommit(root, NEW_CAP_FIXTURE_KEY);
        const baseline = readFileSync(
          path.join(root, 'openspec', 'specs', NEW_CAP_CAPABILITY, 'spec.md'),
          'utf8',
        );
        assert.doesNotMatch(purposeLine(baseline), ARCHIVE_PLACEHOLDER_PURPOSE);
      } finally {
        rmSync(root, {recursive: true, force: true});
      }
    });

    scenario(
      'In the same commit the step sets Purpose to the one line under that capability in the proposal',
      () => {
        const root = newCapabilityOnlyFixture();
        try {
          acceptArchiveCommit(root, NEW_CAP_FIXTURE_KEY);
          const baseline = readFileSync(
            path.join(root, 'openspec', 'specs', NEW_CAP_CAPABILITY, 'spec.md'),
            'utf8',
          );
          assert.equal(purposeLine(baseline), NEW_CAP_PROPOSAL_GIST);
        } finally {
          rmSync(root, {recursive: true, force: true});
        }
      },
    );

    scenario('An existing spec keeps its Purpose', () => {
      const root = mixedDeltaFixture();
      try {
        acceptArchiveCommit(root, FIXTURE_KEY);
        const baseline = readFileSync(
          path.join(root, 'openspec', 'specs', FIXTURE_CAPABILITY, 'spec.md'),
          'utf8',
        );
        assert.equal(purposeLine(baseline), EXISTING_BASELINE_PURPOSE);
      } finally {
        rmSync(root, {recursive: true, force: true});
      }
    });

    scenario('The command does not change it', () => {
      const root = mixedDeltaFixture();
      try {
        const specPath = path.join(root, 'openspec', 'specs', FIXTURE_CAPABILITY, 'spec.md');
        const before = purposeLine(readFileSync(specPath, 'utf8'));
        runAcceptArchivePath(root);
        const after = purposeLine(readFileSync(specPath, 'utf8'));
        assert.equal(after, before);
        assert.equal(after, EXISTING_BASELINE_PURPOSE);
      } finally {
        rmSync(root, {recursive: true, force: true});
      }
    });
  });

  requirement('A refusal does not publish', () => {
    scenario('When the command refuses, the step does not publish', () => {
      const section = archiveSection(readFileSync(acceptStep, 'utf8'));
      assert.match(
        section,
        /openspec archive issue-<issue> --yes[\s\S]*?(?:exits non-zero|non-zero exit)[\s\S]*?do not (?:commit and )?publish/i,
      );
      assert.doesNotMatch(section, /openspec archive[\s\S]*?Publish[\s\S]*?(?:exits non-zero|non-zero|Aborted)/i);

      const root = emptyBaselineFixture();
      try {
        const before = commitCount(root);
        const {output} = runArchiveMaybeRefused(root, EMPTY_BASELINE_FIXTURE_KEY);
        assert.match(output, /Aborted\. No files were changed\.|at least one requirement/i);
        assert.equal(commitCount(root), before);
        assert.ok(
          existsSync(
            path.join(root, 'openspec', 'changes', `issue-${EMPTY_BASELINE_FIXTURE_KEY}`),
          ),
        );
      } finally {
        rmSync(root, {recursive: true, force: true});
      }
    });

    scenario('A refusal because a baseline would have no requirement is a Wait that names that baseline', () => {
      const body = readFileSync(acceptStep, 'utf8');
      const section = archiveSection(body);
      const stop = body.split(/^## Stop/m)[1] ?? '';
      assert.match(
        section,
        /(?:no requirement|at least one requirement)[\s\S]*?Wait[\s\S]*?openspec\/specs\/<capability>\/spec\.md/i,
      );
      assert.match(stop, /(?:no requirement|baseline)[\s\S]*?Wait[\s\S]*?baseline/i);

      const root = emptyBaselineFixture();
      try {
        const {output} = runArchiveMaybeRefused(root, EMPTY_BASELINE_FIXTURE_KEY);
        assert.match(output, /at least one requirement/i);
      } finally {
        rmSync(root, {recursive: true, force: true});
      }
    });
  });
});
