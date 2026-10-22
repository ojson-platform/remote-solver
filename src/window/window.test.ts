import assert from 'node:assert/strict';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {homedir, tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'vitest';
import {parse} from 'yaml';

import {memoryPorts} from '../adapters/github.ts';
import type {FileSource} from '../machine/port.ts';
import {loadCycle} from '../machine/snapshot.ts';
import {changeDir} from '../machine/naming.ts';
import {openWindow, type WindowTicket} from './window.ts';

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

function yard(): {dir: string; home: string; arcadia: string; github: string} {
  const dir = mkdtempSync(path.join(tmpdir(), 'ai-factory-watch-'));
  const arcadia = path.join(dir, 'arcadia');
  const github = path.join(dir, 'github');
  mkdirSync(arcadia, {recursive: true});
  mkdirSync(github, {recursive: true});
  return {dir, home: path.join(dir, 'home.yaml'), arcadia, github};
}

function writeLaunch(
  home: string,
  watch: readonly string[],
  roots: {arcadia?: string; github?: string},
): void {
  const lines = ['watch:'];
  for (const name of watch) {
    lines.push(`  - ${name}`);
  }
  lines.push('roots:');
  if (roots.arcadia !== undefined) {
    lines.push(`  arcadia: ${roots.arcadia}`);
  }
  if (roots.github !== undefined) {
    lines.push(`  github: ${roots.github}`);
  }
  lines.push('');
  writeFileSync(home, lines.join('\n'));
}

function writeServiceConfig(checkout: string, queues: readonly string[]): void {
  const dir = path.join(checkout, 'openspec');
  mkdirSync(dir, {recursive: true});
  const lines = ['sdd:', '  queues:'];
  for (const name of queues) {
    lines.push(`    - name: ${name}`);
  }
  lines.push('');
  writeFileSync(path.join(dir, 'config.yaml'), lines.join('\n'));
}

function writeOverlay(checkout: string, watch: readonly string[], extra = ''): void {
  const dir = path.join(checkout, '.aifactory');
  mkdirSync(dir, {recursive: true});
  const lines = ['watch:'];
  for (const name of watch) {
    lines.push(`  - ${name}`);
  }
  writeFileSync(path.join(dir, 'config.yaml'), `${lines.join('\n')}\n${extra}`);
}

function ticket(over: Partial<WindowTicket> & Pick<WindowTicket, 'key'>): WindowTicket {
  return {title: over.key, labels: ['sdd:cycle'], ...over};
}

test('the user block writes the watch list and the roots immediately', () => {
  const {dir, home} = scratch();
  const window = openWindow({homePath: home, adapter: 'tracker'});
  window.chooseAgent('cursor');
  window.leaveWatch(['alpha', 'alpha', 'beta']);
  window.leaveRoots({arcadia: '/arcadia', github: '/github'});
  const doc = readHome(home);
  assert.deepEqual(doc.watch, ['alpha', 'beta']);
  assert.deepEqual(doc.roots, {arcadia: '/arcadia', github: '/github'});
  assert.equal(doc.agent, 'cursor');
  assert.equal((doc as {system?: unknown}).system, undefined);
  const disk = readFileSync(home, 'utf8');
  writeFileSync(home, disk.replace('cursor', 'codex'));
  window.leaveWatch(['gamma']);
  assert.equal(readFileSync(home, 'utf8').includes('gamma'), false);
  assert.equal(readHome(home).agent, 'codex');
  rmSync(dir, {recursive: true, force: true});
});

test('an empty root leaves ~/arcadia or ~/github', () => {
  const {dir, home, github} = yard();
  writeLaunch(home, ['alpha'], {arcadia: '', github});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})],
    },
  );
  window.leaveRoots({arcadia: '   ', github: ''});
  const doc = readHome(home);
  assert.equal(doc.roots?.arcadia, undefined);
  assert.equal(doc.roots?.github, undefined);
  assert.equal(window.settings().roots.arcadia, '~/arcadia');
  assert.equal(window.settings().roots.github, '~/github');
  const card = window.board().pool.find(item => item.key === '1');
  assert.ok(card);
  assert.equal(card.checkout, path.join(homedir(), 'arcadia', 'services', 'billing'));
  assert.equal(card.queue, 'alpha');
  assert.deepEqual(card.choices, []);
  assert.equal(
    window.board().cards.some(item => item.key === '1'),
    false,
  );
  rmSync(dir, {recursive: true, force: true});
});

test('an overlay does not replace the checkout roots', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha']);
  writeOverlay(checkout, ['alpha'], 'roots:\n  arcadia: /wrong\n');
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})],
    },
  );
  const card = window.board().pool.find(item => item.key === '1');
  assert.ok(card);
  assert.equal(card.checkout, checkout);
  assert.equal(card.checkout?.startsWith('/wrong'), false);
  assert.equal(card.queue, 'alpha');
  assert.deepEqual(card.choices, ['services/billing']);
  assert.equal(
    window.board().cards.some(item => item.key === '1'),
    false,
  );
  rmSync(dir, {recursive: true, force: true});
});

test('tracker gathers the checkout under the arcadia root', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})],
    },
  );
  const card = window.board().pool.find(item => item.key === '1');
  assert.ok(card);
  assert.equal(card.checkout, checkout);
  assert.equal(card.queue, 'alpha');
  assert.deepEqual(card.choices, []);
  assert.equal(card.reason, 'каталога нет');
  assert.equal(
    window.board().cards.some(item => item.key === '1'),
    false,
  );
  assert.equal(existsSync(checkout), false);
  rmSync(dir, {recursive: true, force: true});
});

test('github gathers under the repository and an empty sddService is that root', () => {
  const {dir, home, github} = yard();
  const repo = path.join(github, 'acme', 'billing');
  const nested = path.join(repo, 'services', 'api');
  mkdirSync(nested, {recursive: true});
  writeServiceConfig(nested, ['alpha']);
  writeServiceConfig(repo, ['alpha']);
  writeLaunch(home, ['acme/billing'], {github});
  const tickets = [
    ticket({
      key: '1',
      repo: 'acme/billing',
      sddService: 'services/api',
      labels: ['alpha', 'sdd:cycle'],
    }),
    ticket({
      key: '2',
      repo: 'acme/billing',
      sddService: '',
      labels: ['alpha', 'sdd:cycle'],
    }),
  ];
  const window = openWindow({homePath: home, adapter: 'github'}, {tickets: () => tickets});
  const board = window.board();
  const nestedCard = board.pool.find(item => item.key === '1');
  const rootCard = board.pool.find(item => item.key === '2');
  assert.ok(nestedCard);
  assert.ok(rootCard);
  assert.equal(nestedCard.checkout, nested);
  assert.equal(nestedCard.queue, 'alpha');
  assert.deepEqual(nestedCard.choices, ['', 'services/api']);
  assert.equal(rootCard.checkout, repo);
  assert.equal(rootCard.queue, 'alpha');
  assert.deepEqual(rootCard.choices, ['', 'services/api']);
  assert.equal(rootCard.reason, undefined);
  assert.equal(rootCard.icon, undefined);
  assert.deepEqual(board.cards, []);
  rmSync(dir, {recursive: true, force: true});
});

test('a path with .. or outside the root is a missing catalog', () => {
  const {dir, home, arcadia} = yard();
  const inside = path.join(arcadia, 'billing');
  mkdirSync(inside, {recursive: true});
  writeServiceConfig(inside, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia});
  const tickets = [
    ticket({key: '1', queue: 'alpha', sddService: '../outside'}),
    ticket({key: '2', queue: 'alpha', sddService: 'services/../billing'}),
  ];
  const window = openWindow({homePath: home, adapter: 'tracker'}, {tickets: () => tickets});
  const board = window.board();
  const broken = (key: string) => board.pool.find(item => item.key === key);
  assert.equal(broken('1')?.reason, 'каталога нет');
  assert.equal(broken('2')?.reason, 'каталога нет');
  assert.equal(
    board.cards.some(item => item.key === '1' || item.key === '2'),
    false,
  );
  assert.equal(existsSync(path.resolve(arcadia, '../outside')), false);
  assert.equal(existsSync(inside), true);
  rmSync(dir, {recursive: true, force: true});
});

test('an overlay watch name joins the home list and a repeated name is one', () => {
  const {dir, home, arcadia} = yard();
  const billing = path.join(arcadia, 'services', 'billing');
  const other = path.join(arcadia, 'services', 'other');
  mkdirSync(billing, {recursive: true});
  mkdirSync(other, {recursive: true});
  writeOverlay(billing, ['beta', 'alpha']);
  writeServiceConfig(billing, ['alpha']);
  writeServiceConfig(other, ['beta']);
  writeLaunch(home, ['alpha', 'alpha'], {arcadia});
  const tickets = [
    ticket({key: '1', queue: 'alpha', sddService: 'services/billing'}),
    ticket({key: '2', queue: 'beta', sddService: 'services/other'}),
  ];
  const window = openWindow({homePath: home, adapter: 'tracker'}, {tickets: () => tickets});
  const board = window.board();
  assert.deepEqual(board.watch, ['alpha', 'beta']);
  assert.deepEqual(
    board.pool.map(item => item.key),
    ['1', '2'],
  );
  assert.deepEqual(board.cards, []);
  rmSync(dir, {recursive: true, force: true});
});

test('a name removed from one file stays while the other file still has it', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeOverlay(checkout, ['alpha']);
  writeServiceConfig(checkout, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  assert.deepEqual(window.board().watch, ['alpha']);
  window.leaveWatch([]);
  assert.deepEqual(window.board().watch, ['alpha']);
  writeOverlay(checkout, []);
  assert.deepEqual(window.board().watch, []);
  assert.deepEqual(window.board().cards, []);
  rmSync(dir, {recursive: true, force: true});
});

test('a fresh launch still reads an overlay after home drops the name', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeOverlay(checkout, ['alpha']);
  writeServiceConfig(checkout, ['alpha']);
  writeLaunch(home, [], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  assert.deepEqual(window.board().watch, ['alpha']);
  assert.deepEqual(
    window.board().pool.map(item => item.key),
    ['1'],
  );
  assert.deepEqual(window.board().cards, []);
  rmSync(dir, {recursive: true, force: true});
});

test('a name only in an overlay under the old root leaves when the roots change', () => {
  const {dir, home} = yard();
  const oldRoot = path.join(dir, 'old-arcadia');
  const newRoot = path.join(dir, 'new-arcadia');
  const oldCheckout = path.join(oldRoot, 'services', 'billing');
  mkdirSync(oldCheckout, {recursive: true});
  writeOverlay(oldCheckout, ['beta']);
  writeServiceConfig(oldCheckout, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia: oldRoot});
  const tickets = [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})];
  const window = openWindow({homePath: home, adapter: 'tracker'}, {tickets: () => tickets});
  assert.deepEqual(window.board().watch, ['alpha', 'beta']);
  window.leaveRoots({arcadia: newRoot});
  assert.deepEqual(window.board().watch, ['alpha']);
  const reached = path.join(newRoot, 'services', 'billing');
  mkdirSync(reached, {recursive: true});
  writeOverlay(reached, ['beta']);
  assert.deepEqual(window.board().watch, ['alpha', 'beta']);
  rmSync(dir, {recursive: true, force: true});
});

test('empty watch lists leave the board with no cards', () => {
  const {dir, home, arcadia} = yard();
  writeLaunch(home, [], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  const board = window.board();
  assert.deepEqual(board.watch, []);
  assert.deepEqual(board.cards, []);
  rmSync(dir, {recursive: true, force: true});
});

test('service queues do not join the watch list', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha', 'gamma']);
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      tickets: () => [
        ticket({key: '1', queue: 'alpha', sddService: 'services/billing'}),
        ticket({key: '2', queue: 'gamma', sddService: 'services/billing'}),
      ],
    },
  );
  const board = window.board();
  assert.deepEqual(board.watch, ['alpha']);
  assert.deepEqual(
    board.pool.map(item => item.key),
    ['1'],
  );
  assert.deepEqual(board.cards, []);
  rmSync(dir, {recursive: true, force: true});
});

