import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

import {changeText, readChange} from './change.ts';
import type {FileSource} from './port.ts';
import {gitFiles} from '../adapters/vcs.ts';

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

test('reads a proposal, its open questions, and a missing baseline from the working tree', () => {
  const root = repo();
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
  const view = readChange('4', gitFiles(root, '4', 'sdd'));
  assert.equal(view.proposal, true);
  assert.equal(view.openQuestions, 1);
  assert.deepEqual(view.missingBaseline, ['cache-first']);
  rmSync(root, {recursive: true, force: true});
});

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

function existsOnMaster(root: string, rel: string): boolean {
  try {
    execFileSync('git', ['cat-file', '-e', `master:${rel}`], {cwd: root, stdio: 'ignore'});
    return true;
  } catch {
    return false;
  }
}
