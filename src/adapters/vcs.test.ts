import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {lstatSync, mkdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'vitest';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {
  contentBranchFiles,
  ensureIssueBranch,
  gitFiles,
  gitVcs,
  packageLinks,
  parentOfArchive,
  strictContentBranchFiles,
} from './vcs.ts';

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, {cwd, encoding: 'utf8'}).trim();
}

test('ensureIssueBranch cuts sdd/<key> once from the default branch', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'sdd-vcs-'));
  execFileSync('git', ['init'], {cwd: root, stdio: 'ignore'});
  execFileSync('git', ['symbolic-ref', 'HEAD', 'refs/heads/master'], {cwd: root});
  git(root, [
    '-c',
    'user.name=test',
    '-c',
    'user.email=test@example.com',
    'commit',
    '--allow-empty',
    '-m',
    'init',
  ]);
  await ensureIssueBranch(root, '12', {branchPrefix: 'sdd', defaultBranch: 'master'});
  const cut = git(root, ['rev-parse', 'sdd/12']);
  assert.equal(cut, git(root, ['rev-parse', 'master']));
  git(root, [
    '-c',
    'user.name=test',
    '-c',
    'user.email=test@example.com',
    'commit',
    '--allow-empty',
    '-m',
    'next',
  ]);
  await ensureIssueBranch(root, '12', {branchPrefix: 'sdd', defaultBranch: 'master'});
  assert.equal(git(root, ['rev-parse', 'sdd/12']), cut);
});

test('parentOfArchive returns the parent only when the head marks this issue', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'sdd-vcs-'));
  execFileSync('git', ['init'], {cwd: root, stdio: 'ignore'});
  execFileSync('git', ['symbolic-ref', 'HEAD', 'refs/heads/master'], {cwd: root});
  const save = (message: string, body?: string) => {
    const args = ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '--allow-empty', '-m', message];
    if (body) {
      args.push('-m', body);
    }
    git(root, args);
  };
  save('plan');
  const parent = git(root, ['rev-parse', 'HEAD']);
  save('archive', 'Sdd-Archive: issue-7');
  const head = git(root, ['rev-parse', 'HEAD']);
  assert.equal(parentOfArchive(root, head, '7'), parent);
  assert.equal(parentOfArchive(root, head, '8'), head);
  save('tweak');
  const later = git(root, ['rev-parse', 'HEAD']);
  assert.equal(parentOfArchive(root, later, '7'), later);
});

test('a marked root commit is read as itself', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'sdd-vcs-root-'));
  execFileSync('git', ['init', '-b', 'sdd/7'], {cwd: root, stdio: 'ignore'});
  const proposal = path.join(root, 'openspec', 'changes', 'archive', 'issue-7', 'proposal.md');
  mkdirSync(path.dirname(proposal), {recursive: true});
  writeFileSync(proposal, 'from the tip\n');
  git(root, ['add', 'openspec']);
  git(root, [
    '-c',
    'user.name=test',
    '-c',
    'user.email=test@example.com',
    'commit',
    '-m',
    'archive',
    '-m',
    'Sdd-Archive: issue-7',
  ]);
  const head = git(root, ['rev-parse', 'HEAD']);
  assert.equal(parentOfArchive(root, head, '7'), head);
  const files = contentBranchFiles(root, '7', 'sdd');
  assert.ok(files);
  assert.match(files.read('openspec/changes/archive/issue-7/proposal.md'), /from the tip/);
  assert.throws(() => strictContentBranchFiles(root, '7', 'sdd'));
});