test('a tracker ticket is selected by the port queue and a label does not replace it', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha', 'beta']);
  writeLaunch(home, ['beta', 'alpha'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      tickets: () => [
        ticket({
          key: '1',
          queue: 'alpha',
          labels: ['beta', 'sdd:cycle'],
          sddService: 'services/billing',
        }),
        ticket({
          key: '2',
          queue: 'beta',
          labels: ['alpha', 'sdd:cycle'],
          sddService: 'services/billing',
        }),
      ],
    },
  );
  const board = window.board();
  const alpha = board.pool.find(item => item.key === '1');
  const beta = board.pool.find(item => item.key === '2');
  assert.ok(alpha);
  assert.ok(beta);
  assert.equal(alpha.queue, 'alpha');
  assert.equal(alpha.checkout, checkout);
  assert.deepEqual(alpha.choices, ['services/billing']);
  assert.equal(beta.queue, 'beta');
  assert.equal(beta.checkout, checkout);
  assert.deepEqual(beta.choices, ['services/billing']);
  assert.deepEqual(board.cards, []);
  rmSync(dir, {recursive: true, force: true});
});

test('a github queue is the first sdd.queues name on the issue and the key is owner/repo', () => {
  const {dir, home, github} = yard();
  const repo = path.join(github, 'acme', 'billing');
  mkdirSync(repo, {recursive: true});
  writeServiceConfig(repo, ['alpha', 'beta']);
  writeLaunch(home, ['beta', 'acme/billing'], {github});
  const window = openWindow(
    {homePath: home, adapter: 'github'},
    {
      tickets: () => [
        ticket({
          key: '1',
          repo: 'acme/billing',
          sddService: '',
          labels: ['beta', 'alpha', 'sdd:cycle'],
        }),
        ticket({
          key: '2',
          repo: 'other/billing',
          sddService: '',
          labels: ['alpha', 'sdd:cycle'],
        }),
        ticket({
          key: '3',
          repo: 'acme/billing',
          sddService: '',
          labels: ['sdd:cycle'],
        }),
      ],
    },
  );
  const board = window.board();
  const matched = board.pool.find(item => item.key === '1');
  const missing = board.pool.find(item => item.key === '3');
  assert.ok(matched);
  assert.equal(matched.queue, 'alpha');
  assert.equal(matched.checkout, repo);
  assert.deepEqual(matched.choices, ['']);
  assert.equal(
    board.pool.some(item => item.key === '2'),
    false,
  );
  assert.equal(
    board.cards.some(item => item.key === '2'),
    false,
  );
  assert.ok(missing);
  assert.equal(missing.queue, '');
  assert.equal(missing.checkout, repo);
  assert.deepEqual(missing.choices, ['']);
  assert.equal(missing.reason, 'очереди нет в конфиге сервиса');
  assert.equal(missing.takeDisabled, true);
  rmSync(dir, {recursive: true, force: true});
});

test('sdd:cycle is still required for a card', () => {
  const {dir, home, arcadia, github} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha']);
  writeLaunch(home, ['alpha', 'acme/billing'], {arcadia, github});
  const tracker = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      tickets: () => [
        ticket({key: '1', queue: 'alpha', labels: ['alpha'], sddService: 'services/billing'}),
      ],
    },
  );
  assert.deepEqual(tracker.board().cards, []);
  const repo = path.join(github, 'acme', 'billing');
  mkdirSync(repo, {recursive: true});
  writeServiceConfig(repo, ['alpha']);
  const hub = openWindow(
    {homePath: home, adapter: 'github'},
    {tickets: () => [ticket({key: '2', repo: 'acme/billing', sddService: '', labels: ['alpha']})]},
  );
  assert.deepEqual(hub.board().cards, []);
  rmSync(dir, {recursive: true, force: true});
});

test('the first checkout break is the only reason and take does not write the assignee', () => {
  const {dir, home, arcadia} = yard();
  const bare = path.join(arcadia, 'services', 'bare');
  const other = path.join(arcadia, 'services', 'other');
  mkdirSync(bare, {recursive: true});
  mkdirSync(other, {recursive: true});
  writeServiceConfig(other, ['elsewhere']);
  writeLaunch(home, ['alpha'], {arcadia});
  let assignees = 0;
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      answers: () => true,
      writeAssignee: () => {
        assignees += 1;
      },
      tickets: () => [
        ticket({key: '1', queue: 'alpha', sddService: 'services/missing'}),
        ticket({key: '2', queue: 'alpha', sddService: ''}),
        ticket({key: '3', queue: 'alpha'}),
        ticket({key: '4', queue: 'alpha', sddService: 'services/bare'}),
        ticket({key: '5', queue: 'alpha', sddService: 'services/other'}),
      ],
    },
  );
  window.chooseAgent('cursor');
  const board = window.board();
  const reason = (key: string) => board.pool.find(item => item.key === key);
  assert.equal(reason('1')?.reason, 'каталога нет');
  assert.equal(reason('1')?.reason?.startsWith('конфига сервиса нет'), false);
  assert.equal(reason('2')?.reason, 'не назван сервис');
  assert.equal(reason('3')?.reason, 'не назван сервис');
  assert.equal(reason('4')?.reason, 'конфига сервиса нет');
  assert.equal(reason('5')?.reason, 'очереди нет в конфиге сервиса');
  assert.deepEqual(board.cards, []);
  for (const card of board.pool) {
    assert.equal(card.takeDisabled, true);
    window.take(card.key);
  }
  assert.equal(assignees, 0);
  assert.equal(window.board().takeDisabled, false);
  rmSync(dir, {recursive: true, force: true});
});

test('a missing catalog keeps the card and the choice and does not start a step', () => {
  const {dir, home, arcadia} = yard();
  const billing = path.join(arcadia, 'services', 'billing');
  mkdirSync(billing, {recursive: true});
  writeServiceConfig(billing, ['alpha', 'beta']);
  writeLaunch(home, ['alpha', 'beta'], {arcadia});
  let started = 0;
  let assignees = 0;
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      answers: () => true,
      startStep: () => {
        started += 1;
      },
      writeAssignee: () => {
        assignees += 1;
      },
      tickets: () => [
        ticket({key: '1', queue: 'alpha', sddService: 'services/billing'}),
        ticket({key: '2', queue: 'beta', sddService: 'services/gone'}),
      ],
    },
  );
  window.chooseAgent('cursor');
  const board = window.board();
  const gone = board.pool.find(item => item.key === '2');
  assert.ok(gone);
  assert.equal(gone.checkout, path.join(arcadia, 'services', 'gone'));
  assert.equal(gone.queue, 'beta');
  assert.equal(gone.reason, 'каталога нет');
  assert.deepEqual(gone.choices, ['services/billing']);
  assert.equal(
    board.cards.some(item => item.key === '2'),
    false,
  );
  assert.equal(existsSync(path.join(arcadia, 'services', 'gone')), false);
  window.take('2');
  window.spy();
  assert.equal(assignees, 0);
  assert.equal(started, 1);
  rmSync(dir, {recursive: true, force: true});
});

test('one tracker service that already lists the queue writes itself', () => {
  const {dir, home, arcadia} = yard();
  const billing = path.join(arcadia, 'services', 'billing');
  const other = path.join(arcadia, 'services', 'other');
  mkdirSync(billing, {recursive: true});
  mkdirSync(other, {recursive: true});
  writeServiceConfig(billing, ['alpha']);
  writeServiceConfig(other, ['beta']);
  writeLaunch(home, ['alpha'], {arcadia});
  const tickets = [
    ticket({key: '1', queue: 'alpha', sddService: 'services/billing'}),
    ticket({key: '2', queue: 'alpha', sddService: 'services/other'}),
    ticket({key: '3', queue: 'alpha'}),
  ];
  const writes: {key: string; service: string}[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      tickets: () => tickets,
      writeService: (key, service) => {
        writes.push({key, service});
        const found = tickets.find(item => item.key === key);
        if (found) {
          found.sddService = service;
        }
      },
    },
  );
  const board = window.board();
  const card = board.pool.find(item => item.key === '3');
  assert.ok(card);
  assert.deepEqual(writes, [{key: '3', service: 'services/billing'}]);
  assert.equal(card.checkout, billing);
  assert.equal(card.queue, 'alpha');
  assert.deepEqual(card.choices, ['services/billing']);
  assert.equal(card.reason, undefined);
  assert.equal(card.icon, undefined);
  assert.equal(
    board.cards.some(item => item.key === '3'),
    false,
  );
  rmSync(dir, {recursive: true, force: true});
});

test('a blank tracker sddService writes the single service that lists the queue', () => {
  const {dir, home, arcadia} = yard();
  const billing = path.join(arcadia, 'services', 'billing');
  mkdirSync(billing, {recursive: true});
  writeServiceConfig(billing, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia});
  const tickets = [
    ticket({key: '1', queue: 'alpha', sddService: 'services/billing'}),
    ticket({key: '2', queue: 'alpha', sddService: ''}),
  ];
  const writes: {key: string; service: string}[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      tickets: () => tickets,
      writeService: (key, service) => {
        writes.push({key, service});
        const found = tickets.find(item => item.key === key);
        if (found) {
          found.sddService = service;
        }
      },
    },
  );
  const board = window.board();
  const card = board.pool.find(item => item.key === '2');
  assert.ok(card);
  assert.deepEqual(writes, [{key: '2', service: 'services/billing'}]);
  assert.equal(card.checkout, billing);
  assert.equal(card.queue, 'alpha');
  assert.deepEqual(card.choices, ['services/billing']);
  assert.equal(card.reason, undefined);
  assert.equal(card.icon, undefined);
  assert.equal(
    board.cards.some(item => item.key === '2'),
    false,
  );
  rmSync(dir, {recursive: true, force: true});
});

test('several tracker services that list the queue stay a choice', () => {
  const {dir, home, arcadia} = yard();
  const billing = path.join(arcadia, 'services', 'billing');
  const other = path.join(arcadia, 'services', 'other');
  mkdirSync(billing, {recursive: true});
  mkdirSync(other, {recursive: true});
  writeServiceConfig(billing, ['alpha']);
  writeServiceConfig(other, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia});
  let assignees = 0;
  const tickets = [
    ticket({key: '1', queue: 'alpha', sddService: 'services/billing'}),
    ticket({key: '2', queue: 'alpha', sddService: 'services/other'}),
    ticket({key: '3', queue: 'alpha'}),
  ];
  const writes: {key: string; service: string}[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      answers: () => true,
      tickets: () => tickets,
      writeService: (key, service) => {
        writes.push({key, service});
        const found = tickets.find(item => item.key === key);
        if (found) {
          found.sddService = service;
        }
      },
      writeAssignee: () => {
        assignees += 1;
      },
    },
  );
  const board = window.board();
  const card = board.pool.find(item => item.key === '3');
  assert.ok(card);
  assert.equal(card.checkout, undefined);
  assert.equal(card.queue, 'alpha');
  assert.deepEqual(card.choices, ['services/billing', 'services/other']);
  assert.equal(card.reason, 'не назван сервис');
  assert.equal(card.takeDisabled, true);
  assert.equal(
    board.cards.some(item => item.key === '3'),
    false,
  );
  assert.equal(
    writes.some(item => item.key === '3'),
    false,
  );
  window.take('3');
  assert.equal(assignees, 0);
  rmSync(dir, {recursive: true, force: true});
});

