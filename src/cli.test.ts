import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {test} from 'vitest';
import {fileURLToPath} from 'node:url';

import {route} from './cli.ts';

test('route sends spy, review, and issue to the launcher', () => {
  assert.deepEqual(route([]), {kind: 'help'});
  assert.deepEqual(route(['--help']), {kind: 'help'});
  assert.deepEqual(route(['issue']), {kind: 'help'});
  assert.deepEqual(route(['spy', '--parallel', '2']), {kind: 'spy', argv: ['--parallel', '2']});
  assert.deepEqual(route(['review']), {kind: 'review'});
  assert.deepEqual(route(['issue', '12']), {kind: 'issue', key: '12'});
  assert.deepEqual(route(['accept', '12']), {kind: 'help'});
  assert.deepEqual(route(['plan']), {kind: 'help'});
});

test('the launcher bin prints its commands and refuses a cycle verb', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const bin = path.join(root, 'bin', 'remote-solver.mjs');
  const child = spawnSync(process.execPath, [bin], {encoding: 'utf8', cwd: root});
  assert.equal(child.status, 1);
  assert.match(child.stderr, /remote-solver spy/);
  assert.match(child.stderr, /remote-solver issue <key>/);
  assert.match(child.stderr, /Cycle verbs are the sdd bin/);
  assert.doesNotMatch(child.stderr, /accept <key>/);
  const help = spawnSync(process.execPath, [bin, '--help'], {encoding: 'utf8', cwd: root});
  assert.equal(help.status, 0);
  assert.match(help.stderr, /Cycle verbs are the sdd bin/);
  const verb = spawnSync(process.execPath, [bin, 'accept', '12'], {encoding: 'utf8', cwd: root});
  assert.equal(verb.status, 1);
  assert.match(verb.stderr, /Cycle verbs are the sdd bin/);
});

test('the sdd bin prints cycle verbs', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const bin = path.join(root, 'bin', 'sdd.mjs');
  const child = spawnSync(process.execPath, [bin], {encoding: 'utf8', cwd: root});
  assert.equal(child.status, 1);
  assert.match(child.stderr, /^Usage: sdd plan /);
  assert.match(child.stderr, /accept <key>/);
  const help = spawnSync(process.execPath, [bin, '--help'], {encoding: 'utf8', cwd: root});
  assert.equal(help.status, 0);
  assert.match(help.stderr, /accept <key>/);
  const asked = spawnSync(process.execPath, [bin, 'help'], {encoding: 'utf8', cwd: root});
  assert.equal(asked.status, 0);
});
