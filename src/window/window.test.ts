import assert from 'node:assert/strict';
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'vitest';
import {parse} from 'yaml';

import {openWindow} from './window.ts';

function scratch(): {dir: string; home: string} {
  const dir = mkdtempSync(path.join(tmpdir(), 'ai-factory-home-'));
  return {dir, home: path.join(dir, 'home.yaml')};
}

test('a launch with no home path shows one row that the factory still needs an agent', () => {
  const window = openWindow({});
  const board = window.board();
  assert.equal(board.visible, true);
  assert.deepEqual(board.rows, [{text: 'фабрике ещё нужен агент'}]);
  assert.equal(board.settingsOpen, false);
  assert.equal(board.stepsStart, false);
  assert.equal(board.takeDisabled, true);
  window.take();
  window.spy();
  assert.equal(board.rows.length, 1);
});

test('a missing home file shows the board and does not start a step', () => {
  const {dir, home} = scratch();
  let started = 0;
  let assignees = 0;
  const window = openWindow(
    {homePath: home},
    {
      startStep: () => {
        started += 1;
      },
      writeAssignee: () => {
        assignees += 1;
      },
    },
  );
  const board = window.board();
  assert.equal(board.visible, true);
  assert.deepEqual(board.rows, [{text: 'фабрике ещё нужен агент'}]);
  assert.equal(board.settingsOpen, false);
  assert.equal(board.stepsStart, false);
  assert.equal(board.takeDisabled, true);
  window.spy();
  window.take();
  assert.equal(started, 0);
  assert.equal(assignees, 0);
  rmSync(dir, {recursive: true, force: true});
});

test('choosing cursor writes its pair and omits effort and speed', () => {
  const {dir, home} = scratch();
  const window = openWindow({homePath: home});
  window.chooseAgent('cursor');
  const doc = parse(readFileSync(home, 'utf8')) as {
    agent?: string;
    models?: {mechanical?: string; judgment?: string};
    effort?: unknown;
    speed?: unknown;
  };
  assert.equal(doc.agent, 'cursor');
  assert.equal(doc.models?.mechanical, 'composer-2.5-fast');
  assert.equal(doc.models?.judgment, 'grok-4.7-high-fast');
  assert.equal(doc.effort, undefined);
  assert.equal(doc.speed, undefined);
  assert.equal(window.settings().effort, undefined);
  assert.equal(window.settings().speed, undefined);
  assert.equal(window.board().settingsOpen, false);
  assert.equal(window.board().stepsStart, true);
  assert.deepEqual(window.board().rows, []);
  rmSync(dir, {recursive: true, force: true});
});

type HomeDoc = {
  agent?: string;
  models?: {mechanical?: string; judgment?: string};
  effort?: {mechanical?: string; judgment?: string};
  speed?: unknown;
  person?: unknown;
  phase?: unknown;
  focus?: unknown;
  metrics?: unknown;
  watch?: unknown;
  roots?: unknown;
  roles?: unknown;
};

function readHome(file: string): HomeDoc {
  return parse(readFileSync(file, 'utf8')) as HomeDoc;
}

function assertNoEmptyStrings(value: unknown): void {
  if (typeof value === 'string') {
    assert.notEqual(value, '');
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      assertNoEmptyStrings(item);
    }
    return;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      assertNoEmptyStrings(item);
    }
  }
}

test('choosing codex writes its pair and effort and omits speed', () => {
  const {dir, home} = scratch();
  const window = openWindow({homePath: home});
  window.chooseAgent('codex');
  const doc = readHome(home);
  assert.equal(doc.agent, 'codex');
  assert.equal(doc.models?.mechanical, 'gpt-6-luna');
  assert.equal(doc.models?.judgment, 'gpt-6.1-sol');
  assert.deepEqual(doc.effort, {mechanical: 'low', judgment: 'high'});
  assert.equal(doc.speed, undefined);
  assertNoEmptyStrings(doc);
  assert.deepEqual(window.settings().effort, {mechanical: 'low', judgment: 'high'});
  assert.deepEqual(window.settings().speed, {mechanical: '', judgment: ''});
  rmSync(dir, {recursive: true, force: true});
});

test('choosing claude-code writes its pair and effort and omits speed', () => {
  const {dir, home} = scratch();
  const window = openWindow({homePath: home});
  window.chooseAgent('claude-code');
  const doc = readHome(home);
  assert.equal(doc.agent, 'claude-code');
  assert.equal(doc.models?.mechanical, 'sonnet');
  assert.equal(doc.models?.judgment, 'opus');
  assert.deepEqual(doc.effort, {mechanical: 'medium', judgment: 'medium'});
  assert.equal(doc.speed, undefined);
  assert.equal(window.settings().speed, undefined);
  assertNoEmptyStrings(doc);
  rmSync(dir, {recursive: true, force: true});
});