test('one github directory with an sdd key writes itself and several stay a choice', () => {
  const {dir, home, github} = yard();
  const alone = path.join(github, 'acme', 'alone');
  const many = path.join(github, 'acme', 'many');
  const api = path.join(many, 'services', 'api');
  mkdirSync(alone, {recursive: true});
  mkdirSync(api, {recursive: true});
  writeServiceConfig(alone, ['alpha']);
  writeServiceConfig(many, ['alpha']);
  writeServiceConfig(api, ['alpha']);
  writeFileSync(path.join(alone, 'openspec', 'skip.yaml'), ':\n');
  const broken = path.join(github, 'acme', 'broken');
  mkdirSync(path.join(broken, 'openspec'), {recursive: true});
  writeFileSync(path.join(broken, 'openspec', 'config.yaml'), ':\n');
  writeLaunch(home, ['acme/alone', 'acme/many', 'acme/broken'], {github});
  const tickets = [
    ticket({key: '1', repo: 'acme/alone', labels: ['alpha', 'sdd:cycle']}),
    ticket({key: '2', repo: 'acme/many', labels: ['alpha', 'sdd:cycle']}),
    ticket({key: '3', repo: 'acme/broken', labels: ['alpha', 'sdd:cycle']}),
  ];
  const writes: {key: string; service: string}[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'github'},
    {
      tickets: () => tickets,
      writeService: (key, service) => {
        writes.push({key, service});
        const found = tickets.find(item => item.key === key);
        if (found) {
          found.sddService = service;
        }
      },
    },
  );
  const board = window.board();
  assert.deepEqual(writes, [{key: '1', service: ''}]);
  const written = board.pool.find(item => item.key === '1');
  assert.ok(written);
  assert.equal(written.checkout, alone);
  assert.equal(written.queue, 'alpha');
  assert.deepEqual(written.choices, ['']);
  assert.equal(written.reason, undefined);
  assert.equal(written.icon, undefined);
  assert.equal(
    board.cards.some(item => item.key === '1'),
    false,
  );
  const choice = board.pool.find(item => item.key === '2');
  assert.ok(choice);
  assert.equal(choice.checkout, undefined);
  assert.equal(choice.queue, '');
  assert.deepEqual(choice.choices, ['', 'services/api']);
  assert.equal(choice.reason, 'не назван сервис');
  assert.equal(
    writes.some(item => item.key === '2'),
    false,
  );
  const unreadable = board.pool.find(item => item.key === '3');
  assert.ok(unreadable);
  assert.equal(unreadable.checkout, undefined);
  assert.equal(unreadable.queue, '');
  assert.deepEqual(unreadable.choices, []);
  assert.equal(unreadable.reason, 'не назван сервис');
  assert.deepEqual(board.cards, []);
  rmSync(dir, {recursive: true, force: true});
});

test('writing sddService keeps the queue break when the service still lacks the queue', () => {
  const {dir, home, github} = yard();
  const repo = path.join(github, 'acme', 'billing');
  const api = path.join(repo, 'services', 'api');
  const other = path.join(repo, 'services', 'other');
  mkdirSync(api, {recursive: true});
  mkdirSync(other, {recursive: true});
  writeServiceConfig(api, ['alpha']);
  writeServiceConfig(other, ['beta']);
  writeLaunch(home, ['acme/billing'], {github});
  const tickets = [ticket({key: '1', repo: 'acme/billing', labels: ['alpha', 'sdd:cycle']})];
  const window = openWindow(
    {homePath: home, adapter: 'github'},
    {
      tickets: () => tickets,
      writeService: (key, service) => {
        const found = tickets.find(item => item.key === key);
        if (found) {
          found.sddService = service;
        }
      },
    },
  );
  assert.equal(window.board().pool[0]?.reason, 'не назван сервис');
  assert.deepEqual(window.board().cards, []);
  window.chooseService('1', 'services/other');
  const card = window.board().pool.find(item => item.key === '1');
  assert.ok(card);
  assert.equal(card.reason, 'очереди нет в конфиге сервиса');
  assert.equal(card.takeDisabled, true);
  assert.equal(tickets[0].sddService, 'services/other');
  rmSync(dir, {recursive: true, force: true});
});

test('the window does not append the queue to the service config', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['beta']);
  writeLaunch(home, ['alpha'], {arcadia});
  const config = path.join(checkout, 'openspec', 'config.yaml');
  const before = readFileSync(config, 'utf8');
  let started = 0;
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      answers: () => true,
      startStep: () => {
        started += 1;
      },
      tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})],
    },
  );
  window.chooseAgent('cursor');
  window.take('1');
  window.spy();
  assert.equal(readFileSync(config, 'utf8'), before);
  assert.equal(started, 0);
  assert.equal(window.board().pool[0]?.reason, 'очереди нет в конфиге сервиса');
  assert.deepEqual(window.board().cards, []);
  rmSync(dir, {recursive: true, force: true});
});

test('the step reads the gathered checkout', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia});
  const started: string[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      answers: () => true,
      startStep: value => {
        started.push(value ?? '');
      },
      tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})],
    },
  );
  window.chooseAgent('cursor');
  window.spy();
  assert.deepEqual(started, [checkout]);
  assert.notEqual(started[0], process.cwd());
  assert.notEqual(started[0], dir);
  rmSync(dir, {recursive: true, force: true});
});

test('the board and the window spy read one watch list', () => {
  const {dir, home, arcadia} = yard();
  const billing = path.join(arcadia, 'services', 'billing');
  const other = path.join(arcadia, 'services', 'other');
  mkdirSync(billing, {recursive: true});
  mkdirSync(other, {recursive: true});
  writeServiceConfig(billing, ['alpha']);
  writeServiceConfig(other, ['beta']);
  writeLaunch(home, ['alpha'], {arcadia});
  const started: string[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      answers: () => true,
      startStep: value => {
        started.push(value ?? '');
      },
      tickets: () => [
        ticket({key: '1', queue: 'alpha', sddService: 'services/billing'}),
        ticket({key: '2', queue: 'beta', sddService: 'services/other'}),
      ],
    },
  );
  window.chooseAgent('cursor');
  const board = window.board();
  assert.deepEqual(board.watch, ['alpha']);
  assert.deepEqual(
    board.pool.map(item => item.key),
    ['1'],
  );
  assert.deepEqual(board.cards, []);
  window.spy();
  assert.deepEqual(started, [billing]);
  rmSync(dir, {recursive: true, force: true});
});

test('the machine spy leaves a bare cycle out and does not read .aifactory', async () => {
  const reads: string[] = [];
  const files: FileSource = {
    exists(rel) {
      reads.push(rel);
      return false;
    },
    read(rel) {
      reads.push(rel);
      return '';
    },
    list(rel) {
      reads.push(`list:${rel}`);
      return [];
    },
  };
  const {tracker, review} = memoryPorts({
    user: 'ada',
    issues: [
      {
        key: '1',
        title: 'bare',
        body: '',
        state: 'OPEN',
        labels: ['Sandcastle', 'sdd:cycle'],
        assignee: '',
      },
      {
        key: '2',
        title: 'held',
        body: '',
        state: 'OPEN',
        labels: ['Sandcastle', 'sdd:cycle'],
        assignee: 'ada',
      },
    ],
  });
  const snapshot = await loadCycle(tracker, review, () => files, [{name: 'Sandcastle'}]);
  assert.deepEqual(
    snapshot.cycles.map(issue => issue.key),
    ['2'],
  );
  assert.equal(
    reads.some(rel => rel.includes('.aifactory')),
    false,
  );
});

const MANAGER = 'ada';

const COLUMN_NAMES = [
  'proposing',
  'specifying',
  'designing',
  'tasking',
  'implementing',
  'verifying',
  'accepting',
];

function prepare(arcadia: string, home: string): string {
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia});
  return checkout;
}

function cycle(key: string, phase: string, over: Partial<WindowTicket> = {}): WindowTicket {
  return ticket({
    key,
    assignee: MANAGER,
    queue: 'alpha',
    sddService: 'services/billing',
    ...over,
    title: over.title ?? key,
    labels: over.labels ?? ['sdd:cycle', `sdd:${phase}`],
  });
}

function openCycles(
  home: string,
  tickets: readonly WindowTicket[],
  leading?: (key: string) => boolean,
) {
  return openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      leading,
      tickets: () => tickets,
    },
  );
}

function writeChange(checkout: string, key: string, name: string, body: string): void {
  const dir = path.join(checkout, changeDir(key));
  mkdirSync(dir, {recursive: true});
  writeFileSync(path.join(dir, name), body);
}

function columnCards(
  board: ReturnType<ReturnType<typeof openWindow>['board']>,
  name: string,
): {key: string}[] | undefined {
  return board.columns?.find(column => column.name === name)?.cards;
}

test('an empty specifying column stays and the window writes no phase', () => {
  const window = openWindow({});
  const board = window.board();
  assert.deepEqual(board.pool, []);
  assert.deepEqual(
    board.columns?.map(column => column.name),
    COLUMN_NAMES,
  );
  assert.deepEqual(columnCards(board, 'specifying'), []);
  assert.equal(
    Object.keys(window).some(name => name.toLowerCase().includes('phase')),
    false,
  );
  assert.equal('panel' in board, false);
});

test('proposed stands in proposing and specified stands in specifying', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(home, [
    cycle('2', 'proposed', {title: 'Propose it'}),
    cycle('1', 'specified', {title: 'Specify it'}),
    cycle('3', 'designed', {title: 'Design it'}),
    ticket({key: '9', queue: 'alpha', sddService: 'services/billing', title: 'Bare'}),
  ]);
  const board = window.board();
  const proposing = columnCards(board, 'proposing');
  const specifying = columnCards(board, 'specifying');
  const designing = columnCards(board, 'designing');
  assert.deepEqual(
    proposing?.map(card => card.key),
    ['2'],
  );
  assert.equal(proposing?.[0]?.title, 'Propose it');
  assert.equal(proposing?.[0]?.icon, true);
  assert.equal(proposing?.[0]?.reason, 'proposed');
  assert.equal(proposing?.[0]?.layers, undefined);
  assert.deepEqual(
    specifying?.map(card => card.key),
    ['1'],
  );
  assert.equal(specifying?.[0]?.reason, 'specified');
  assert.deepEqual(
    designing?.map(card => card.key),
    ['3'],
  );
  assert.equal(designing?.[0]?.reason, 'designed');
  assert.equal(
    board.cards.some(card => card.key === '9'),
    false,
  );
  assert.deepEqual(
    board.pool.map(card => card.key),
    ['9'],
  );
  rmSync(dir, {recursive: true, force: true});
});

test('another assignee is absent and a phase with no assignee stands in the pool', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(home, [
    cycle('b', 'implementing', {assignee: 'other', title: 'Other'}),
    cycle('c', 'implementing', {assignee: '', title: 'Open seat'}),
    cycle('a', 'tasking', {assignee: undefined, title: 'Also open'}),
    ticket({
      key: '9',
      queue: 'alpha',
      sddService: 'services/billing',
      assignee: 'other',
      title: 'Bare',
    }),
  ]);
  const board = window.board();
  const keys = [
    ...board.cards.map(card => card.key),
    ...(board.pool ?? []).map(card => card.key),
    ...(board.columns ?? []).flatMap(column => column.cards.map(card => card.key)),
  ];
  assert.equal(keys.includes('b'), false);
  assert.equal(keys.includes('9'), false);
  assert.deepEqual(
    (board.pool ?? []).map(card => card.key),
    ['a', 'c'],
  );
  assert.equal(columnCards(board, 'implementing')?.length, 0);
  assert.equal(columnCards(board, 'tasking')?.length, 0);
  assert.deepEqual(
    board.cards.map(card => card.key),
    [],
  );
  rmSync(dir, {recursive: true, force: true});
});

test('sdd:cancelled with an earlier phase shows no card', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(home, [
    cycle('1', 'proposing', {labels: ['sdd:cycle', 'sdd:proposing', 'sdd:cancelled']}),
    cycle('2', 'proposing'),
  ]);
  const board = window.board();
  const keys = [
    ...board.cards.map(card => card.key),
    ...(board.pool ?? []).map(card => card.key),
    ...(board.columns ?? []).flatMap(column => column.cards.map(card => card.key)),
  ];
  assert.equal(keys.includes('1'), false);
  assert.deepEqual(
    columnCards(board, 'proposing')?.map(card => card.key),
    ['2'],
  );
  rmSync(dir, {recursive: true, force: true});
});

