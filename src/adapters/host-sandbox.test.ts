import assert from 'node:assert/strict';
import {existsSync, mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

import {openHostHandle, skipsGlobalGitConfig} from './host-sandbox.ts';

test('git config --global is the setup write sandcastle must not run here', () => {
  assert.equal(skipsGlobalGitConfig('git config --global user.name "a"'), true);
  assert.equal(skipsGlobalGitConfig('git status'), false);
});

test('a global git config command does not touch a config file', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'sdd-host-'));
  const file = path.join(root, 'gitconfig');
  const previous = process.env.GIT_CONFIG_GLOBAL;
  process.env.GIT_CONFIG_GLOBAL = file;
  try {
    const handle = await openHostHandle(root);
    const result = await handle.exec('git config --global user.name probe');
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '');
    assert.equal(existsSync(file), false);
  } finally {
    if (previous === undefined) {
      delete process.env.GIT_CONFIG_GLOBAL;
    } else {
      process.env.GIT_CONFIG_GLOBAL = previous;
    }
  }
});

test('other commands still run on the host, including streamed lines', async () => {
  const handle = await openHostHandle(process.cwd());
  const plain = await handle.exec('printf hi');
  assert.equal(plain.stdout, 'hi');
  assert.equal(plain.exitCode, 0);
  const lines: string[] = [];
  const streamed = await handle.exec('printf "a\\nb\\n"', {onLine: line => lines.push(line)});
  assert.deepEqual(lines, ['a', 'b']);
  assert.equal(streamed.exitCode, 0);
});