test('choosing opencode writes its pair and omits effort and speed', () => {
  const {dir, home} = scratch();
  const window = openWindow({homePath: home});
  window.chooseAgent('opencode');
  const doc = readHome(home);
  assert.equal(doc.agent, 'opencode');
  assert.equal(doc.models?.mechanical, 'moonshotai/kimi-k2.7-code');
  assert.equal(doc.models?.judgment, 'moonshotai/kimi-k3');
  assert.equal(doc.effort, undefined);
  assert.equal(doc.speed, undefined);
  assert.equal(window.settings().effort, undefined);
  assert.equal(window.settings().speed, undefined);
  assertNoEmptyStrings(doc);
  rmSync(dir, {recursive: true, force: true});
});

test('choosing an agent does not read a live catalog', () => {
  const {dir, home} = scratch();
  let reads = 0;
  const window = openWindow(
    {homePath: home},
    {
      catalog: () => {
        reads += 1;
        return {mechanical: 'not-the-pair', judgment: 'also-not'};
      },
    },
  );
  window.chooseAgent('cursor');
  assert.equal(reads, 0);
  const doc = readHome(home);
  assert.equal(doc.models?.mechanical, 'composer-2.5-fast');
  assert.equal(doc.models?.judgment, 'grok-4.7-high-fast');
  rmSync(dir, {recursive: true, force: true});
});

test('an agent without a known pair leaves both models empty', () => {
  const {dir, home} = scratch();
  const window = openWindow({homePath: home, agents: ['other']}, {answers: () => true});
  window.chooseAgent('other');
  const doc = readHome(home);
  assert.equal(doc.agent, 'other');
  assert.equal(doc.models, undefined);
  assert.equal(doc.effort, undefined);
  assert.equal(doc.speed, undefined);
  assertNoEmptyStrings(doc);
  assert.equal(window.settings().models.mechanical.value, '');
  assert.equal(window.settings().models.mechanical.needsValue, true);
  assert.equal(window.settings().models.judgment.value, '');
  assert.equal(window.settings().models.judgment.needsValue, true);
  assert.deepEqual(window.board().rows, [{text: 'нужны модели mechanical и judgment'}]);
  rmSync(dir, {recursive: true, force: true});
});

test('no home path writes no file when the manager chooses an agent', () => {
  let started = 0;
  const window = openWindow(
    {},
    {
      startStep: () => {
        started += 1;
      },
      catalog: () => {
        throw new Error('catalog');
      },
    },
  );
  window.chooseAgent('cursor');
  window.spy();
  assert.equal(started, 0);
  assert.deepEqual(window.board().rows, [{text: 'фабрике ещё нужен агент'}]);
  assert.equal(window.settings().agent, '');
  assert.equal(window.board().takeDisabled, true);
});

test('an empty agent list writes no home file', () => {
  const {dir, home} = scratch();
  const window = openWindow({homePath: home, agents: []});
  window.chooseAgent('cursor');
  window.chooseAgent('codex');
  assert.equal(existsSync(home), false);
  assert.deepEqual(window.board().rows, [{text: 'фабрике ещё нужен агент'}]);
  rmSync(dir, {recursive: true, force: true});
});

test('leaving a model empty writes that field', () => {
  const {dir, home} = scratch();
  const window = openWindow({homePath: home}, {answers: () => true});
  window.chooseAgent('cursor');
  window.leaveModel('mechanical', '');
  assert.equal(readHome(home).models?.mechanical, '');
  assert.equal(readHome(home).models?.judgment, 'grok-4.7-high-fast');
  assert.equal(window.settings().models.mechanical.needsValue, true);
  assert.equal(window.settings().models.judgment.needsValue, false);
  assert.deepEqual(window.board().rows, [{text: 'нужна модель mechanical'}]);
  window.leaveModel('judgment', '');
  const doc = readHome(home);
  assert.equal(doc.models?.mechanical, '');
  assert.equal(doc.models?.judgment, '');
  assert.equal(window.settings().models.judgment.needsValue, true);
  assert.deepEqual(window.board().rows, [{text: 'нужны модели mechanical и judgment'}]);
  window.leaveModel('judgment', 'grok-4.7-high-fast');
  assert.equal(readHome(home).models?.judgment, 'grok-4.7-high-fast');
  assert.equal(readHome(home).models?.mechanical, '');
  assert.deepEqual(window.board().rows, [{text: 'нужна модель mechanical'}]);
  rmSync(dir, {recursive: true, force: true});
});

