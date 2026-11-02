import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'vitest';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {contentBranchFiles, gitFiles, strictContentBranchFiles} from '../adapters/vcs.ts';
import {changeText, HEADINGS, readBranch, readChange} from './change.ts';
import {archiveDir} from './naming.ts';
import type {FileSource} from './port.ts';

function git(root: string, args: string[]): void {
  execFileSync('git', args, {cwd: root, stdio: 'ignore'});
}

function repo(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'sandcastle-change-'));
  git(root, ['init', '-b', 'master']);
  git(root, ['config', 'user.email', 'test@example.com']);
  git(root, ['config', 'user.name', 'Test']);
  writeFileSync(path.join(root, 'README.md'), 'root\n');
  git(root, ['add', 'README.md']);
  git(root, ['commit', '-m', 'init']);
  return root;
}

test('reads proposal.md from sdd/<issue> when the working tree is another branch', () => {
  const root = repo();
  git(root, ['checkout', '-b', 'sdd/7']);
  const change = path.join(root, 'openspec', 'changes', 'issue-7');
  mkdirSync(path.join(change, 'specs', 'preset'), {recursive: true});
  writeFileSync(
    path.join(change, 'proposal.md'),
    ['## Open questions', '- [ ] still open', ''].join('\n'),
  );
  writeFileSync(path.join(change, 'specs', 'preset', 'spec.md'), '# preset\n');
  writeFileSync(path.join(change, 'tasks.md'), '- [ ] first\n- [x] second\n');
  git(root, ['add', 'openspec']);
  git(root, ['commit', '-m', 'change']);
  git(root, ['checkout', 'master']);

  const view = readChange('7', gitFiles(root, '7', 'sdd'));
  assert.equal(view.proposal, true);
  assert.equal(view.delta, true);
  assert.equal(view.tasks, true);
  assert.equal(view.openQuestions, 1);
  assert.equal(view.openTasks, 1);
  assert.equal(existsOnMaster(root, 'openspec/changes/issue-7/proposal.md'), false);
  rmSync(root, {recursive: true, force: true});
});

spec('change', () => {
  requirement('The change directory is issue-<key>', () => {
    scenario('A file only in the checkout is not the change', () => {
      const root = repo();
      const change = path.join(root, 'openspec', 'changes', 'issue-4');
      mkdirSync(change, {recursive: true});
      writeFileSync(path.join(change, 'proposal.md'), '## Open questions\n- [ ] only here\n');
      const view = readChange('4', gitFiles(root, '4', 'sdd'));
      assert.equal(view.proposal, false);
      assert.equal(view.openQuestions, 0);
      rmSync(root, {recursive: true, force: true});
    });

    scenario('The issue branch wins over the checkout', () => {
      const root = repo();
      git(root, ['checkout', '-b', 'sdd/4']);
      const change = path.join(root, 'openspec', 'changes', 'issue-4');
      mkdirSync(change, {recursive: true});
      writeFileSync(
        path.join(change, 'proposal.md'),
        [
          '## Capabilities',
          '### Modified',
          '- cache-first keep the first hit',
          '',
          '## Open questions',
          '- [ ] who owns eviction',
          '',
        ].join('\n'),
      );
      git(root, ['add', 'openspec']);
      git(root, ['commit', '-m', 'change']);
      git(root, ['checkout', 'master']);
      mkdirSync(change, {recursive: true});
      writeFileSync(
        path.join(change, 'proposal.md'),
        '## Open questions\n- [x] closed in the checkout\n',
      );
      const view = readChange('4', gitFiles(root, '4', 'sdd'));
      assert.equal(view.proposal, true);
      assert.equal(view.openQuestions, 1);
      assert.deepEqual(view.missingBaseline, ['cache-first']);
      assert.deepEqual(view.capabilities, ['cache-first']);
      rmSync(root, {recursive: true, force: true});
    });
  });
});

test('a numeric change directory is not the issue change', () => {
  const root = repo();
  const wrong = path.join(root, 'openspec', 'changes', '7');
  mkdirSync(wrong, {recursive: true});
  writeFileSync(path.join(wrong, 'proposal.md'), '## Open questions\n- [ ] no\n');
  const view = readChange('7', gitFiles(root, '7', 'sdd'));
  assert.equal(view.proposal, false);
  assert.equal(view.openQuestions, 0);
  rmSync(root, {recursive: true, force: true});
});

