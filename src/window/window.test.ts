import assert from 'node:assert/strict';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {homedir, tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'vitest';
import {parse} from 'yaml';

import {memoryPorts} from '../adapters/github.ts';
import type {FileSource} from '../machine/port.ts';
import {loadCycle} from '../machine/snapshot.ts';
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
  const card = window.board().cards.find(item => item.key === '1');
  assert.ok(card);
  assert.equal(card.checkout, path.join(homedir(), 'arcadia', 'services', 'billing'));
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
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  const card = window.board().cards.find(item => item.key === '1');
  assert.ok(card);
  assert.equal(card.checkout, checkout);
  assert.equal(card.checkout?.startsWith('/wrong'), false);
  rmSync(dir, {recursive: true, force: true});
});

test('tracker gathers the checkout under the arcadia root', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  const card = window.board().cards.find(item => item.key === '1');
  assert.ok(card);
  assert.equal(card.checkout, checkout);
  assert.equal(card.reason, 'каталога нет');
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
    ticket({key: '2', repo: 'acme/billing', sddService: '', labels: ['alpha', 'sdd:cycle']}),
  ];
  const window = openWindow({homePath: home, adapter: 'github'}, {tickets: () => tickets});
  const nestedCard = window.board().cards.find(item => item.key === '1');
  const rootCard = window.board().cards.find(item => item.key === '2');
  assert.ok(nestedCard);
  assert.ok(rootCard);
  assert.equal(nestedCard.checkout, nested);
  assert.equal(rootCard.checkout, repo);
  assert.equal(rootCard.reason, '');
  assert.equal(rootCard.takeDisabled, false);
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
  assert.equal(board.cards.find(item => item.key === '1')?.reason, 'каталога нет');
  assert.equal(board.cards.find(item => item.key === '1')?.checkout, undefined);
  assert.equal(board.cards.find(item => item.key === '2')?.reason, 'каталога нет');
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
    board.cards.map(item => item.key),
    ['1', '2'],
  );
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
    window.board().cards.map(item => item.key),
    ['1'],
  );
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
    board.cards.map(item => item.key),
    ['1'],
  );
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
  const alpha = board.cards.find(item => item.key === '1');
  const beta = board.cards.find(item => item.key === '2');
  assert.ok(alpha);
  assert.ok(beta);
  assert.equal(alpha.queue, 'alpha');
  assert.equal(beta.queue, 'beta');
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
  const matched = board.cards.find(item => item.key === '1');
  const missing = board.cards.find(item => item.key === '3');
  assert.ok(matched);
  assert.equal(matched.queue, 'alpha');
  assert.equal(
    board.cards.some(item => item.key === '2'),
    false,
  );
  assert.ok(missing);
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
  const reason = (key: string) => board.cards.find(item => item.key === key);
  assert.equal(reason('1')?.reason, 'каталога нет');
  assert.equal(reason('1')?.reason.startsWith('конфига сервиса нет'), false);
  assert.equal(reason('2')?.reason, 'не назван сервис');
  assert.equal(reason('2')?.checkout, undefined);
  assert.equal(reason('3')?.reason, 'не назван сервис');
  assert.equal(reason('4')?.reason, 'конфига сервиса нет');
  assert.equal(reason('5')?.reason, 'очереди нет в конфиге сервиса');
  for (const card of board.cards) {
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
  const gone = window.board().cards.find(item => item.key === '2');
  assert.ok(gone);
  assert.equal(gone.reason, 'каталога нет');
  assert.deepEqual(gone.choices, ['services/billing']);
  assert.equal(existsSync(path.join(arcadia, 'services', 'gone')), false);
  window.take('2');
  window.spy();
  assert.equal(assignees, 0);
  assert.equal(started, 1);
  rmSync(dir, {recursive: true, force: true});
});

test('a tracker ticket with no sddService offers checkouts that already have the queue', () => {
  const {dir, home, arcadia} = yard();
  const billing = path.join(arcadia, 'services', 'billing');
  const other = path.join(arcadia, 'services', 'other');
  mkdirSync(billing, {recursive: true});
  mkdirSync(other, {recursive: true});
  writeServiceConfig(billing, ['alpha']);
  writeServiceConfig(other, ['beta']);
  writeLaunch(home, ['alpha'], {arcadia});
  let writes = 0;
  let assignees = 0;
  const tickets = [
    ticket({key: '1', queue: 'alpha', sddService: 'services/billing'}),
    ticket({key: '2', queue: 'alpha', sddService: 'services/other'}),
    ticket({key: '3', queue: 'alpha'}),
  ];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      tickets: () => tickets,
      writeService: () => {
        writes += 1;
      },
      writeAssignee: () => {
        assignees += 1;
      },
    },
  );
  const card = window.board().cards.find(item => item.key === '3');
  assert.ok(card);
  assert.deepEqual(card.choices, ['services/billing']);
  assert.equal(card.reason, 'не назван сервис');
  assert.equal(card.takeDisabled, true);
  window.take('3');
  assert.equal(writes, 0);
  assert.equal(assignees, 0);
  assert.equal(tickets[2].sddService, undefined);
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
  const written = board.cards.find(item => item.key === '1');
  assert.ok(written);
  assert.equal(written.checkout, alone);
  assert.equal(written.reason, '');
  const choice = board.cards.find(item => item.key === '2');
  assert.ok(choice);
  assert.deepEqual(choice.choices, ['', 'services/api']);
  assert.equal(choice.reason, 'не назван сервис');
  assert.equal(
    writes.some(item => item.key === '2'),
    false,
  );
  const unreadable = board.cards.find(item => item.key === '3');
  assert.ok(unreadable);
  assert.deepEqual(unreadable.choices, []);
  assert.equal(unreadable.reason, 'не назван сервис');
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
  assert.equal(window.board().cards[0]?.reason, 'не назван сервис');
  window.chooseService('1', 'services/other');
  const card = window.board().cards.find(item => item.key === '1');
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
  assert.equal(window.board().cards[0]?.reason, 'очереди нет в конфиге сервиса');
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
    board.cards.map(item => item.key),
    ['1'],
  );
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
