import assert from 'node:assert/strict';
import {lstatSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

import {agentLogPath, ensureServiceEnv, linkCommand, renderAgentEvent} from './runtime.ts';

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
