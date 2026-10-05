import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test, vi} from 'vitest';
import {fileURLToPath} from 'node:url';

import type {AgentRun} from './adapters/agent.ts';
import {launcherRuntime, route} from './cli.ts';
import type {Vcs} from './machine/port.ts';

const runAgent = vi.hoisted(() => vi.fn(async (_run: AgentRun) => ({text: ''})));

vi.mock('./adapters/agent.ts', () => ({runAgent}));

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

test('the agent prompt QUEUE is the first configured queue', async () => {
  runAgent.mockClear();
  const root = mkdtempSync(path.join(tmpdir(), 'sdd-queue-'));
  const vcs: Vcs = {
    prepare: async () => root,
    tip: async () => 'abc',
    filesAt: () => ({exists: () => false, read: () => '', list: () => []}),
    compare: async () => null,
    push: async () => {},
    head: async () => 'abc',
    published: async () => true,
    dirty: async () => [],
  };
  const runtime = launcherRuntime({
    root,
    vcs,
    config: {
      queues: [{name: 'FIRST'}, {name: 'SECOND'}],
      branchScope: 'sdd',
      base: 'trunk',
    },
  });
  await runtime.run({
    skill: 'tasks',
    action: 'sdd-tasks',
    key: '7',
    phase: 'implementing',
    pull: '',
    mode: 'mechanical',
  });
  assert.equal(runAgent.mock.calls[0]?.[0].promptArgs.QUEUE, 'FIRST');
});

test('the sdd bin prints cycle verbs', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const bin = path.join(root, 'skills', 'sdd-flow', 'scripts', 'sdd.mjs');
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