test('an open merge stands in accepting and a closed issue leaves', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(home, [
    cycle('1', 'verifying', {open: true, mergeAhead: true, title: 'Still open'}),
    cycle('2', 'verifying', {open: false, mergeAhead: true, title: 'Closed'}),
    cycle('3', 'accepted', {open: true, title: 'Accepted'}),
    cycle('4', 'accepted', {open: false, title: 'Accepted closed'}),
  ]);
  const board = window.board();
  const accepting = columnCards(board, 'accepting');
  assert.deepEqual(
    accepting?.map(card => card.key),
    ['1', '3'],
  );
  assert.equal(accepting?.find(card => card.key === '1')?.reason?.includes('мерж'), true);
  assert.equal(columnCards(board, 'verifying')?.length, 0);
  const keys = [
    ...board.cards.map(card => card.key),
    ...(board.pool ?? []).map(card => card.key),
    ...(board.columns ?? []).flatMap(column => column.cards.map(card => card.key)),
  ];
  assert.equal(keys.includes('2'), false);
  assert.equal(keys.includes('4'), false);
  rmSync(dir, {recursive: true, force: true});
});

test('proposing shows two open questions under the heading', () => {
  const {dir, home, arcadia} = yard();
  const checkout = prepare(arcadia, home);
  writeChange(
    checkout,
    '1',
    'proposal.md',
    [
      '## Open questions',
      '',
      '- [ ] one',
      '- [x] done',
      '- [ ] two',
      '',
      '## Later',
      '',
      '- [ ] skip',
      '',
    ].join('\n'),
  );
  const window = openCycles(home, [cycle('1', 'proposed')]);
  const card = columnCards(window.board(), 'proposing')?.[0];
  assert.equal(card?.phaseRow, 2);
  rmSync(dir, {recursive: true, force: true});
});

test('specifying has no phase row', () => {
  const {dir, home, arcadia} = yard();
  const checkout = prepare(arcadia, home);
  writeChange(checkout, '1', 'proposal.md', '## Open questions\n\n- [ ] one\n');
  const window = openCycles(home, [cycle('1', 'specified')]);
  const card = columnCards(window.board(), 'specifying')?.[0];
  assert.ok(card);
  assert.equal(card.phaseRow, undefined);
  rmSync(dir, {recursive: true, force: true});
});

test('designing counts open decisions including zero and tasking has no row', () => {
  const {dir, home, arcadia} = yard();
  const checkout = prepare(arcadia, home);
  writeChange(
    checkout,
    '1',
    'design.md',
    '## Open decisions\n\n- [ ] one\n- [x] done\n\n## Later\n\n- [ ] skip\n',
  );
  writeChange(checkout, '3', 'tasks.md', '- [x] done\n- [ ] open\n');
  const window = openCycles(home, [
    cycle('1', 'designed'),
    cycle('2', 'designing'),
    cycle('3', 'tasking'),
  ]);
  const board = window.board();
  assert.equal(columnCards(board, 'designing')?.find(card => card.key === '1')?.phaseRow, 1);
  assert.equal(columnCards(board, 'designing')?.find(card => card.key === '2')?.phaseRow, 0);
  assert.equal(columnCards(board, 'tasking')?.[0]?.phaseRow, undefined);
  rmSync(dir, {recursive: true, force: true});
});

test('implementing counts tasks.md and omits the count when the file is absent', () => {
  const {dir, home, arcadia} = yard();
  const checkout = prepare(arcadia, home);
  writeChange(checkout, '1', 'tasks.md', '- [x] one\n- [x] two\n- [ ] three\n');
  const window = openCycles(home, [cycle('1', 'implementing'), cycle('2', 'implementing')]);
  const cards = columnCards(window.board(), 'implementing');
  assert.deepEqual(cards?.find(card => card.key === '1')?.phaseRow, {done: 2, open: 1});
  const missing = cards?.find(card => card.key === '2');
  assert.ok(missing);
  assert.equal(missing.phaseRow, undefined);
  assert.equal('done' in missing, false);
  rmSync(dir, {recursive: true, force: true});
});

test('verifying shows red and none leaves the check row blank', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(home, [
    cycle('1', 'verifying', {checks: 'red', title: 'Red'}),
    cycle('2', 'verifying', {checks: 'none', title: 'None'}),
  ]);
  const cards = columnCards(window.board(), 'verifying');
  const red = cards?.find(card => card.key === '1');
  const none = cards?.find(card => card.key === '2');
  assert.equal(red?.phaseRow, 'red');
  assert.equal(JSON.stringify(red).includes('lint'), false);
  assert.equal(red && 'checks' in red, false);
  assert.equal(none?.phaseRow, undefined);
  rmSync(dir, {recursive: true, force: true});
});

test('a focus gap shows Specify and hides a solid Plan', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(home, [
    cycle('1', 'implementing', {
      comments: [
        {body: 'hello', manager: true},
        {body: 'sdd:focus\nPlan solid\nSpecify thread 4\nwhy this gap\n'},
        {body: 'sdd:focus\nPlan gap\n', manager: true},
        {body: 'a later note'},
      ],
    }),
    cycle('2', 'implementing', {
      comments: [{body: 'sdd:focus\nCode gap\nChange solid\nPlan gap\n'}],
    }),
  ]);
  const cards = columnCards(window.board(), 'implementing');
  const gap = cards?.find(card => card.key === '1');
  assert.equal(gap?.layers, 'Specify');
  assert.equal(gap?.layers?.includes('Plan'), false);
  assert.equal(JSON.stringify(gap).includes('thread'), false);
  assert.equal(JSON.stringify(gap).includes('why'), false);
  assert.equal(cards?.find(card => card.key === '2')?.layers, 'Code · Plan');
  rmSync(dir, {recursive: true, force: true});
});

test('every recorded layer solid has no layer line', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(home, [
    cycle('1', 'implementing', {
      comments: [{body: 'sdd:focus\nChange solid\nPlan solid\nSpecify solid\n'}],
    }),
  ]);
  const card = columnCards(window.board(), 'implementing')?.[0];
  assert.ok(card);
  assert.equal(card.layers, undefined);
  rmSync(dir, {recursive: true, force: true});
});

test('a running step hides the icon while the occasion still sorts first', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(
    home,
    [
      cycle('1', 'specifying'),
      cycle('3', 'specifying', {labels: ['sdd:cycle', 'sdd:specifying', 'sdd:wait-human']}),
      cycle('2', 'specifying', {labels: ['sdd:cycle', 'sdd:specifying', 'sdd:wait-human']}),
      cycle('4', 'specifying', {labels: ['sdd:cycle', 'sdd:specifying', 'sdd:wait-human']}),
    ],
    key => key === '2' || key === '3',
  );
  const cards = columnCards(window.board(), 'specifying');
  assert.deepEqual(
    cards?.map(card => card.key),
    ['2', '3', '4', '1'],
  );
  const hidden = cards?.find(card => card.key === '2');
  const shown = cards?.find(card => card.key === '4');
  assert.equal(hidden?.icon, undefined);
  assert.equal(hidden?.reason, undefined);
  assert.equal(shown?.icon, true);
  assert.equal(shown?.reason, 'Ask');
  rmSync(dir, {recursive: true, force: true});
});

test('pending checks hide the icon and the phase row stays pending', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(home, [
    cycle('1', 'verifying', {checks: 'green'}),
    cycle('2', 'verifying', {
      checks: 'pending',
      labels: ['sdd:cycle', 'sdd:verifying', 'sdd:wait-human'],
    }),
  ]);
  const cards = columnCards(window.board(), 'verifying');
  assert.deepEqual(
    cards?.map(card => card.key),
    ['2', '1'],
  );
  assert.equal(cards?.[0]?.icon, undefined);
  assert.equal(cards?.[0]?.phaseRow, 'pending');
  assert.equal(cards?.[1]?.phaseRow, 'green');
  rmSync(dir, {recursive: true, force: true});
});

test('a missing catalog outranks a missing service config in the reason', () => {
  const {dir, home, arcadia} = yard();
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openCycles(home, [cycle('1', 'proposed', {sddService: 'services/missing'})]);
  const card = columnCards(window.board(), 'proposing')?.[0];
  assert.equal(card?.reason?.startsWith('каталога нет'), true);
  assert.equal(card?.reason?.startsWith('конфига сервиса нет'), false);
  assert.equal(card?.reason?.includes('конфига сервиса нет'), false);
  rmSync(dir, {recursive: true, force: true});
});

test('a question-only occasion whose phase row shows the count has no reason line', () => {
  const {dir, home, arcadia} = yard();
  const checkout = prepare(arcadia, home);
  writeChange(checkout, 'b', 'proposal.md', '## Open questions\n\n- [ ] one\n- [ ] two\n');
  writeChange(checkout, 'c', 'proposal.md', '## Open questions\n\n- [ ] one\n- [ ] two\n');
  const window = openCycles(home, [
    cycle('a', 'proposing'),
    cycle('b', 'proposing'),
    cycle('c', 'specifying'),
  ]);
  const board = window.board();
  const proposing = columnCards(board, 'proposing');
  assert.deepEqual(
    proposing?.map(card => card.key),
    ['b', 'a'],
  );
  const questions = proposing?.find(card => card.key === 'b');
  assert.equal(questions?.phaseRow, 2);
  assert.equal(questions?.icon, true);
  assert.equal(questions?.reason, undefined);
  const elsewhere = columnCards(board, 'specifying')?.find(card => card.key === 'c');
  assert.equal(elsewhere?.phaseRow, undefined);
  assert.equal(elsewhere?.reason, 'вопросы 2');
  rmSync(dir, {recursive: true, force: true});
});

test('decisions are the only occasion and the phase row already shows the count', () => {
  const {dir, home, arcadia} = yard();
  const checkout = prepare(arcadia, home);
  writeChange(checkout, '1', 'design.md', '## Open decisions\n\n- [ ] one\n');
  const window = openCycles(home, [cycle('1', 'designing')]);
  const card = columnCards(window.board(), 'designing')?.[0];
  assert.equal(card?.phaseRow, 1);
  assert.equal(card?.icon, true);
  assert.equal(card?.reason, undefined);
  rmSync(dir, {recursive: true, force: true});
});

test('a child record puts дети and that key on the reason', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(home, [
    cycle('p', 'implementing'),
    ticket({key: 'c-2', parent: 'p', queue: 'other', labels: ['sdd:cycle']}),
    ticket({key: 'c-1', parent: 'p', queue: 'other', labels: ['sdd:cycle']}),
    ticket({key: 'no', parent: 'p', queue: 'other', labels: ['other']}),
  ]);
  const card = columnCards(window.board(), 'implementing')?.[0];
  assert.equal(card?.reason, 'дети c-1 c-2');
  assert.equal(card?.reason?.includes('no'), false);
  rmSync(dir, {recursive: true, force: true});
});

test('blockers are dependsOn keys found in this reading, in key order', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(home, [
    cycle('p', 'implementing', {dependsOn: ['z', 'missing', 'a', 'a']}),
    ticket({key: 'z', queue: 'other', labels: ['note']}),
    ticket({key: 'a', queue: 'other', labels: ['note']}),
  ]);
  const card = columnCards(window.board(), 'implementing')?.[0];
  assert.equal(card?.reason, 'блокеры a z');
  assert.equal(card?.reason?.includes('missing'), false);
  rmSync(dir, {recursive: true, force: true});
});

test('several open pull requests are one reason part', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(home, [
    cycle('1', 'implementing', {openPullRequests: 2}),
    cycle('2', 'implementing', {openPullRequests: 1}),
  ]);
  const cards = columnCards(window.board(), 'implementing');
  assert.equal(cards?.find(card => card.key === '1')?.reason, 'несколько pull request');
  assert.equal(cards?.find(card => card.key === '1')?.icon, true);
  assert.equal(cards?.find(card => card.key === '2')?.reason, undefined);
  assert.equal(cards?.find(card => card.key === '2')?.icon, undefined);
  rmSync(dir, {recursive: true, force: true});
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

test('an open watch-list ticket with sdd:cycle, no phase, and no assignee stands in the pool', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(home, [
    ticket({key: 'b', queue: 'alpha', sddService: 'services/billing', title: 'Second', open: true}),
    ticket({key: 'a', queue: 'alpha', sddService: 'services/billing', title: 'First'}),
    ticket({
      key: 'c',
      queue: 'alpha',
      sddService: 'services/billing',
      title: 'Closed',
      open: false,
    }),
    ticket({key: 'd', queue: 'beta', sddService: 'services/billing', title: 'Other queue'}),
  ]);
  const board = window.board();
  assert.deepEqual(
    board.pool.map(card => card.key),
    ['a', 'b'],
  );
  assert.equal(
    board.pool.some(card => card.key === 'c'),
    false,
  );
  assert.deepEqual(
    board.cards.map(card => card.key),
    ['c'],
  );
  assert.equal(
    board.cards.some(card => card.key === 'a' || card.key === 'b'),
    false,
  );
  rmSync(dir, {recursive: true, force: true});
});

