import assert from 'node:assert/strict';
import {lstatSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

import {agentLogPath, ensureServiceEnv, followFile, linkCommand} from './runtime.ts';

test('the worktree hook links the package into .sandcastle and keeps the service node_modules', () => {
  const parent = mkdtempSync(path.join(tmpdir(), 'sdd-link-'));
  const solver = path.join(parent, "o'json");
  const service = path.join(parent, 'service');
  mkdirSync(path.join(solver, 'prompts'), {recursive: true});
  writeFileSync(path.join(solver, 'prompts', 'context.md'), '#');
  mkdirSync(path.join(service, 'node_modules'), {recursive: true});
  const command = linkCommand(solver, service);
  const prompts = path.join(solver, 'prompts').replaceAll("'", `'\\''`);
  const modules = path.join(service, 'node_modules').replaceAll("'", `'\\''`);
  assert.ok(command.startsWith('mkdir -p .sandcastle && '));
  assert.ok(command.includes(`ln -sfn '${prompts}' .sandcastle/prompts`));
  assert.ok(command.includes(`ln -sfn '${modules}' node_modules`));
  assert.equal(command.includes('.env'), false);
  assert.equal(command.includes('sdd.ts'), false);
});

test('the service env link points at the package and does not replace an existing file', () => {
  const parent = mkdtempSync(path.join(tmpdir(), 'sdd-env-'));
  const solver = path.join(parent, 'solver');
  const service = path.join(parent, 'service');
  mkdirSync(solver);
  writeFileSync(path.join(solver, '.env'), 'CURSOR_API_KEY=from-package\n');
  ensureServiceEnv(service, solver);
  const linked = path.join(service, '.sandcastle', '.env');
  assert.equal(lstatSync(linked).isSymbolicLink(), true);
  assert.equal(readFileSync(linked, 'utf8'), 'CURSOR_API_KEY=from-package\n');

  const other = path.join(parent, 'other');
  mkdirSync(path.join(other, '.sandcastle'), {recursive: true});
  writeFileSync(path.join(other, '.sandcastle', '.env'), 'CURSOR_API_KEY=local\n');
  ensureServiceEnv(other, solver);
  assert.equal(lstatSync(path.join(other, '.sandcastle', '.env')).isSymbolicLink(), false);
  assert.equal(readFileSync(path.join(other, '.sandcastle', '.env'), 'utf8'), 'CURSOR_API_KEY=local\n');
});

test('the agent log path matches the sandcastle file name', () => {
  assert.equal(
    agentLogPath('/work', 'reviewer/24143f8848df', 'review'),
    path.join('/work', '.sandcastle', 'logs', 'reviewer-24143f8848df-review.log'),
  );
});

test('followFile copies the log as it grows and flushes on stop', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'agent-log-'));
  const file = path.join(root, 'review.log');
  const chunks: string[] = [];
  const follow = followFile(file, chunk => chunks.push(chunk), 15);
  writeFileSync(file, 'one\n');
  await new Promise(resolve => setTimeout(resolve, 40));
  writeFileSync(file, 'one\ntwo\n');
  follow.stop();
  assert.equal(chunks.join(''), 'one\ntwo\n');
});
