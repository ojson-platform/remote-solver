import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

import {ensureIssueBranch} from './vcs.ts';

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, {cwd, encoding: 'utf8'}).trim();
}

test('ensureIssueBranch cuts sdd/<key> once from the default branch', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'sdd-vcs-'));
  execFileSync('git', ['init'], {cwd: root, stdio: 'ignore'});
  execFileSync('git', ['symbolic-ref', 'HEAD', 'refs/heads/master'], {cwd: root});
  git(root, ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '--allow-empty', '-m', 'init']);
  ensureIssueBranch(root, '12', {branchPrefix: 'sdd', defaultBranch: 'master'});
  const cut = git(root, ['rev-parse', 'sdd/12']);
  assert.equal(cut, git(root, ['rev-parse', 'master']));
  git(root, ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '--allow-empty', '-m', 'next']);
  ensureIssueBranch(root, '12', {branchPrefix: 'sdd', defaultBranch: 'master'});
  assert.equal(git(root, ['rev-parse', 'sdd/12']), cut);
});
