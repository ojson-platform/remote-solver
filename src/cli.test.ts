import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test, vi} from 'vitest';
import {fileURLToPath} from 'node:url';
import {requirement, scenario, spec} from '@ojson/spec-coverage';

import type {AgentRun} from './adapters/agent.ts';
import {launcherRuntime, route} from './cli.ts';
import type {Vcs} from './machine/port.ts';

const runAgent = vi.hoisted(() => vi.fn(async (_run: AgentRun) => ({text: ''})));

function idleVcs(root: string): Vcs {
  return {
    prepare: async () => root,
    tip: async () => 'abc',
    filesAt: () => ({exists: () => false, read: () => '', list: () => []}),
    compare: async () => null,
    push: async () => {},
    head: async () => 'abc',
    published: async () => true,
    dirty: async () => [],
  };
}

vi.mock('./adapters/agent.ts', () => ({runAgent}));

test('route sends spy, review, issue, and board to the launcher', () => {
  assert.deepEqual(route([]), {kind: 'help'});
  assert.deepEqual(route(['--help']), {kind: 'help'});
  assert.deepEqual(route(['issue']), {kind: 'help'});
  assert.deepEqual(route(['spy', '--parallel', '2']), {kind: 'spy', argv: ['--parallel', '2']});
  assert.deepEqual(route(['review']), {kind: 'review'});
  assert.deepEqual(route(['issue', '12']), {kind: 'issue', key: '12'});
  assert.deepEqual(route(['board']), {kind: 'board'});
  assert.deepEqual(route(['board', '--home', '/tmp/home.yaml']), {
    kind: 'board',
    home: '/tmp/home.yaml',
  });
  assert.deepEqual(route(['board', '--home']), {kind: 'help'});
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
  assert.match(child.stderr, /remote-solver board/);
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

test('the step prompt carries the service hook and then the cycle paragraph', async () => {
  runAgent.mockClear();
  const root = mkdtempSync(path.join(tmpdir(), 'sdd-hook-'));
  const service = path.join(root, 'services', 'billing');
  mkdirSync(path.join(root, 'openspec'), {recursive: true});
  mkdirSync(path.join(service, 'openspec'), {recursive: true});
  writeFileSync(
    path.join(root, 'openspec', 'config.yaml'),
    ['sdd:', '  hooks:', '    archive:', '      before:', '        - worktree line', ''].join('\n'),
  );
  writeFileSync(
    path.join(service, 'openspec', 'config.yaml'),
    [
      'sdd:',
      '  queues:',
      '    - name: FIRST',
      '  hooks:',
      '    archive:',
      '      before:',
      '        - svc line',
      '',
    ].join('\n'),
  );
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
    config: {queues: [{name: 'FIRST'}], branchScope: 'sdd', base: 'trunk'},
  });
  await runtime.run({
    skill: 'accept',
    action: 'archive',
    key: '7',
    phase: 'accepting',
    pull: '',
    mode: 'judgment',
    service: 'services/billing',
    sddHooks: {archive: {before: 'cyc line'}},
  });
  const step = runAgent.mock.calls[0]?.[0].promptArgs.STEP ?? '';
  const before = step.indexOf('svc line');
  const cycle = step.indexOf('cyc line');
  const heading = step.indexOf('## archive');
  assert.equal(step.includes('worktree line'), false);
  assert.ok(before >= 0 && before < cycle && cycle < heading);
  assert.equal(step.slice(before, heading), 'svc line\n\ncyc line\n\n');
  const prompt = readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../prompts/sdd.md'),
    'utf8',
  );
  assert.match(prompt, /\{\{STEP\}\}/);
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

spec('artifact', () => {
  requirement('The writing prompt carries the issue text', () => {
    scenario('The prompt includes the issue and forbids a search', async () => {
      runAgent.mockClear();
      const root = mkdtempSync(path.join(tmpdir(), 'sdd-issue-text-'));
      const runtime = launcherRuntime({
        root,
        vcs: idleVcs(root),
        config: {queues: [{name: 'FIRST'}], branchScope: 'sdd', base: 'trunk'},
      });
      const title = 'Show the whole outcome';
      const body = 'The Plan row stops at the first blank line.';
      await runtime.run({
        skill: 'plan',
        action: 'create-proposal',
        key: '6',
        phase: 'proposing',
        pull: '',
        mode: 'judgment',
        issue: {title, body},
      });
      const text = runAgent.mock.calls[0]?.[0].promptArgs.ISSUE_TEXT ?? '';
      assert.match(text, /# Show the whole outcome/);
      assert.match(text, /The Plan row stops at the first blank line\./);
      assert.match(text, /Do not search the repository for this issue/);
      assert.match(text, /do not read the service source to recover it/);
      const prompt = readFileSync(
        path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../prompts/sdd.md'),
        'utf8',
      );
      const issueAt = prompt.indexOf('{{ISSUE_TEXT}}');
      const stepAt = prompt.indexOf('{{STEP}}');
      assert.ok(issueAt >= 0 && issueAt < stepAt);
      assert.match(prompt, /Do not search for `sdd\.mjs`, `bin\/`, or `node_modules`, and do not read them/);
    });

    scenario('An empty issue stays empty', async () => {
      runAgent.mockClear();
      const root = mkdtempSync(path.join(tmpdir(), 'sdd-issue-empty-'));
      const runtime = launcherRuntime({
        root,
        vcs: idleVcs(root),
        config: {queues: [{name: 'FIRST'}], branchScope: 'sdd', base: 'trunk'},
      });
      await runtime.run({
        skill: 'plan',
        action: 'create-proposal',
        key: '6',
        phase: 'proposing',
        pull: '',
        mode: 'judgment',
        issue: {title: '  ', body: '\n'},
      });
      const text = runAgent.mock.calls[0]?.[0].promptArgs.ISSUE_TEXT ?? '';
      assert.match(text, /^# \n\n\n\nThe issue has no description\.$/m);
      assert.equal(text.includes('# Issue'), false);
      assert.match(text, /Do not search the repository for this issue/);
    });
  });
});