test('an open ticket on the watch list without sdd:cycle is not in the pool', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(home, [
    ticket({
      key: '1',
      queue: 'alpha',
      sddService: 'services/billing',
      title: 'Plain',
      open: true,
      labels: ['alpha'],
    }),
  ]);
  const board = window.board();
  assert.equal(
    board.pool.some(card => card.key === '1'),
    false,
  );
  assert.deepEqual(board.cards, []);
  rmSync(dir, {recursive: true, force: true});
});

test('a phaseless ticket with another assignee is absent', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(home, [
    ticket({
      key: '1',
      queue: 'alpha',
      sddService: 'services/billing',
      assignee: 'other',
      title: 'Theirs',
      open: true,
    }),
  ]);
  const board = window.board();
  const keys = [
    ...board.cards.map(card => card.key),
    ...board.pool.map(card => card.key),
    ...board.columns.flatMap(column => column.cards.map(card => card.key)),
  ];
  assert.equal(keys.includes('1'), false);
  rmSync(dir, {recursive: true, force: true});
});

test('a phaseless ticket assigned to this login moves to proposing after spy when models are set', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const tickets = [
    ticket({
      key: '1',
      queue: 'alpha',
      sddService: 'services/billing',
      assignee: MANAGER,
      title: 'Mine',
      labels: ['sdd:cycle'],
    }),
  ];
  const phases: {key: string; phase: string}[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => tickets,
      writePhase: (key, phase) => {
        phases.push({key, phase});
        const found = tickets.find(item => item.key === key);
        if (found && !found.labels.includes(`sdd:${phase}`)) {
          found.labels = [...found.labels, `sdd:${phase}`];
        }
      },
    },
  );
  window.chooseAgent('cursor');
  assert.deepEqual(
    window.board().pool.map(card => card.key),
    ['1'],
  );
  window.spy();
  assert.deepEqual(phases, [{key: '1', phase: 'proposing'}]);
  const board = window.board();
  assert.deepEqual(board.pool, []);
  assert.deepEqual(
    columnCards(board, 'proposing')?.map(card => card.key),
    ['1'],
  );
  rmSync(dir, {recursive: true, force: true});
});

test('a phaseless ticket assigned to this login stays in the pool when a model slot is empty', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const tickets = [
    ticket({
      key: '1',
      queue: 'alpha',
      sddService: 'services/billing',
      assignee: MANAGER,
      title: 'Mine',
      labels: ['sdd:cycle'],
    }),
  ];
  const phases: {key: string; phase: string}[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      answers: () => true,
      tickets: () => tickets,
      writePhase: (key, phase) => {
        phases.push({key, phase});
      },
    },
  );
  window.chooseAgent('cursor');
  window.leaveModel('judgment', '');
  window.spy();
  const card = window.board().pool.find(item => item.key === '1');
  assert.ok(card);
  assert.equal(card.takeDisabled, true);
  assert.equal(card.take, true);
  assert.deepEqual(phases, []);
  assert.equal(columnCards(window.board(), 'proposing')?.length, 0);
  rmSync(dir, {recursive: true, force: true});
});

test('two open pull requests keep an assigned ticket in the pool and spy does not set proposing', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const tickets = [
    ticket({
      key: '1',
      queue: 'alpha',
      sddService: 'services/billing',
      assignee: MANAGER,
      title: 'Split',
      openPullRequests: 2,
      labels: ['sdd:cycle'],
    }),
  ];
  const phases: {key: string; phase: string}[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => tickets,
      writePhase: (key, phase) => {
        phases.push({key, phase});
        const found = tickets.find(item => item.key === key);
        if (found && !found.labels.includes(`sdd:${phase}`)) {
          found.labels = [...found.labels, `sdd:${phase}`];
        }
      },
    },
  );
  window.chooseAgent('cursor');
  window.spy();
  assert.deepEqual(phases, []);
  const card = window.board().pool.find(item => item.key === '1');
  assert.ok(card);
  assert.equal(card.reason, 'несколько pull request');
  assert.equal(columnCards(window.board(), 'proposing')?.length, 0);
  rmSync(dir, {recursive: true, force: true});
});

test('a missing checkout keeps an assigned ticket in the pool and spy does not set proposing', () => {
  const {dir, home, arcadia} = yard();
  writeLaunch(home, ['alpha'], {arcadia});
  const tickets = [
    ticket({
      key: '1',
      queue: 'alpha',
      sddService: 'services/missing',
      assignee: MANAGER,
      title: 'Gone',
      labels: ['sdd:cycle'],
    }),
  ];
  const phases: {key: string; phase: string}[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => tickets,
      writePhase: (key, phase) => {
        phases.push({key, phase});
        const found = tickets.find(item => item.key === key);
        if (found && !found.labels.includes(`sdd:${phase}`)) {
          found.labels = [...found.labels, `sdd:${phase}`];
        }
      },
    },
  );
  window.chooseAgent('cursor');
  window.spy();
  assert.deepEqual(phases, []);
  const card = window.board().pool.find(item => item.key === '1');
  assert.ok(card);
  assert.equal(card.reason, 'каталога нет');
  assert.equal(columnCards(window.board(), 'proposing')?.length, 0);
  rmSync(dir, {recursive: true, force: true});
});

test('one open pull request lets spy set proposing for an assigned ticket', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const tickets = [
    ticket({
      key: '1',
      queue: 'alpha',
      sddService: 'services/billing',
      assignee: MANAGER,
      title: 'One',
      openPullRequests: 1,
      labels: ['sdd:cycle'],
    }),
  ];
  const phases: {key: string; phase: string}[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => tickets,
      writePhase: (key, phase) => {
        phases.push({key, phase});
        const found = tickets.find(item => item.key === key);
        if (found && !found.labels.includes(`sdd:${phase}`)) {
          found.labels = [...found.labels, `sdd:${phase}`];
        }
      },
    },
  );
  window.chooseAgent('cursor');
  window.spy();
  assert.deepEqual(phases, [{key: '1', phase: 'proposing'}]);
  const board = window.board();
  assert.deepEqual(board.pool, []);
  assert.deepEqual(
    columnCards(board, 'proposing')?.map(card => card.key),
    ['1'],
  );
  rmSync(dir, {recursive: true, force: true});
});

test('take on a phaseless ticket sets the assignee and spy then sets proposing', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const tickets = [
    ticket({
      key: '1',
      queue: 'alpha',
      sddService: 'services/billing',
      title: 'Take me',
      labels: ['sdd:cycle'],
    }),
  ];
  const assignees: {key: string; login: string}[] = [];
  const phases: {key: string; phase: string}[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => tickets,
      writeAssignee: (key, login) => {
        assignees.push({key, login});
        const found = tickets.find(item => item.key === key);
        if (found) {
          found.assignee = login;
        }
      },
      writePhase: (key, phase) => {
        phases.push({key, phase});
        const found = tickets.find(item => item.key === key);
        if (found && !found.labels.includes(`sdd:${phase}`)) {
          found.labels = [...found.labels, `sdd:${phase}`];
        }
      },
    },
  );
  window.chooseAgent('cursor');
  window.take('1');
  assert.deepEqual(assignees, [{key: '1', login: MANAGER}]);
  assert.deepEqual(phases, []);
  assert.equal(tickets[0]?.labels.includes('sdd:proposing'), false);
  assert.deepEqual(
    window.board().pool.map(card => card.key),
    ['1'],
  );
  window.spy();
  assert.deepEqual(phases, [{key: '1', phase: 'proposing'}]);
  assert.equal(tickets[0]?.labels.includes('sdd:proposing'), true);
  const board = window.board();
  assert.deepEqual(board.pool, []);
  assert.deepEqual(
    columnCards(board, 'proposing')?.map(card => card.key),
    ['1'],
  );
  rmSync(dir, {recursive: true, force: true});
});

test('take does not call writeAssignee when the home path is absent', () => {
  let calls = 0;
  const window = openWindow(
    {},
    {
      login: () => MANAGER,
      writeAssignee: () => {
        calls += 1;
      },
      tickets: () => [
        ticket({key: '1', queue: 'alpha', sddService: 'services/billing', title: 'Bare'}),
      ],
    },
  );
  assert.equal(window.board().takeDisabled, true);
  window.take('1');
  assert.equal(calls, 0);
});

test('take on an implementing pool cycle sets the assignee and leaves the phase', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const tickets = [cycle('1', 'implementing', {assignee: '', title: 'Build', openPullRequests: 1})];
  const assignees: {key: string; login: string}[] = [];
  const phases: {key: string; phase: string}[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => tickets,
      writeAssignee: (key, login) => {
        assignees.push({key, login});
        const found = tickets.find(item => item.key === key);
        if (found) {
          found.assignee = login;
        }
      },
      writePhase: (key, phase) => {
        phases.push({key, phase});
      },
    },
  );
  window.chooseAgent('cursor');
  const before = window.board().pool.find(card => card.key === '1');
  assert.equal(before?.take, true);
  assert.equal(before?.icon, undefined);
  assert.equal(before?.takeDisabled, undefined);
  window.take('1');
  assert.deepEqual(assignees, [{key: '1', login: MANAGER}]);
  assert.deepEqual(phases, []);
  assert.deepEqual(tickets[0]?.labels, ['sdd:cycle', 'sdd:implementing']);
  const board = window.board();
  assert.deepEqual(board.pool, []);
  assert.deepEqual(
    columnCards(board, 'implementing')?.map(card => card.key),
    ['1'],
  );
  rmSync(dir, {recursive: true, force: true});
});

test('take on an implementing pool cycle writes the assignee when a model slot is empty', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const tickets = [cycle('1', 'implementing', {assignee: '', title: 'Build'})];
  const assignees: {key: string; login: string}[] = [];
  const phases: {key: string; phase: string}[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      answers: () => true,
      tickets: () => tickets,
      writeAssignee: (key, login) => {
        assignees.push({key, login});
        const found = tickets.find(item => item.key === key);
        if (found) {
          found.assignee = login;
        }
      },
      writePhase: (key, phase) => {
        phases.push({key, phase});
      },
    },
  );
  window.chooseAgent('cursor');
  window.leaveModel('mechanical', '');
  const before = window.board().pool.find(card => card.key === '1');
  assert.equal(before?.take, true);
  assert.equal(before?.takeDisabled, undefined);
  window.take('1');
  assert.deepEqual(assignees, [{key: '1', login: MANAGER}]);
  assert.deepEqual(phases, []);
  assert.deepEqual(tickets[0]?.labels, ['sdd:cycle', 'sdd:implementing']);
  const board = window.board();
  assert.deepEqual(board.pool, []);
  assert.deepEqual(
    columnCards(board, 'implementing')?.map(card => card.key),
    ['1'],
  );
  rmSync(dir, {recursive: true, force: true});
});

test('two open pull requests keep the card in the pool and do not write the assignee', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const tickets = [
    ticket({
      key: '1',
      queue: 'alpha',
      sddService: 'services/billing',
      title: 'Split',
      openPullRequests: 2,
    }),
  ];
  const assignees: {key: string; login: string}[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => tickets,
      writeAssignee: (key, login) => {
        assignees.push({key, login});
      },
    },
  );
  window.chooseAgent('cursor');
  const card = window.board().pool.find(item => item.key === '1');
  assert.ok(card);
  assert.equal(card.icon, true);
  assert.equal(card.reason, 'несколько pull request');
  assert.equal(card.takeDisabled, true);
  window.take('1');
  assert.deepEqual(assignees, []);
  assert.deepEqual(
    window.board().pool.map(item => item.key),
    ['1'],
  );
  rmSync(dir, {recursive: true, force: true});
});

