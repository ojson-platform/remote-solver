import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'vitest';

import {gitTree} from './tree.ts';

function git(root: string, args: string[]): string {
  return execFileSync('git', ['-c', 'user.email=sdd@example.com', '-c', 'user.name=sdd', ...args], {
    cwd: root,
    encoding: 'utf8',
  });
}

function write(root: string, name: string, text: string): void {
  const full = path.join(root, name);
  mkdirSync(path.dirname(full), {recursive: true});
  writeFileSync(full, text);
}

test('tree reads a rename, a content change, discards a scratch edit, and commits', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'tree-'));
  git(root, ['init', '-b', 'trunk']);
  git(root, ['config', 'user.email', 'sdd@example.com']);
  git(root, ['config', 'user.name', 'sdd']);
  write(root, 'a.txt', 'one\n');
  git(root, ['add', '-A']);
  git(root, ['commit', '-m', 'parent']);
  git(root, ['mv', 'a.txt', 'b.txt']);
  git(root, ['commit', '-m', 'rename']);
  const tree = gitTree(root);
  assert.deepEqual(tree.headChanges(), [{path: 'b.txt', kind: 'renamed', from: 'a.txt'}]);
  write(root, 'b.txt', 'two\n');
  git(root, ['add', '-A']);
  git(root, ['commit', '-m', 'edit']);
  assert.equal(tree.differs('HEAD^', 'HEAD', 'b.txt'), true);
  assert.match(tree.unified('HEAD^', 'HEAD', 'b.txt'), /^\+two/m);
  write(root, 'openspec/stray.txt', 'x\n');
  tree.discard('openspec');
  assert.equal(existsSync(path.join(root, 'openspec', 'stray.txt')), false);
  write(root, 'c.txt', 'c\n');
  tree.commitAll('archive fold', 'Sdd-Archive: issue-1');
  assert.match(tree.headMessage(), /Sdd-Archive: issue-1/);
  tree.revertHead('#1');
  assert.match(tree.headMessage(), /^#1/);
  assert.equal(tree.headMessage().includes('Sdd-Archive: issue-1'), false);
});
