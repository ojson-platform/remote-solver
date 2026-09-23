import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

import {ensureIssueBranch, gitVcs} from './vcs.ts';

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