test('one open pull request lets take write the assignee', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const tickets = [
    ticket({
      key: '1',
      queue: 'alpha',
      sddService: 'services/billing',
      title: 'One',
      openPullRequests: 1,
    }),
  ];
  const assignees: {key: string; login: string}[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => tickets,
      writeAssignee: (key, login) => {
        assignees.push({key, login});
      },
    },
  );
  window.chooseAgent('cursor');
  const card = window.board().pool.find(item => item.key === '1');
  assert.ok(card);
  assert.equal(card.icon, undefined);
  assert.equal(card.take, true);
  assert.equal(card.takeDisabled, undefined);
  window.take('1');
  assert.deepEqual(assignees, [{key: '1', login: MANAGER}]);
  rmSync(dir, {recursive: true, force: true});
});

test('a pool ticket with a checkout break shows the icon and take does not write', () => {
  const {dir, home, arcadia} = yard();
  writeLaunch(home, ['alpha'], {arcadia});
  const tickets = [
    ticket({
      key: '1',
      queue: 'alpha',
      sddService: 'services/missing',
      title: 'Gone',
    }),
  ];
  const assignees: {key: string; login: string}[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => tickets,
      writeAssignee: (key, login) => {
        assignees.push({key, login});
      },
    },
  );
  window.chooseAgent('cursor');
  const board = window.board();
  const card = board.pool.find(item => item.key === '1');
  assert.ok(card);
  assert.equal(card.icon, true);
  assert.equal(card.reason, 'каталога нет');
  assert.equal(card.takeDisabled, true);
  assert.equal(
    board.cards.some(item => item.key === '1'),
    false,
  );
  window.take('1');
  assert.deepEqual(assignees, []);
  rmSync(dir, {recursive: true, force: true});
});

test('pending checks hide the icon on a pool ticket with two open pull requests', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(home, [
    ticket({
      key: '1',
      queue: 'alpha',
      sddService: 'services/billing',
      title: 'Split',
      openPullRequests: 2,
      checks: 'pending',
    }),
  ]);
  const card = window.board().pool.find(item => item.key === '1');
  assert.ok(card);
  assert.equal(card.icon, undefined);
  assert.equal(card.reason, undefined);
  assert.equal(card.takeDisabled, true);
  rmSync(dir, {recursive: true, force: true});
});

test('a running step hides the icon on a pool ticket with a checkout break', () => {
  const {dir, home, arcadia} = yard();
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openCycles(
    home,
    [
      ticket({
        key: '1',
        queue: 'alpha',
        sddService: 'services/missing',
        title: 'Gone',
      }),
    ],
    key => key === '1',
  );
  const card = window.board().pool.find(item => item.key === '1');
  assert.ok(card);
  assert.equal(card.icon, undefined);
  assert.equal(card.reason, undefined);
  assert.equal(card.takeDisabled, true);
  rmSync(dir, {recursive: true, force: true});
});

test('an overlay mechanical model replaces the home id and a missing overlay keeps home', () => {
  const {dir, home, arcadia} = yard();
  const billing = path.join(arcadia, 'services', 'billing');
  const other = path.join(arcadia, 'services', 'other');
  mkdirSync(billing, {recursive: true});
  mkdirSync(other, {recursive: true});
  writeServiceConfig(billing, ['alpha']);
  writeServiceConfig(other, ['beta']);
  writeLaunch(home, ['alpha', 'beta'], {arcadia});
  writeOverlay(billing, [], 'models:\n  mechanical: overlay-mechanical\n');
  const started: {checkout: string; mechanical: string; judgment: string}[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      answers: () => true,
      startStep: (checkout, models) => {
        started.push({
          checkout: checkout ?? '',
          mechanical: models?.mechanical ?? '',
          judgment: models?.judgment ?? '',
        });
      },
      tickets: () => [
        ticket({key: '1', queue: 'alpha', sddService: 'services/billing'}),
        ticket({key: '2', queue: 'beta', sddService: 'services/other'}),
      ],
    },
  );
  window.chooseAgent('cursor');
  window.spy();
  assert.deepEqual(started, [
    {
      checkout: billing,
      mechanical: 'overlay-mechanical',
      judgment: 'grok-4.7-high-fast',
    },
    {
      checkout: other,
      mechanical: 'composer-2.5-fast',
      judgment: 'grok-4.7-high-fast',
    },
  ]);
  rmSync(dir, {recursive: true, force: true});
});

test('changing the overlay agent to opencode writes the pair and no effort or speed', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia});
  writeOverlay(
    checkout,
    ['alpha'],
    [
      'agent: codex',
      'models:',
      '  mechanical: gpt-6-luna',
      '  judgment: gpt-6.1-sol',
      'effort:',
      '  mechanical: max',
      '  judgment: max',
      'speed:',
      '  mechanical: fast',
      'roots:',
      '  arcadia: /wrong',
      'roles:',
      '  - someone',
      '',
    ].join('\n'),
  );
  let reads = 0;
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      catalog: () => {
        reads += 1;
        return {mechanical: 'not-the-pair', judgment: 'also-not'};
      },
      tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})],
    },
  );
  window.chooseAgent('cursor');
  window.openSettings();
  window.chooseOverlayAgent('opencode');
  const doc = readHome(path.join(checkout, '.aifactory', 'config.yaml'));
  assert.equal(doc.agent, 'opencode');
  assert.equal(doc.models?.mechanical, 'moonshotai/kimi-k2.7-code');
  assert.equal(doc.models?.judgment, 'moonshotai/kimi-k3');
  assert.equal(doc.effort, undefined);
  assert.equal(doc.speed, undefined);
  assert.equal(doc.roots, undefined);
  assert.equal(doc.roles, undefined);
  assert.deepEqual(doc.watch, ['alpha']);
  assertNoEmptyStrings(doc);
  assert.equal(reads, 0);
  rmSync(dir, {recursive: true, force: true});
});

test('an overlay edit is on disk after settings close', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  window.openSettings();
  window.chooseOverlayAgent('claude-code');
  const file = path.join(checkout, '.aifactory', 'config.yaml');
  assert.equal(readHome(file).agent, 'claude-code');
  window.closeSettings();
  const doc = readHome(file);
  assert.equal(doc.agent, 'claude-code');
  assert.equal(doc.models?.mechanical, 'sonnet');
  assert.equal(doc.models?.judgment, 'opus');
  assert.deepEqual(doc.effort, {mechanical: 'medium', judgment: 'medium'});
  assert.equal(doc.speed, undefined);
  assert.equal(window.board().settingsOpen, false);
  rmSync(dir, {recursive: true, force: true});
});

test('an overlay agent of codex with no effort key does not take home effort max', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha']);
  writeFileSync(
    home,
    [
      'agent: cursor',
      'models:',
      '  mechanical: composer-2.5-fast',
      '  judgment: grok-4.7-high-fast',
      'effort:',
      '  mechanical: max',
      '  judgment: max',
      'watch:',
      '  - alpha',
      'roots:',
      `  arcadia: ${arcadia}`,
      '',
    ].join('\n'),
  );
  writeOverlay(
    checkout,
    ['alpha'],
    ['agent: codex', 'models:', '  mechanical: gpt-6-luna', '  judgment: gpt-6.1-sol', ''].join(
      '\n',
    ),
  );
  let started = 0;
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      answers: () => true,
      startStep: () => {
        started += 1;
      },
      tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})],
    },
  );
  window.openSettings();
  assert.equal(window.overlay().file, '.aifactory/config.yaml');
  assert.equal(window.overlay().checkout, checkout);
  assert.equal(window.overlay().agent, 'codex');
  assert.equal(window.overlay().models.mechanical.value, 'gpt-6-luna');
  assert.equal(window.overlay().models.judgment.value, 'gpt-6.1-sol');
  assert.deepEqual(window.overlay().effort, {mechanical: 'low', judgment: 'high'});
  assert.deepEqual(window.overlay().speed, {mechanical: '', judgment: ''});
  assert.equal(readHome(path.join(checkout, '.aifactory', 'config.yaml')).effort, undefined);
  window.spy();
  assert.equal(started, 1);
  rmSync(dir, {recursive: true, force: true});
});

test('clearing the overlay agent removes agent, models, effort, and speed', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia});
  writeOverlay(
    checkout,
    ['alpha'],
    [
      'agent: codex',
      'models:',
      '  mechanical: gpt-6-luna',
      '  judgment: gpt-6.1-sol',
      'effort:',
      '  mechanical: high',
      '  judgment: low',
      'speed:',
      '  mechanical: fast',
      '',
    ].join('\n'),
  );
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  window.chooseAgent('cursor');
  window.openSettings();
  window.clearOverlayAgent();
  const doc = readHome(path.join(checkout, '.aifactory', 'config.yaml'));
  assert.equal(doc.agent, undefined);
  assert.equal(doc.models, undefined);
  assert.equal(doc.effort, undefined);
  assert.equal(doc.speed, undefined);
  assert.deepEqual(doc.watch, ['alpha']);
  assert.equal(window.overlay().agent, 'cursor');
  rmSync(dir, {recursive: true, force: true});
});

test('clearing overlay judgment with no overlay agent shows the home judgment id', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia});
  writeOverlay(checkout, ['alpha'], 'models:\n  judgment: custom-judgment\n');
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  window.chooseAgent('cursor');
  window.openSettings();
  assert.equal(window.overlay().models.judgment.value, 'custom-judgment');
  window.leaveOverlayModel('judgment', '');
  const doc = readHome(path.join(checkout, '.aifactory', 'config.yaml'));
  assert.equal(doc.models?.judgment, undefined);
  assert.equal(window.overlay().models.judgment.value, 'grok-4.7-high-fast');
  assert.equal(window.overlay().models.mechanical.value, 'composer-2.5-fast');
  rmSync(dir, {recursive: true, force: true});
});

test('a newer overlay file on disk blocks the write and the group shows the disk agent', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia});
  writeOverlay(checkout, ['alpha'], 'agent: cursor\n');
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  window.openSettings();
  assert.equal(window.overlay().agent, 'cursor');
  const file = path.join(checkout, '.aifactory', 'config.yaml');
  writeFileSync(file, 'agent: codex\n');
  window.chooseOverlayAgent('opencode');
  assert.equal(readHome(file).agent, 'codex');
  assert.equal(window.overlay().agent, 'codex');
  rmSync(dir, {recursive: true, force: true});
});

test('one gathered checkout is selected when settings open with no card', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  assert.equal(window.overlay().checkout, '');
  window.openSettings();
  assert.equal(window.overlay().file, '.aifactory/config.yaml');
  assert.equal(window.overlay().checkout, checkout);
  rmSync(dir, {recursive: true, force: true});
});

test('several gathered checkouts write nothing until chooseCheckout', () => {
  const {dir, home, arcadia} = yard();
  const billing = path.join(arcadia, 'services', 'billing');
  const other = path.join(arcadia, 'services', 'other');
  mkdirSync(billing, {recursive: true});
  mkdirSync(other, {recursive: true});
  writeServiceConfig(billing, ['alpha']);
  writeServiceConfig(other, ['beta']);
  writeLaunch(home, ['alpha', 'beta'], {arcadia});
  const tickets = [
    ticket({key: '1', queue: 'alpha', sddService: 'services/billing'}),
    ticket({key: '2', queue: 'beta', sddService: 'services/other'}),
  ];
  const window = openWindow({homePath: home, adapter: 'tracker'}, {tickets: () => tickets});
  window.openSettings();
  assert.equal(window.overlay().checkout, '');
  window.chooseOverlayAgent('opencode');
  assert.equal(existsSync(path.join(billing, '.aifactory', 'config.yaml')), false);
  assert.equal(existsSync(path.join(other, '.aifactory', 'config.yaml')), false);
  window.chooseCheckout(path.join(arcadia, 'missing'));
  assert.equal(window.overlay().checkout, '');
  window.chooseCheckout(billing);
  window.chooseOverlayAgent('opencode');
  assert.equal(readHome(path.join(billing, '.aifactory', 'config.yaml')).agent, 'opencode');
  assert.equal(existsSync(path.join(other, '.aifactory', 'config.yaml')), false);
  window.openCard('2');
  assert.equal(window.overlay().checkout, other);
  rmSync(dir, {recursive: true, force: true});
});