test('an empty model stops the window spy', () => {
  const {dir, home} = scratch();
  let started = 0;
  const window = openWindow(
    {homePath: home},
    {
      answers: () => true,
      startStep: () => {
        started += 1;
      },
    },
  );
  window.chooseAgent('cursor');
  window.spy();
  assert.equal(started, 1);
  window.leaveModel('judgment', '');
  window.spy();
  assert.equal(started, 1);
  assert.equal(window.board().stepsStart, false);
  rmSync(dir, {recursive: true, force: true});
});

test('empty effort and speed are the agent default and do not stop a step', () => {
  const {dir, home} = scratch();
  let started = 0;
  const window = openWindow(
    {homePath: home},
    {
      answers: () => true,
      startStep: () => {
        started += 1;
      },
    },
  );
  window.chooseAgent('codex');
  window.leaveEffort('mechanical', '');
  window.leaveEffort('judgment', '');
  window.leaveSpeed('mechanical', '');
  window.leaveSpeed('judgment', '');
  const doc = readHome(home);
  assert.equal(doc.agent, 'codex');
  assert.equal(doc.models?.mechanical, 'gpt-6-luna');
  assert.equal(doc.models?.judgment, 'gpt-6.1-sol');
  assert.equal(doc.effort, undefined);
  assert.equal(doc.speed, undefined);
  assert.deepEqual(window.settings().effort, {mechanical: 'low', judgment: 'high'});
  assert.deepEqual(window.settings().speed, {mechanical: '', judgment: ''});
  window.spy();
  assert.equal(started, 1);
  assert.equal(window.board().stepsStart, true);
  rmSync(dir, {recursive: true, force: true});
});

test('a newer home file blocks the write and the window shows the disk', () => {
  const {dir, home} = scratch();
  writeFileSync(
    home,
    [
      'agent: cursor',
      'models:',
      '  mechanical: composer-2.5-fast',
      '  judgment: grok-4.7-high-fast',
      '',
    ].join('\n'),
  );
  const window = openWindow({homePath: home});
  const disk = [
    'agent: codex',
    'models:',
    '  mechanical: gpt-6-luna',
    '  judgment: gpt-6.1-sol',
    'effort:',
    '  mechanical: low',
    '  judgment: high',
    '',
  ].join('\n');
  writeFileSync(home, disk);
  window.chooseAgent('opencode');
  assert.equal(readFileSync(home, 'utf8'), disk);
  assert.equal(window.settings().agent, 'codex');
  assert.equal(window.settings().models.mechanical.value, 'gpt-6-luna');
  assert.equal(window.settings().models.judgment.value, 'gpt-6.1-sol');
  window.chooseAgent('cursor');
  assert.equal(readHome(home).agent, 'cursor');
  rmSync(dir, {recursive: true, force: true});
});

test('closing settings does not erase the home file', () => {
  const {dir, home} = scratch();
  const window = openWindow({homePath: home});
  window.chooseAgent('cursor');
  const written = readFileSync(home, 'utf8');
  window.openSettings();
  window.closeSettings();
  assert.equal(readFileSync(home, 'utf8'), written);
  assert.equal(window.settings().open, false);
  assert.equal(window.board().settingsOpen, false);
  assert.equal(readHome(home).agent, 'cursor');
  rmSync(dir, {recursive: true, force: true});
});

test('changing the agent replaces the set and drops old effort and speed', () => {
  const {dir, home} = scratch();
  const window = openWindow({homePath: home});
  window.chooseAgent('cursor');
  window.chooseAgent('codex');
  let doc = readHome(home);
  assert.equal(doc.agent, 'codex');
  assert.equal(doc.models?.mechanical, 'gpt-6-luna');
  assert.equal(doc.models?.judgment, 'gpt-6.1-sol');
  assert.deepEqual(doc.effort, {mechanical: 'low', judgment: 'high'});
  assert.equal(doc.speed, undefined);
  assert.equal(JSON.stringify(doc).includes('composer-2.5-fast'), false);
  assert.equal(JSON.stringify(doc).includes('grok-4.7-high-fast'), false);
  assertNoEmptyStrings(doc);
  window.chooseAgent('opencode');
  doc = readHome(home);
  assert.equal(doc.agent, 'opencode');
  assert.equal(doc.models?.mechanical, 'moonshotai/kimi-k2.7-code');
  assert.equal(doc.models?.judgment, 'moonshotai/kimi-k3');
  assert.equal(doc.effort, undefined);
  assert.equal(doc.speed, undefined);
  assert.equal(JSON.stringify(doc).includes('gpt-6-luna'), false);
  assertNoEmptyStrings(doc);
  window.chooseAgent('cursor');
  doc = readHome(home);
  assert.equal(doc.effort, undefined);
  assert.equal(doc.speed, undefined);
  assert.equal(doc.models?.mechanical, 'composer-2.5-fast');
  assertNoEmptyStrings(doc);
  rmSync(dir, {recursive: true, force: true});
});

