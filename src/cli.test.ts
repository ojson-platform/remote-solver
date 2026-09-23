import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

import {route} from './cli.ts';

test('route sends spy and issue to the machine and everything else to sdd', () => {
  assert.deepEqual(route([]), {kind: 'help'});
  assert.deepEqual(route(['--help']), {kind: 'help'});
  assert.deepEqual(route(['issue']), {kind: 'help'});
  assert.deepEqual(route(['spy', '--parallel', '2']), {kind: 'spy', argv: ['--parallel', '2']});
  assert.deepEqual(route(['review']), {kind: 'review'});
  assert.deepEqual(route(['issue', '12']), {kind: 'issue', key: '12'});
  assert.deepEqual(route(['accept', '12']), {kind: 'sdd', argv: ['accept', '12']});
});

test('the bin prints usage and keeps the caller working directory', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const bin = path.join(root, 'bin', 'remote-solver.mjs');
  const child = spawnSync(process.execPath, [bin], {encoding: 'utf8', cwd: root});
  assert.equal(child.status, 1);
  assert.match(child.stderr, /remote-solver spy/);
  assert.match(child.stderr, /accept <key>/);
  const help = spawnSync(process.execPath, [bin, '--help'], {encoding: 'utf8', cwd: root});
  assert.equal(help.status, 0);
});