test('change text prefers the active directory and otherwise reads the archive', () => {
  const archived: FileSource = {
    exists: rel => rel === 'openspec/changes/archive/issue-11/proposal.md',
    read: rel => (rel.endsWith('proposal.md') ? 'why\n' : ''),
    list: () => [],
  };
  assert.equal(changeText('11', archived), '# openspec/changes/archive/issue-11/proposal.md\nwhy');

  const active: FileSource = {
    exists: rel =>
      rel === 'openspec/changes/issue-11/proposal.md' ||
      rel === 'openspec/changes/archive/issue-11/proposal.md',
    read: rel => (rel.startsWith('openspec/changes/issue-11/') ? 'active\n' : 'archived\n'),
    list: () => [],
  };
  assert.match(
    changeText('11', active) ?? '',
    /^# openspec\/changes\/issue-11\/proposal.md\nactive/,
  );
});

spec('change', () => {
  requirement('The active change wins over the archive', () => {
    scenario('Only the archive is present, the archive text is read', () => {
      const proposal = path.join(archiveDir('7'), 'proposal.md');
      const files: FileSource = {
        exists: rel => rel === proposal || rel === archiveDir('7'),
        read: rel => (rel === proposal ? '## Outcome\n\nИз архива.\n' : ''),
        list: () => [],
      };
      const read = readBranch('7', files);
      assert.match(read.text.proposal, /Из архива/);
      assert.equal(read.change.proposal, false);
      assert.equal(read.change.archived, true);
    });
  });
});

test('names capabilities under Added and Modified', () => {
  const files: FileSource = {
    exists: rel => rel.endsWith('proposal.md'),
    read: () => '## Capabilities\n### Added\n- fresh one\n### Modified\n- cache-first keep\n',
    list: () => [],
  };
  const view = readChange('1', files);
  assert.deepEqual(view.capabilities, ['fresh', 'cache-first']);
  assert.deepEqual(view.missingBaseline, ['cache-first']);
});

test('reads a change from a file source that is not git', () => {
  const files: FileSource = {
    exists: rel => rel === 'openspec/changes/issue-LAVKA-3/proposal.md',
    read: rel => (rel.endsWith('proposal.md') ? '## Open questions\n- [ ] one\n' : ''),
    list: () => [],
  };
  const view = readChange('LAVKA-3', files);
  assert.equal(view.proposal, true);
  assert.equal(view.openQuestions, 1);
  assert.equal(view.delta, false);
});