test('a recorded agent that does not answer stays in the file', () => {
  const {dir, home} = scratch();
  const body = [
    'agent: cursor',
    'models:',
    '  mechanical: composer-2.5-fast',
    '  judgment: grok-4.7-high-fast',
    '',
  ].join('\n');
  writeFileSync(home, body);
  const asked: string[] = [];
  let started = 0;
  let assignees = 0;
  const window = openWindow(
    {homePath: home},
    {
      answers: agentId => {
        asked.push(agentId);
        return false;
      },
      startStep: () => {
        started += 1;
      },
      writeAssignee: () => {
        assignees += 1;
      },
    },
  );
  assert.deepEqual(window.board().rows, [{text: 'агент не отвечает'}]);
  assert.equal(window.board().visible, true);
  assert.equal(window.board().settingsOpen, false);
  assert.equal(window.board().stepsStart, false);
  assert.equal(window.board().takeDisabled, true);
  window.spy();
  window.take();
  assert.equal(started, 0);
  assert.equal(assignees, 0);
  assert.equal(readFileSync(home, 'utf8'), body);
  assert.ok(asked.includes('cursor'));
  rmSync(dir, {recursive: true, force: true});
});

test('a silent agent hides the empty-model row', () => {
  const {dir, home} = scratch();
  const body = [
    'agent: cursor',
    'models:',
    '  mechanical: composer-2.5-fast',
    '  judgment: ""',
    '',
  ].join('\n');
  writeFileSync(home, body);
  const window = openWindow({homePath: home}, {answers: () => false});
  assert.deepEqual(window.board().rows, [{text: 'агент не отвечает'}]);
  assert.equal(readFileSync(home, 'utf8'), body);
  rmSync(dir, {recursive: true, force: true});
});

test('the home file gains no person, phase, focus, or metrics', () => {
  const {dir, home} = scratch();
  writeFileSync(
    home,
    [
      'person: ada',
      'phase: implementing',
      'focus: gap',
      'metrics:',
      '  n: 1',
      'watch:',
      '  - LAVKAOPSCORE',
      'roots:',
      '  arcadia: ~/arcadia',
      '  github: ~/github',
      'roles: []',
      'agent: cursor',
      'models:',
      '  mechanical: composer-2.5-fast',
      '  judgment: grok-4.7-high-fast',
      '',
    ].join('\n'),
  );
  const window = openWindow({homePath: home});
  window.chooseAgent('codex');
  window.take();
  const doc = readHome(home);
  assert.equal(doc.person, undefined);
  assert.equal(doc.phase, undefined);
  assert.equal(doc.focus, undefined);
  assert.equal(doc.metrics, undefined);
  assert.deepEqual(doc.watch, ['LAVKAOPSCORE']);
  assert.deepEqual(doc.roots, {arcadia: '~/arcadia', github: '~/github'});
  assert.deepEqual(doc.roles, []);
  assert.equal(doc.agent, 'codex');
  rmSync(dir, {recursive: true, force: true});
});

test('two launches do not share a home file', () => {
  const left = scratch();
  const right = scratch();
  const a = openWindow({homePath: left.home});
  const b = openWindow({homePath: right.home});
  a.chooseAgent('cursor');
  b.chooseAgent('codex');
  assert.equal(readHome(left.home).agent, 'cursor');
  assert.equal(readHome(left.home).models?.mechanical, 'composer-2.5-fast');
  assert.equal(readHome(right.home).agent, 'codex');
  assert.equal(readHome(right.home).effort?.mechanical, 'low');
  assert.equal(readHome(left.home).agent, 'cursor');
  rmSync(left.dir, {recursive: true, force: true});
  rmSync(right.dir, {recursive: true, force: true});
});

test('a missing home file leaves settings closed until the manager opens them', () => {
  const {dir, home} = scratch();
  const window = openWindow({homePath: home});
  assert.equal(window.settings().open, false);
  assert.equal(window.board().settingsOpen, false);
  window.openSettings();
  assert.equal(window.settings().open, true);
  assert.equal(window.board().settingsOpen, true);
  assert.deepEqual(window.board().rows, [{text: 'фабрике ещё нужен агент'}]);
  assert.equal(existsSync(home), false);
  window.closeSettings();
  assert.equal(existsSync(home), false);
  assert.equal(window.settings().open, false);
  rmSync(dir, {recursive: true, force: true});
});
