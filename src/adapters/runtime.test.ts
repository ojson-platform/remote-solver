import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

import {linkCommand} from './runtime.ts';

test('the worktree hook links the machine that exists and skips the rest', () => {
  const parent = mkdtempSync(path.join(tmpdir(), 'sdd-link-'));
  const root = path.join(parent, "o'json");
  const box = path.join(root, '.sandcastle');
  mkdirSync(box, {recursive: true});
  writeFileSync(path.join(box, 'context.md'), '#');
  mkdirSync(path.join(root, 'node_modules'));
  const command = linkCommand(root);
  const context = path.join(box, 'context.md').replaceAll("'", `'\\''`);
  assert.ok(command.startsWith('mkdir -p .sandcastle && '));
  assert.ok(command.includes(`ln -sfn '${context}' .sandcastle/context.md`));
  assert.ok(command.includes(`ln -sfn '${path.join(root, 'node_modules').replaceAll("'", `'\\''`)}' node_modules`));
  assert.equal(command.includes('.env'), false);
  assert.equal(command.includes('sdd.ts'), false);
});