test('context.md § Artifacts states every heading the machine and the implementer read', () => {
  const context = readFileSync(
    path.join(import.meta.dirname, '..', '..', 'skills', 'sdd-flow', 'CONTEXT.md'),
    'utf8',
  );
  const artifacts = context.split(/^## /m).find(section => section.startsWith('Artifacts\n'));
  assert.ok(artifacts, 'context.md has § Artifacts');
  const read = [
    `## ${HEADINGS.capabilities}`,
    `### ${HEADINGS.added}`,
    `### ${HEADINGS.modified}`,
    `## ${HEADINGS.openQuestions}`,
    `## ${HEADINGS.openDecisions}`,
    '## Verification boundary',
  ];
  for (const heading of read) {
    assert.ok(artifacts.includes(`\`${heading}\``), `§ Artifacts names ${heading}`);
  }
});

function existsOnMaster(root: string, rel: string): boolean {
  try {
    execFileSync('git', ['cat-file', '-e', `master:${rel}`], {cwd: root, stdio: 'ignore'});
    return true;
  } catch {
    return false;
  }
}

spec('change', () => {
  requirement('The change directory is issue-<key>', () => {
    scenario('A numeric directory is not the change', () => {
      const source: FileSource = {
        exists: rel => rel === 'openspec/changes/7/proposal.md',
        read: () => '## Open questions\n- [ ] no\n',
        list: () => [],
      };
      assert.equal(readChange('7', source).proposal, false);
    });
    scenario('The change is read from the issue branch', () => {
      const source: FileSource = {
        exists: rel => rel === 'openspec/changes/issue-7/proposal.md',
        read: () => '## Open questions\n- [ ] still open\n',
        list: () => [],
      };
      assert.equal(readChange('7', source).proposal, true);
    });
  });

  requirement('The active change wins over the archive', () => {
    scenario('Both copies present, the active text is read', () => {
      const source: FileSource = {
        exists: rel =>
          rel === 'openspec/changes/issue-11/proposal.md' ||
          rel === 'openspec/changes/archive/issue-11/proposal.md',
        read: rel => (rel.startsWith('openspec/changes/issue-11/') ? 'active\n' : 'archived\n'),
        list: () => [],
      };
      assert.match(changeText('11', source) ?? '', /active/);
    });
  });
});

function commit(root: string, subject: string, body?: string): void {
  git(root, body ? ['commit', '-m', subject, '-m', body] : ['commit', '-m', subject]);
}

function markedArchive(): string {
  const root = repo();
  git(root, ['checkout', '-b', 'sdd/7']);
  const change = path.join(root, 'openspec', 'changes', 'issue-7', 'specs', 'fresh');
  mkdirSync(change, {recursive: true});
  writeFileSync(
    path.join(root, 'openspec', 'changes', 'issue-7', 'proposal.md'),
    '## Outcome\n\nИз родителя.\n',
  );
  writeFileSync(
    path.join(change, 'spec.md'),
    ['## ADDED Requirements', '', '### Requirement: Новое', '', 'Текст.', ''].join('\n'),
  );
  git(root, ['add', 'openspec']);
  commit(root, 'plan');
  mkdirSync(path.join(root, 'openspec', 'changes', 'archive'), {recursive: true});
  git(root, ['mv', 'openspec/changes/issue-7', 'openspec/changes/archive/issue-7']);
  const baseline = path.join(root, 'openspec', 'specs', 'fresh');
  mkdirSync(baseline, {recursive: true});
  writeFileSync(
    path.join(baseline, 'spec.md'),
    ['## Purpose', '', 'Зачем.', '', '## Requirements', '', '### Requirement: Новое', '', 'Текст.', ''].join('\n'),
  );
  git(root, ['add', 'openspec']);
  commit(root, 'archive', 'Sdd-Archive: issue-7');
  return root;
}

function readMarked(root: string) {
  const content = contentBranchFiles(root, '7', 'sdd');
  if (!content) {
    throw new Error('content tree missing');
  }
  return readBranch('7', gitFiles(root, '7', 'sdd'), content);
}

spec('change', () => {
  requirement('The archive commit leaves the documents on its parent', () => {
    scenario('A marked tip is read from its parent', () => {
      const root = markedArchive();
      try {
        const read = readMarked(root);
        const content = contentBranchFiles(root, '7', 'sdd');
        assert.ok(content);
        assert.match(read.text.proposal, /Из родителя/);
        assert.equal(read.change.proposal, false);
        assert.equal(read.change.archived, true);
        assert.equal(read.facts.proposal, 'openspec/changes/archive/issue-7/proposal.md');
        assert.notEqual(read.facts.fingerprint, readBranch('7', content, content).facts.fingerprint);
      } finally {
        rmSync(root, {recursive: true, force: true});
      }
    });
    scenario('A trailer below the tip does not rewind', () => {
      const root = markedArchive();
      try {
        const proposal = path.join(root, 'openspec', 'changes', 'archive', 'issue-7', 'proposal.md');
        writeFileSync(proposal, '## Outcome\n\nС кончика.\n');
        git(root, ['add', 'openspec']);
        commit(root, 'tweak the archive');
        const read = readMarked(root);
        assert.match(read.text.proposal, /С кончика/);
        assert.equal(read.text.proposal.includes('Из родителя'), false);
      } finally {
        rmSync(root, {recursive: true, force: true});
      }
    });

    scenario('A marked tip with no parent is read as itself', () => {
      const root = rootMarked();
      try {
        const content = contentBranchFiles(root, '7', 'sdd');
        assert.ok(content);
        const read = readBranch('7', gitFiles(root, '7', 'sdd'), content);
        assert.match(read.text.proposal, /Из кончика/);
      } finally {
        rmSync(root, {recursive: true, force: true});
      }
    });

    scenario('A strict read of a marked tip with no parent fails', () => {
      const root = rootMarked();
      try {
        assert.throws(() => strictContentBranchFiles(root, '7', 'sdd'));
      } finally {
        rmSync(root, {recursive: true, force: true});
      }
    });
  });
});

function rootMarked(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'sandcastle-change-root-'));
  git(root, ['init', '-b', 'sdd/7']);
  git(root, ['config', 'user.email', 'test@example.com']);
  git(root, ['config', 'user.name', 'Test']);
  const proposal = path.join(root, 'openspec', 'changes', 'archive', 'issue-7', 'proposal.md');
  mkdirSync(path.dirname(proposal), {recursive: true});
  writeFileSync(proposal, '## Outcome\n\nИз кончика.\n');
  git(root, ['add', 'openspec']);
  commit(root, 'archive', 'Sdd-Archive: issue-7');
  return root;
}