test('an empty merged mechanical model names the checkout and stops only that step', () => {
  const {dir, home, arcadia} = yard();
  const billing = path.join(arcadia, 'services', 'billing');
  const other = path.join(arcadia, 'services', 'other');
  mkdirSync(billing, {recursive: true});
  mkdirSync(other, {recursive: true});
  writeServiceConfig(billing, ['alpha']);
  writeServiceConfig(other, ['beta']);
  writeLaunch(home, ['alpha', 'beta'], {arcadia});
  writeOverlay(billing, [], 'models:\n  mechanical: ""\n');
  const tickets = [
    ticket({key: '1', queue: 'alpha', sddService: 'services/billing', title: 'Bare'}),
    ticket({key: '2', queue: 'beta', sddService: 'services/other', title: 'Other'}),
    cycle('3', 'implementing', {assignee: '', title: 'Phased'}),
  ];
  const assignees: string[] = [];
  const started: {checkout: string; mechanical: string}[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      answers: () => true,
      tickets: () => tickets,
      writeAssignee: key => {
        assignees.push(key);
        const found = tickets.find(item => item.key === key);
        if (found) {
          found.assignee = MANAGER;
        }
      },
      startStep: (checkout, models) => {
        started.push({checkout: checkout ?? '', mechanical: models?.mechanical ?? ''});
      },
    },
  );
  window.chooseAgent('cursor');
  const row = window.board().rows.find(item => item.text.includes(billing));
  assert.ok(row);
  assert.equal(row.text.includes('нужна модель mechanical'), true);
  assert.equal(
    window
      .board()
      .rows.some(item => item.text.includes(other) && item.text.includes('нужна модель')),
    false,
  );
  window.take('1');
  window.take('3');
  assert.deepEqual(assignees, ['3']);
  window.spy();
  assert.deepEqual(started, [{checkout: other, mechanical: 'composer-2.5-fast'}]);
  rmSync(dir, {recursive: true, force: true});
});

test('a silent agent does not show the checkout empty-model row', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia});
  writeOverlay(checkout, [], 'models:\n  mechanical: ""\n');
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      answers: () => false,
      tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})],
    },
  );
  window.chooseAgent('cursor');
  assert.deepEqual(window.board().rows, [{text: 'агент не отвечает'}]);
  assert.equal(readHome(home).agent, 'cursor');
  rmSync(dir, {recursive: true, force: true});
});

test('a catalog that rejects the recorded judgment id keeps it and stops the step', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia});
  const tickets = [
    ticket({key: '1', queue: 'alpha', sddService: 'services/billing', title: 'Bare'}),
    cycle('3', 'implementing', {assignee: '', title: 'Phased'}),
  ];
  const assignees: string[] = [];
  let started = 0;
  let choosing = true;
  let readsWhileChoosing = 0;
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      answers: () => true,
      catalog: () => {
        if (choosing) {
          readsWhileChoosing += 1;
        }
        return {mechanical: 'composer-2.5-fast', judgment: 'not-listed'};
      },
      tickets: () => tickets,
      writeAssignee: key => {
        assignees.push(key);
      },
      startStep: () => {
        started += 1;
      },
    },
  );
  window.chooseAgent('cursor');
  choosing = false;
  assert.equal(readsWhileChoosing, 0);
  const row = window.board().rows.find(item => item.text.includes('модель не запускается'));
  assert.ok(row);
  assert.equal(row.text.includes(checkout), true);
  assert.equal(row.text.includes('judgment'), true);
  assert.equal(row.text.includes('grok-4.7-high-fast'), true);
  assert.equal(readHome(home).models?.judgment, 'grok-4.7-high-fast');
  window.take('1');
  window.take('3');
  assert.deepEqual(assignees, []);
  window.spy();
  assert.equal(started, 0);
  rmSync(dir, {recursive: true, force: true});
});

test('a started step keeps the mechanical id from that call until leading is false', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia});
  writeOverlay(checkout, [], 'models:\n  mechanical: first-id\n');
  let leading = false;
  const started: string[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      answers: () => true,
      leading: () => leading,
      startStep: (_checkout, models) => {
        started.push(models?.mechanical ?? '');
      },
      tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})],
    },
  );
  window.chooseAgent('cursor');
  window.spy();
  leading = true;
  writeOverlay(checkout, [], 'models:\n  mechanical: second-id\n');
  window.spy();
  assert.deepEqual(started, ['first-id']);
  leading = false;
  window.spy();
  assert.deepEqual(started, ['first-id', 'second-id']);
  rmSync(dir, {recursive: true, force: true});
});

test('healthy pool cards are ordered by key and have no icon', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(home, [
    ticket({key: 'c', queue: 'alpha', sddService: 'services/billing', title: 'Third'}),
    cycle('b', 'proposed', {assignee: '', title: 'Gate', openPullRequests: 1}),
    ticket({key: 'a', queue: 'alpha', sddService: 'services/billing', title: 'First'}),
  ]);
  window.chooseAgent('cursor');
  const checkout = path.join(arcadia, 'services', 'billing');
  const place = {queue: 'alpha', choices: ['services/billing'], checkout};
  assert.deepEqual(window.board().pool, [
    {key: 'a', title: 'First', take: true, ...place},
    {key: 'b', title: 'Gate', take: true, ...place},
    {key: 'c', title: 'Third', take: true, ...place},
  ]);
  rmSync(dir, {recursive: true, force: true});
});

type ServiceYaml = {
  schema?: unknown;
  context?: unknown;
  rules?: unknown;
  sdd?: {
    base?: unknown;
    'branch-scope'?: unknown;
    'ignore-comments'?: unknown;
    extra?: unknown;
    queues?: {name?: string; description?: unknown}[];
    hooks?: Record<string, Record<string, unknown>>;
  };
};

function writeServiceYaml(checkout: string, body: string): string {
  const dir = path.join(checkout, 'openspec');
  mkdirSync(dir, {recursive: true});
  const file = path.join(dir, 'config.yaml');
  writeFileSync(file, body.endsWith('\n') ? body : `${body}\n`);
  return file;
}

function readServiceYaml(file: string): ServiceYaml {
  return parse(readFileSync(file, 'utf8')) as ServiceYaml;
}

function visibleKeys(board: ReturnType<ReturnType<typeof openWindow>['board']>): string[] {
  return [
    ...board.cards.map(card => card.key),
    ...board.pool.map(card => card.key),
    ...board.columns.flatMap(column => column.cards.map(card => card.key)),
  ];
}

test('the service-config group omits a default base and writes main beside schema, context, and rules', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  const file = writeServiceYaml(
    checkout,
    [
      'schema: spec',
      'context: kept',
      'rules:',
      '  - one',
      'sdd:',
      '  queues:',
      '    - name: alpha',
      '  base: main',
      '  branch-scope: feature',
      '',
    ].join('\n'),
  );
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  window.openSettings();
  assert.equal(window.serviceConfig().file, 'openspec/config.yaml');
  assert.equal(window.serviceConfig().checkout, checkout);
  assert.equal(window.serviceConfig().base, 'main');
  assert.equal(window.serviceConfig().branchScope, 'feature');
  window.setServiceBase('trunk');
  window.setServiceBranchScope('sdd');
  window.saveServiceConfig();
  const omitted = readServiceYaml(file);
  assert.equal(omitted.sdd?.base, undefined);
  assert.equal(omitted.sdd?.['branch-scope'], undefined);
  assert.equal(omitted.schema, 'spec');
  assert.equal(omitted.context, 'kept');
  assert.deepEqual(omitted.rules, ['one']);
  window.setServiceBase('main');
  window.setServiceBranchScope('feature');
  window.saveServiceConfig();
  const written = readServiceYaml(file);
  assert.equal(written.sdd?.base, 'main');
  assert.equal(written.sdd?.['branch-scope'], 'feature');
  assert.equal(written.schema, 'spec');
  assert.equal(written.context, 'kept');
  assert.deepEqual(written.rules, ['one']);
  rmSync(dir, {recursive: true, force: true});
});

test('the service-config group keeps an unknown sdd key', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  const file = writeServiceYaml(
    checkout,
    ['sdd:', '  queues:', '    - name: alpha', '  extra: stay', ''].join('\n'),
  );
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  window.openSettings();
  window.setServiceBase('main');
  window.saveServiceConfig();
  assert.equal(readServiceYaml(file).sdd?.extra, 'stay');
  rmSync(dir, {recursive: true, force: true});
});

test('the service-config group saves queue order, omits an empty description, and childQueue returns the first', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  const file = writeServiceYaml(
    checkout,
    [
      'sdd:',
      '  queues:',
      '    - name: beta',
      '      description: kept',
      '    - name: alpha',
      '',
    ].join('\n'),
  );
  writeLaunch(home, ['beta'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'beta', sddService: 'services/billing'})]},
  );
  window.openSettings();
  assert.equal(window.childQueue(), 'beta');
  window.moveServiceQueue(1, 0);
  window.setServiceQueue(0, 'alpha', '');
  window.addServiceQueue();
  window.setServiceQueue(2, 'alpha', '');
  assert.equal(window.childQueue(), 'beta');
  window.saveServiceConfig();
  assert.equal(window.childQueue(), 'alpha');
  const queues = readServiceYaml(file).sdd?.queues;
  assert.deepEqual(queues, [{name: 'alpha'}, {name: 'beta', description: 'kept'}, {name: 'alpha'}]);
  rmSync(dir, {recursive: true, force: true});
});

test('the service-config group omits ignore-comments when the last pattern is removed', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  const file = writeServiceYaml(
    checkout,
    ['sdd:', '  queues:', '    - name: alpha', '  ignore-comments:', '    - bot', ''].join('\n'),
  );
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  window.openSettings();
  window.addServiceIgnore('reviewer');
  assert.deepEqual(
    window.serviceConfig().ignoreComments?.map(item => item.value),
    ['bot', 'reviewer'],
  );
  window.removeServiceIgnore(1);
  window.removeServiceIgnore(0);
  window.saveServiceConfig();
  assert.equal(readServiceYaml(file).sdd?.['ignore-comments'], undefined);
  assert.deepEqual(readServiceYaml(file).sdd?.queues, [{name: 'alpha'}]);
  rmSync(dir, {recursive: true, force: true});
});

test('the service-config group warns when an ignore-comments pattern does not compile', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  const file = writeServiceYaml(
    checkout,
    ['sdd:', '  queues:', '    - name: alpha', '  ignore-comments:', '    - bot', ''].join('\n'),
  );
  const bytes = readFileSync(file, 'utf8');
  writeLaunch(home, ['alpha'], {arcadia});
  let started = 0;
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      answers: () => true,
      startStep: () => {
        started += 1;
      },
      tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})],
    },
  );
  window.chooseAgent('cursor');
  window.openSettings();
  window.setServiceIgnore(0, '(');
  const field = window.serviceConfig().ignoreComments?.[0];
  assert.equal(field?.value, '(');
  assert.equal(field?.warning, true);
  assert.equal(window.serviceConfig().save, false);
  window.saveServiceConfig();
  assert.equal(readFileSync(file, 'utf8'), bytes);
  assert.equal(
    window.board().pool.some(card => card.key === '1'),
    true,
  );
  window.spy();
  assert.equal(started, 1);
  window.closeSettings();
  assert.equal(readFileSync(file, 'utf8'), bytes);
  window.openSettings();
  assert.equal(window.serviceConfig().ignoreComments?.[0]?.value, 'bot');
  assert.equal(window.serviceConfig().save, true);
  rmSync(dir, {recursive: true, force: true});
});