test('compare reads commits and the three-dot diff, and a missing object fails the range', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'sdd-vcs-'));
  execFileSync('git', ['init'], {cwd: root, stdio: 'ignore'});
  execFileSync('git', ['symbolic-ref', 'HEAD', 'refs/heads/master'], {cwd: root});
  writeFileSync(path.join(root, 'a.txt'), 'one\n');
  git(root, ['add', 'a.txt']);
  git(root, ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'base']);
  const base = git(root, ['rev-parse', 'HEAD']);
  writeFileSync(path.join(root, 'a.txt'), 'two\n');
  git(root, ['add', 'a.txt']);
  git(root, ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'head']);
  const head = git(root, ['rev-parse', 'HEAD']);
  const span = await gitVcs(root).compare(base, head);
  assert.ok(span);
  assert.match(span.commits, /head/);
  assert.match(span.diff, /a\.txt/);
  assert.equal(await gitVcs(root).compare('deadbeefdeadbeef', head), null);
});

test('published holds once HEAD is on the remote issue branch, not before', async () => {
  const origin = mkdtempSync(path.join(tmpdir(), 'sdd-origin-'));
  execFileSync('git', ['init', '--bare'], {cwd: origin, stdio: 'ignore'});
  const root = mkdtempSync(path.join(tmpdir(), 'sdd-vcs-'));
  execFileSync('git', ['init'], {cwd: root, stdio: 'ignore'});
  execFileSync('git', ['symbolic-ref', 'HEAD', 'refs/heads/sdd/12'], {cwd: root});
  git(root, ['remote', 'add', 'origin', origin]);
  const commit = (message: string) =>
    git(root, [
      '-c',
      'user.name=test',
      '-c',
      'user.email=test@example.com',
      'commit',
      '--allow-empty',
      '-m',
      message,
    ]);
  commit('one');
  const vcs = gitVcs(root);
  const first = await vcs.head();
  assert.equal(await vcs.published('12', first), false);
  git(root, ['push', '-q', 'origin', 'sdd/12']);
  assert.equal(await vcs.published('12', first), true);
  commit('two');
  assert.equal(await vcs.published('12', await vcs.head()), false);
  assert.equal(await vcs.published('12', first), true);
  assert.equal(await vcs.published('13', first), false);
});

test('dirty lists changed, staged, and untracked paths, and nothing on a clean tree', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'sdd-vcs-'));
  execFileSync('git', ['init'], {cwd: root, stdio: 'ignore'});
  writeFileSync(path.join(root, '.gitignore'), 'build/\n');
  writeFileSync(path.join(root, 'a.txt'), 'one\n');
  writeFileSync(path.join(root, 'b.txt'), 'one\n');
  git(root, ['add', '.']);
  git(root, ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'base']);
  const vcs = gitVcs(root);
  assert.deepEqual(await vcs.dirty(), []);
  mkdirSync(path.join(root, 'build'));
  writeFileSync(path.join(root, 'build', 'out.js'), '');
  assert.deepEqual(await vcs.dirty(), []);
  writeFileSync(path.join(root, 'a.txt'), 'two\n');
  git(root, ['mv', 'b.txt', 'c.txt']);
  writeFileSync(path.join(root, 'stray file.log'), '');
  assert.deepEqual((await vcs.dirty()).sort(), ['a.txt', 'c.txt', 'stray file.log']);
});

test('prepare checks out sdd/<key> once and links the package files', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'sdd-vcs-'));
  execFileSync('git', ['init'], {cwd: root, stdio: 'ignore'});
  execFileSync('git', ['symbolic-ref', 'HEAD', 'refs/heads/master'], {cwd: root});
  git(root, ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '--allow-empty', '-m', 'init']);
  const skills = mkdtempSync(path.join(tmpdir(), 'sdd-skills-'));
  const vcs = gitVcs(root, {defaultBranch: 'master'});
  const dir = await vcs.prepare('7', {worktreesDir: '.worktrees', links: [{from: skills, to: 'skills'}]});
  assert.equal(git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']), 'sdd/7');
  assert.equal(lstatSync(path.join(dir, '.sandcastle', 'skills')).isSymbolicLink(), true);
  const exclude = execFileSync('git', ['rev-parse', '--git-path', 'info/exclude'], {cwd: root, encoding: 'utf8'}).trim();
  assert.match(execFileSync('cat', [path.resolve(root, exclude)], {encoding: 'utf8'}), /\/\.sandcastle\//);
  assert.equal(await vcs.prepare('7', {worktreesDir: '.worktrees', links: []}), dir);
  assert.equal(await vcs.tip('7'), git(root, ['rev-parse', 'sdd/7']));
  await assert.rejects(vcs.tip('nope'), /no branch sdd\/nope/);
});

