import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {lstatSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'vitest';

import {agentLogPath, ensureServiceEnv, linkCommand, renderAgentEvent} from './runtime.ts';
import {gitVcs} from './vcs.ts';

test('the worktree hook links the package into .sandcastle and keeps the service node_modules', () => {
  const parent = mkdtempSync(path.join(tmpdir(), 'sdd-link-'));
  const solver = path.join(parent, "o'json");
  const service = path.join(parent, 'service');
  mkdirSync(path.join(solver, 'prompts'), {recursive: true});
  writeFileSync(path.join(solver, 'prompts', 'context.md'), '#');
  mkdirSync(path.join(solver, 'src'), {recursive: true});
  writeFileSync(path.join(solver, 'src', 'sdd.ts'), 'export {}\n');
  writeFileSync(path.join(solver, 'src', 'accept.ts'), 'export {}\n');
  mkdirSync(path.join(service, 'node_modules'), {recursive: true});
  const command = linkCommand(solver, service);
  const prompts = path.join(solver, 'prompts').replaceAll("'", `'\\''`);
  const modules = path.join(service, 'node_modules').replaceAll("'", `'\\''`);
  assert.ok(command.startsWith('mkdir -p .sandcastle && '));
  assert.ok(command.includes(`ln -sfn '${prompts}' .sandcastle/prompts`));
  assert.ok(command.includes(`ln -sfn '${modules}' node_modules`));
  assert.equal(command.includes('.env'), false);
  assert.equal(command.includes('sdd.ts'), false);
  assert.equal(command.includes('accept.ts'), false);
});

test('the links the hook makes in a sandcastle worktree are not dirt, and the exclude rules are written once', async () => {
  const parent = mkdtempSync(path.join(tmpdir(), 'sdd-link-'));
  const solver = path.join(parent, 'solver');
  const service = path.join(parent, 'service');
  mkdirSync(path.join(solver, 'prompts'), {recursive: true});
  writeFileSync(path.join(solver, 'prompts', 'context.md'), '#');
  mkdirSync(service);
  const git = (cwd: string, args: string[]) => execFileSync('git', args, {cwd, encoding: 'utf8'}).trim();
  git(service, ['init', '-q']);
  writeFileSync(path.join(service, '.gitignore'), 'node_modules/\n');
  git(service, ['add', '.']);
  git(service, ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'base']);
  mkdirSync(path.join(service, 'node_modules'));
  git(service, ['worktree', 'add', '-q', '-b', 'sdd/1', '.sandcastle/worktrees/sdd-1']);
  const worktree = path.join(service, '.sandcastle', 'worktrees', 'sdd-1');
  const command = linkCommand(solver, service);
  execFileSync('sh', ['-c', command], {cwd: worktree});
  execFileSync('sh', ['-c', command], {cwd: worktree});
  assert.equal(lstatSync(path.join(worktree, 'node_modules')).isSymbolicLink(), true);
  assert.deepEqual(await gitVcs(worktree).dirty(), []);
  assert.deepEqual(await gitVcs(service).dirty(), []);
  const exclude = readFileSync(path.join(service, '.git', 'info', 'exclude'), 'utf8').split('\n');
  assert.equal(exclude.filter(line => line === '/.sandcastle/').length, 1);
  assert.equal(exclude.filter(line => line === '/node_modules').length, 1);
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

test('agent events keep the model text and fold tool calls', () => {
  const text = renderAgentEvent({type: 'text', message: 'looks fine', iteration: 1, timestamp: new Date()}, true);
  const raw = renderAgentEvent(
    {type: 'raw', line: '{"type":"system"}', iteration: 1, timestamp: new Date()},
    text.atLineStart,
  );
  const tool = renderAgentEvent(
    {type: 'toolCall', name: 'Read', formattedArgs: 'src/cache.ts', iteration: 1, timestamp: new Date()},
    raw.atLineStart,
  );
  const folded = renderAgentEvent(
    {type: 'toolCall', name: 'Bash', formattedArgs: 'git diff\n--stat', iteration: 1, timestamp: new Date()},
    true,
  );
  assert.equal(text.text, 'looks fine');
  assert.equal(raw.text, '');
  assert.equal(tool.text, '\n::group::Read src/cache.ts\n::endgroup::\n');
  assert.equal(folded.text, '::group::Bash\ngit diff\n--stat\n::endgroup::\n');
});