test('the service-config group warns on an empty queue name and on the last queue', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  const file = writeServiceYaml(
    checkout,
    ['sdd:', '  queues:', '    - name: alpha', ''].join('\n'),
  );
  const bytes = readFileSync(file, 'utf8');
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  window.openSettings();
  window.addServiceQueue();
  const added = window.serviceConfig().queues?.items.at(-1);
  assert.equal(added?.name, '');
  assert.equal(added?.warning, true);
  assert.equal(window.serviceConfig().save, false);
  window.saveServiceConfig();
  assert.equal(readFileSync(file, 'utf8'), bytes);
  window.setServiceQueue(1, 'gamma', '');
  assert.equal(window.serviceConfig().queues?.items[1]?.warning, undefined);
  assert.equal(window.serviceConfig().save, true);
  window.removeServiceQueue(1);
  window.removeServiceQueue(0);
  assert.deepEqual(window.serviceConfig().queues, {items: [], warning: true});
  assert.equal(window.serviceConfig().save, false);
  window.saveServiceConfig();
  assert.deepEqual(readServiceYaml(file).sdd?.queues, [{name: 'alpha'}]);
  rmSync(dir, {recursive: true, force: true});
});

test('the service-config group warns when YAML has no sdd key', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  const file = writeServiceYaml(
    checkout,
    ['schema: spec', 'context: kept', 'rules:', '  - one', ''].join('\n'),
  );
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  window.openSettings();
  assert.deepEqual(window.serviceConfig().queues, {items: [], warning: true});
  assert.equal(window.serviceConfig().save, false);
  window.addServiceQueue();
  window.setServiceQueue(0, 'alpha', '');
  assert.equal(window.serviceConfig().queues?.warning, undefined);
  assert.equal(window.serviceConfig().save, true);
  window.saveServiceConfig();
  const doc = readServiceYaml(file);
  assert.deepEqual(doc.sdd?.queues, [{name: 'alpha'}]);
  assert.equal(doc.schema, 'spec');
  assert.equal(doc.context, 'kept');
  assert.deepEqual(doc.rules, ['one']);
  assert.equal(doc.sdd?.base, undefined);
  rmSync(dir, {recursive: true, force: true});
});

test('the service-config group can only remove a non-string ignore-comments value', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  const file = writeServiceYaml(
    checkout,
    ['sdd:', '  queues:', '    - name: alpha', '  ignore-comments: 1', ''].join('\n'),
  );
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  window.openSettings();
  const locked = window.serviceConfig().ignoreComments;
  assert.equal(locked?.length, 1);
  assert.equal(locked?.[0]?.removeOnly, true);
  assert.equal(locked?.[0]?.warning, true);
  assert.equal(window.serviceConfig().save, false);
  window.setServiceIgnore(0, 'bot');
  assert.equal(window.serviceConfig().ignoreComments?.[0]?.removeOnly, true);
  window.removeServiceIgnore(0);
  assert.equal(window.serviceConfig().save, true);
  window.saveServiceConfig();
  assert.equal(readServiceYaml(file).sdd?.['ignore-comments'], undefined);
  writeFileSync(file, 'sdd:\n  queues:\n    - name: alpha\n  ignore-comments: 1\n');
  window.closeSettings();
  window.openSettings();
  assert.equal(window.serviceConfig().ignoreComments?.[0]?.removeOnly, true);
  window.removeServiceIgnore(0);
  window.closeSettings();
  assert.equal(readServiceYaml(file).sdd?.['ignore-comments'], 1);
  rmSync(dir, {recursive: true, force: true});
});

test('the service-config group has no fields when the file does not parse and only that checkout loses its cards', () => {
  const {dir, home, arcadia} = yard();
  const billing = path.join(arcadia, 'services', 'billing');
  const other = path.join(arcadia, 'services', 'other');
  mkdirSync(billing, {recursive: true});
  mkdirSync(other, {recursive: true});
  const file = writeServiceYaml(billing, 'sdd: [\n');
  const bytes = readFileSync(file, 'utf8');
  writeServiceConfig(other, ['beta']);
  writeLaunch(home, ['alpha', 'beta'], {arcadia});
  writeOverlay(billing, [], 'models:\n  mechanical: ""\n');
  let leading = true;
  const steps: string[] = [];
  const phases: string[] = [];
  const tickets = [
    ticket({key: '1', queue: 'alpha', sddService: 'services/billing', assignee: MANAGER}),
    ticket({key: '2', queue: 'beta', sddService: 'services/other'}),
  ];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      answers: () => true,
      login: () => MANAGER,
      leading: key => key === '1' && leading,
      startStep: checkout => {
        steps.push(checkout ?? '');
      },
      writePhase: (key, phase) => {
        phases.push(`${key}:${phase}`);
      },
      tickets: () => tickets,
    },
  );
  window.chooseAgent('cursor');
  const only = openWindow({homePath: home, adapter: 'tracker'}, {tickets: () => [tickets[0]]});
  only.openSettings();
  assert.equal(only.serviceConfig().checkout, '');
  assert.equal(only.serviceConfig().save, false);
  const texts = window.board().rows.map(row => row.text);
  const factoryAt = texts.findIndex(
    text => text.includes(billing) && text.includes('нужна модель'),
  );
  const brokenAt = texts.findIndex(
    text => text.includes(billing) && text.includes('конфиг сервиса не читается'),
  );
  assert.ok(factoryAt >= 0);
  assert.ok(brokenAt > factoryAt);
  assert.equal(visibleKeys(window.board()).includes('1'), false);
  assert.equal(visibleKeys(window.board()).includes('2'), true);
  window.openSettings();
  assert.equal(window.serviceConfig().checkout, '');
  window.openCard('1');
  const group = window.serviceConfig();
  assert.equal(group.file, 'openspec/config.yaml');
  assert.equal(group.checkout, billing);
  assert.equal(group.save, false);
  assert.equal(group.queues, undefined);
  assert.equal(group.base, undefined);
  assert.equal(group.branchScope, undefined);
  assert.equal(group.ignoreComments, undefined);
  assert.equal(group.hooks, undefined);
  window.addServiceQueue();
  window.saveServiceConfig();
  assert.equal(readFileSync(file, 'utf8'), bytes);
  window.spy();
  assert.deepEqual(steps, [other]);
  assert.deepEqual(phases, []);
  leading = false;
  window.spy();
  assert.deepEqual(steps, [other, other]);
  assert.deepEqual(phases, []);
  writeServiceConfig(billing, ['alpha']);
  rmSync(path.join(billing, '.aifactory'), {recursive: true, force: true});
  window.spy();
  assert.equal(steps.includes(billing), true);
  assert.equal(visibleKeys(window.board()).includes('1'), true);
  assert.equal(visibleKeys(window.board()).includes('2'), true);
  rmSync(dir, {recursive: true, force: true});
});

test('the service-config group shows no fields when the agent is silent and the file does not parse', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceYaml(checkout, 'sdd: [\n');
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      answers: () => false,
      tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})],
    },
  );
  window.chooseAgent('cursor');
  window.openCard('1');
  window.openSettings();
  assert.deepEqual(window.board().rows, [{text: 'агент не отвечает'}]);
  assert.equal(window.board().settingsOpen, true);
  assert.equal(window.serviceConfig().checkout, checkout);
  assert.equal(window.serviceConfig().save, false);
  assert.equal(window.serviceConfig().queues, undefined);
  rmSync(dir, {recursive: true, force: true});
});

test('the service-config group creates a missing file from the queue the manager adds', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  const file = path.join(checkout, 'openspec', 'config.yaml');
  writeLaunch(home, ['alpha'], {arcadia});
  let started = 0;
  let leading = false;
  const assignees: string[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      answers: () => true,
      login: () => MANAGER,
      leading: () => leading,
      startStep: () => {
        started += 1;
      },
      writeAssignee: key => {
        assignees.push(key);
      },
      tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})],
    },
  );
  window.chooseAgent('cursor');
  const card = window.board().pool.find(item => item.key === '1');
  assert.ok(card);
  assert.equal(card.reason, 'конфига сервиса нет');
  assert.notEqual(card.reason, 'каталога нет');
  assert.equal(card.takeDisabled, true);
  window.take('1');
  assert.deepEqual(assignees, []);
  window.spy();
  assert.equal(started, 0);
  leading = true;
  window.spy();
  assert.equal(started, 0);
  leading = false;
  window.spy();
  assert.equal(started, 0);
  window.openSettings();
  assert.equal(window.serviceConfig().file, 'openspec/config.yaml');
  assert.equal(window.serviceConfig().checkout, checkout);
  assert.equal(window.serviceConfig().queues, undefined);
  assert.equal(window.serviceConfig().save, false);
  window.saveServiceConfig();
  assert.equal(existsSync(file), false);
  window.addServiceQueue();
  assert.equal(window.serviceConfig().save, false);
  window.setServiceQueue(0, 'alpha', '');
  window.saveServiceConfig();
  const doc = readServiceYaml(file);
  assert.deepEqual(doc.sdd?.queues, [{name: 'alpha'}]);
  assert.equal(doc.schema, undefined);
  assert.equal(doc.context, undefined);
  assert.equal(doc.rules, undefined);
  window.spy();
  assert.equal(started, 1);
  window.take('1');
  assert.deepEqual(assignees, ['1']);
  rmSync(dir, {recursive: true, force: true});
});

test('the service-config group writes one hook string back as a list and leaves a number', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  const file = writeServiceYaml(
    checkout,
    [
      'sdd:',
      '  queues:',
      '    - name: alpha',
      '  hooks:',
      '    review:',
      '      before: keep me',
      '      after: 4',
      '    other:',
      '      before:',
      '        - one',
      '        - two',
      '',
    ].join('\n'),
  );
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  window.openSettings();
  assert.deepEqual(window.serviceConfig().hooks, [
    {action: 'review', point: 'before', values: ['keep me']},
    {action: 'other', point: 'before', values: ['one', 'two']},
  ]);
  window.saveServiceConfig();
  const hooks = readServiceYaml(file).sdd?.hooks;
  assert.deepEqual(hooks?.review?.before, ['keep me']);
  assert.equal(hooks?.review?.after, 4);
  assert.deepEqual(hooks?.other?.before, ['one', 'two']);
  rmSync(dir, {recursive: true, force: true});
});

test('the service-config group discards an unsaved queue edit and the spy reads the disk queues', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha']);
  const file = path.join(checkout, 'openspec', 'config.yaml');
  writeLaunch(home, ['alpha'], {arcadia});
  let started = 0;
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      answers: () => true,
      startStep: () => {
        started += 1;
      },
      tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})],
    },
  );
  window.chooseAgent('cursor');
  window.openSettings();
  window.setServiceQueue(0, 'gamma', 'draft');
  assert.equal(window.serviceConfig().queues?.items[0]?.name, 'gamma');
  assert.equal(window.childQueue(), 'alpha');
  window.spy();
  assert.equal(started, 1);
  assert.deepEqual(readServiceYaml(file).sdd?.queues, [{name: 'alpha'}]);
  window.closeSettings();
  assert.deepEqual(readServiceYaml(file).sdd?.queues, [{name: 'alpha'}]);
  window.openSettings();
  assert.equal(window.serviceConfig().queues?.items[0]?.name, 'alpha');
  assert.equal(window.serviceConfig().queues?.items[0]?.description, '');
  rmSync(dir, {recursive: true, force: true});
});

test('the service-config group shows the disk copy when the file changed before save', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  const file = writeServiceYaml(
    checkout,
    ['sdd:', '  queues:', '    - name: alpha', ''].join('\n'),
  );
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  window.openSettings();
  assert.equal(window.serviceConfig().queues?.items[0]?.name, 'alpha');
  writeFileSync(file, 'sdd:\n  queues:\n    - name: beta\n  base: main\n');
  window.setServiceBase('trunk');
  window.saveServiceConfig();
  const doc = readServiceYaml(file);
  assert.equal(doc.sdd?.queues?.[0]?.name, 'beta');
  assert.equal(doc.sdd?.base, 'main');
  assert.equal(window.serviceConfig().queues?.items[0]?.name, 'beta');
  assert.equal(window.serviceConfig().base, 'main');
  assert.equal(window.serviceConfig().save, true);
  rmSync(dir, {recursive: true, force: true});
});