test('files under openspec are read in one pass and an empty range is not a diff', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'sdd-vcs-'));
  execFileSync('git', ['init'], {cwd: root, stdio: 'ignore'});
  execFileSync('git', ['symbolic-ref', 'HEAD', 'refs/heads/master'], {cwd: root});
  mkdirSync(path.join(root, 'openspec', 'changes', 'issue-4'), {recursive: true});
  mkdirSync(path.join(root, 'openspec', 'specs', 'demo'), {recursive: true});
  writeFileSync(path.join(root, 'openspec', 'changes', 'issue-4', 'proposal.md'), 'hello\n');
  writeFileSync(path.join(root, 'openspec', 'specs', 'demo', 'spec.md'), 'spec\n');
  writeFileSync(path.join(root, 'README.md'), 'readme\n');
  git(root, ['add', '.']);
  git(root, ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'base']);
  git(root, ['branch', 'sdd/4']);
  const files = gitFiles(root, '4', 'sdd');
  assert.equal(files.read('openspec/changes/issue-4/proposal.md'), 'hello\n');
  assert.equal(files.exists('openspec/changes/issue-4/proposal.md'), true);
  assert.equal(files.read('openspec/changes/issue-4/missing.md'), '');
  assert.equal(files.exists('openspec/changes/archive/issue-4'), false);
  assert.ok(files.list('openspec/changes/issue-4').includes('openspec/changes/issue-4/proposal.md'));
  assert.equal(files.read('README.md'), 'readme\n');
  const vcs = gitVcs(root);
  assert.equal(await vcs.changed?.('HEAD', 'HEAD'), false);
  writeFileSync(path.join(root, 'README.md'), 'changed\n');
  git(root, ['add', 'README.md']);
  git(root, ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'next']);
  assert.equal(await vcs.changed?.('HEAD~1', 'HEAD'), true);
});

test('packageLinks keeps the directories that exist', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'sdd-links-'));
  mkdirSync(path.join(root, 'skills'));
  assert.deepEqual(packageLinks(root), [{from: path.join(root, 'skills'), to: 'skills'}]);
});

spec('spec-archive', () => {
  requirement('One commit holds the fold', () => {
    scenario('The machine, the window, review, and unarchive keep reading archive/issue-<key>', () => {
      const root = mkdtempSync(path.join(tmpdir(), 'sdd-vcs-archive-read-'));
      execFileSync('git', ['init', '-b', 'sdd/7'], {cwd: root, stdio: 'ignore'});
      const undated = path.join(root, 'openspec', 'changes', 'archive', 'issue-7', 'proposal.md');
      mkdirSync(path.dirname(undated), {recursive: true});
      writeFileSync(undated, 'undated archive\n');
      git(root, ['add', 'openspec']);
      git(root, [
        '-c',
        'user.name=test',
        '-c',
        'user.email=test@example.com',
        'commit',
        '-m',
        'archive',
        '-m',
        'Sdd-Archive: issue-7',
      ]);
      const files = contentBranchFiles(root, '7', 'sdd');
      assert.ok(files);
      assert.match(files.read('openspec/changes/archive/issue-7/proposal.md'), /undated archive/);
      assert.equal(files.read('openspec/changes/archive/2025-11-05-issue-7/proposal.md'), '');
      assert.equal(files.exists('openspec/changes/archive/2025-11-05-issue-7/proposal.md'), false);
    });
  });
});
