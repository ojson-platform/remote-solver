import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {lstatSync, mkdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'vitest';

import {ensureIssueBranch, gitVcs, packageLinks} from './vcs.ts';

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, {cwd, encoding: 'utf8'}).trim();
}

test('ensureIssueBranch cuts sdd/<key> once from the default branch', () => {
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
  ensureIssueBranch(root, '12', {branchPrefix: 'sdd', defaultBranch: 'master'});
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
  ensureIssueBranch(root, '12', {branchPrefix: 'sdd', defaultBranch: 'master'});
  assert.equal(git(root, ['rev-parse', 'sdd/12']), cut);
});

test('compare reads commits and the three-dot diff, and a missing object fails the range', () => {
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
  const span = gitVcs(root).compare(base, head);
  assert.ok(span);
  assert.match(span.commits, /head/);
  assert.match(span.diff, /a\.txt/);
  assert.equal(gitVcs(root).compare('deadbeefdeadbeef', head), null);
});

test('published holds once HEAD is on the remote issue branch, not before', () => {
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
  const first = vcs.head();
  assert.equal(vcs.published('12', first), false);
  git(root, ['push', '-q', 'origin', 'sdd/12']);
  assert.equal(vcs.published('12', first), true);
  commit('two');
  assert.equal(vcs.published('12', vcs.head()), false);
  assert.equal(vcs.published('12', first), true);
  assert.equal(vcs.published('13', first), false);
});

test('dirty lists changed, staged, and untracked paths, and nothing on a clean tree', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'sdd-vcs-'));
  execFileSync('git', ['init'], {cwd: root, stdio: 'ignore'});
  writeFileSync(path.join(root, '.gitignore'), 'build/\n');
  writeFileSync(path.join(root, 'a.txt'), 'one\n');
  writeFileSync(path.join(root, 'b.txt'), 'one\n');
  git(root, ['add', '.']);
  git(root, ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'base']);
  const vcs = gitVcs(root);
  assert.deepEqual(vcs.dirty(), []);
  mkdirSync(path.join(root, 'build'));
  writeFileSync(path.join(root, 'build', 'out.js'), '');
  assert.deepEqual(vcs.dirty(), []);
  writeFileSync(path.join(root, 'a.txt'), 'two\n');
  git(root, ['mv', 'b.txt', 'c.txt']);
  writeFileSync(path.join(root, 'stray file.log'), '');
  assert.deepEqual(vcs.dirty().sort(), ['a.txt', 'c.txt', 'stray file.log']);
});

test('prepare checks out sdd/<key> once and links the package files', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'sdd-vcs-'));
  execFileSync('git', ['init'], {cwd: root, stdio: 'ignore'});
  execFileSync('git', ['symbolic-ref', 'HEAD', 'refs/heads/master'], {cwd: root});
  git(root, ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '--allow-empty', '-m', 'init']);
  const skills = mkdtempSync(path.join(tmpdir(), 'sdd-skills-'));
  const vcs = gitVcs(root, {defaultBranch: 'master'});
  const dir = vcs.prepare('7', {worktreesDir: '.worktrees', links: [{from: skills, to: 'skills'}]});
  assert.equal(git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']), 'sdd/7');
  assert.equal(lstatSync(path.join(dir, '.sandcastle', 'skills')).isSymbolicLink(), true);
  const exclude = execFileSync('git', ['rev-parse', '--git-path', 'info/exclude'], {cwd: root, encoding: 'utf8'}).trim();
  assert.match(execFileSync('cat', [path.resolve(root, exclude)], {encoding: 'utf8'}), /\/\.sandcastle\//);
  assert.equal(vcs.prepare('7', {worktreesDir: '.worktrees', links: []}), dir);
  assert.equal(vcs.tip('7'), git(root, ['rev-parse', 'sdd/7']));
  assert.throws(() => vcs.tip('nope'), /no branch sdd\/nope/);
});

test('packageLinks keeps the directories that exist', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'sdd-links-'));
  mkdirSync(path.join(root, 'skills'));
  assert.deepEqual(packageLinks(root), [{from: path.join(root, 'skills'), to: 'skills'}]);
});
