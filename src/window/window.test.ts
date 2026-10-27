import assert from 'node:assert/strict';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {homedir, tmpdir} from 'node:os';
import path from 'node:path';
import {requirement, scenario, spec} from '@ojson/spec-coverage';
import {test} from 'vitest';
import {parse} from 'yaml';

import {memoryPorts} from '../adapters/github.ts';
import {changeDir} from '../machine/naming.ts';
import type {FileSource} from '../machine/port.ts';
import {ACTION_SKILL} from '../machine/route.ts';
import {loadCycle} from '../machine/snapshot.ts';
import {openWindow, type WindowTicket} from './window.ts';

function scratch(): {dir: string; home: string} {
  const dir = mkdtempSync(path.join(tmpdir(), 'ai-factory-home-'));
  return {dir, home: path.join(dir, 'home.yaml')};
}

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

type ReviewReading = {
  threads: readonly {marker?: string | null; lines: readonly string[]}[];
  conversation?: {last?: {marker?: string | null; body: string} | null} | null;
};

function openSide(
  home: string,
  tickets: readonly WindowTicket[],
  extra: {
    leading?: (key: string) => boolean;
    review?: (key: string) => ReviewReading | undefined;
  } = {},
) {
  return openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => tickets,
      leading: extra.leading,
      review: extra.review,
    },
  );
}

function kinds(blocks: readonly {kind: string}[]): string[] {
  return blocks.map(block => block.kind);
}

function proveALaunchWithNoHomePathShowsOneRowThatTheFactoryStillNeedsAnAgent0(): void {
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
}

function proveAMissingHomeFileShowsTheBoardAndDoesNotStartAStep1(): void {
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
}

function proveChoosingCursorWritesItsPairAndOmitsEffortAndSpeed2(): void {
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
}

function proveChoosingCodexWritesItsPairAndEffortAndOmitsSpeed3(): void {
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
}

function proveChoosingClaudeCodeWritesItsPairAndEffortAndOmitsSpeed4(): void {
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
}

function proveChoosingOpencodeWritesItsPairAndOmitsEffortAndSpeed5(): void {
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
}

function proveNoHomePathWritesNoFileWhenTheManagerChoosesAnAgent8(): void {
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
}

function proveAnEmptyAgentListWritesNoHomeFile9(): void {
  const {dir, home} = scratch();
  const window = openWindow({homePath: home, agents: []});
  window.chooseAgent('cursor');
  window.chooseAgent('codex');
  assert.equal(existsSync(home), false);
  assert.deepEqual(window.board().rows, [{text: 'фабрике ещё нужен агент'}]);
  rmSync(dir, {recursive: true, force: true});
}

function proveLeavingAModelEmptyWritesThatField10(): void {
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
}

function proveEmptyEffortAndSpeedAreTheAgentDefaultAndDoNotStopAStep12(): void {
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
  assert.deepEqual(window.settings().effortWords, ['low', 'medium', 'high', 'xhigh', 'max']);
  assert.deepEqual(window.settings().speedWords, ['fast']);
  window.leaveEffort('mechanical', 'turbo');
  window.leaveSpeed('mechanical', 'slow');
  assert.equal(readHome(home).effort, undefined);
  assert.equal(readHome(home).speed, undefined);
  window.leaveEffort('mechanical', 'max');
  window.leaveSpeed('mechanical', 'fast');
  assert.equal(readHome(home).effort?.mechanical, 'max');
  assert.equal(readHome(home).speed?.mechanical, 'fast');
  window.leaveEffort('mechanical', '');
  window.leaveSpeed('mechanical', '');
  window.spy();
  assert.equal(started, 1);
  assert.equal(window.board().stepsStart, true);
  rmSync(dir, {recursive: true, force: true});
}

function proveANewerHomeFileBlocksTheWriteAndTheWindowShowsTheDisk13(): void {
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
}

function proveChangingTheAgentReplacesTheSetAndDropsOldEffortAndSpeed15(): void {
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
}

function proveARecordedAgentThatDoesNotAnswerStaysInTheFile16(): void {
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
}

function proveASilentAgentHidesTheEmptyModelRow17(): void {
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
}

function proveTheHomeFileGainsNoPersonPhaseFocusOrMetrics18(): void {
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
}

function proveAnEmptyRootLeavesArcadiaOrGithub21(): void {
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
}

function proveTrackerGathersTheCheckoutUnderTheArcadiaRoot23(): void {
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
}

function proveGithubGathersUnderTheRepositoryAndAnEmptySddServiceIsThatRoot24(): void {
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
}

function proveAPathWithOrOutsideTheRootIsAMissingCatalog25(): void {
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
}

function proveAnOverlayWatchNameJoinsTheHomeListAndARepeatedNameIsOne26(): void {
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
}

function proveANameRemovedFromOneFileStaysWhileTheOtherFileStillHasIt27(): void {
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
  window.openCard('1');
  window.leaveOverlayWatch(['beta']);
  assert.deepEqual(window.board().watch, ['beta']);
  assert.deepEqual(readHome(path.join(checkout, '.aifactory', 'config.yaml')).watch, ['beta']);
  writeOverlay(checkout, []);
  assert.deepEqual(window.board().watch, []);
  assert.deepEqual(window.board().cards, []);
  rmSync(dir, {recursive: true, force: true});
}

function proveEmptyWatchListsLeaveTheBoardWithNoCards30(): void {
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
}

function proveServiceQueuesDoNotJoinTheWatchList31(): void {
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
}

function proveATrackerTicketIsSelectedByThePortQueueAndALabelDoesNotReplaceIt32(): void {
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
}

function proveAGithubQueueIsTheFirstSddQueuesNameOnTheIssueAndTheKeyIsOwnerRepo33(): void {
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
}

function proveTheFirstCheckoutBreakIsTheOnlyReasonAndTakeDoesNotWriteTheAssignee35(): void {
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
}

function proveAMissingCatalogKeepsTheCardAndTheChoiceAndDoesNotStartAStep36(): void {
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
}

function proveOneTrackerServiceThatAlreadyListsTheQueueWritesItself37(): void {
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
}

function proveABlankTrackerSddServiceWritesTheSingleServiceThatListsTheQueue38(): void {
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
}

function proveSeveralTrackerServicesThatListTheQueueStayAChoice39(): void {
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
}

function proveOneGithubDirectoryWithAnSddKeyWritesItselfAndSeveralStayAChoice40(): void {
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
}

function proveWritingSddServiceKeepsTheQueueBreakWhenTheServiceStillLacksTheQueue41(): void {
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
}

function proveTheBoardAndTheWindowSpyReadOneWatchList44(): void {
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
      login: () => MANAGER,
      startStep: value => {
        started.push(value ?? '');
      },
      tickets: () => [
        ticket({key: '1', queue: 'alpha', sddService: 'services/billing'}),
        ticket({key: '2', queue: 'beta', sddService: 'services/other'}),
        cycle('3', 'implementing'),
        cycle('4', 'implementing', {queue: 'beta', sddService: 'services/other'}),
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
  assert.deepEqual(
    columnCards(board, 'implementing')?.map(card => card.key),
    ['3'],
  );
  const shown = [
    ...board.pool.map(card => card.key),
    ...(board.columns ?? []).flatMap(column => column.cards.map(card => card.key)),
  ];
  assert.equal(shown.includes('2'), false);
  assert.equal(shown.includes('4'), false);
  window.spy();
  assert.deepEqual(started, [billing]);
  rmSync(dir, {recursive: true, force: true});
}

async function proveTheMachineSpyLeavesABareCycleOutAndDoesNotReadAifactory45(): Promise<void> {
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
}

function proveAnEmptySpecifyingColumnStaysAndTheWindowWritesNoPhase46(): void {
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

  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const opened = openCycles(home, [cycle('1', 'implementing')]);
  opened.openCard('1');
  assert.equal(
    Object.keys(opened).some(name => name.toLowerCase().includes('phase')),
    false,
  );
  assert.equal('panel' in opened.board(), false);
  rmSync(dir, {recursive: true, force: true});
}

function proveProposedStandsInProposingAndSpecifiedStandsInSpecifying47(): void {
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
}

function proveAnotherAssigneeIsAbsentAndAPhaseWithNoAssigneeStandsInThePool48(): void {
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
}

function proveSddCancelledWithAnEarlierPhaseShowsNoCard49(): void {
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
}

function proveAnOpenMergeStandsInAcceptingAndAClosedIssueLeaves50(): void {
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
}

function proveProposingShowsTwoOpenQuestionsUnderTheHeading51(): void {
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
}

function proveSpecifyingHasNoPhaseRow52(): void {
  const {dir, home, arcadia} = yard();
  const checkout = prepare(arcadia, home);
  writeChange(checkout, '1', 'proposal.md', '## Open questions\n\n- [ ] one\n');
  const window = openCycles(home, [cycle('1', 'specified')]);
  const card = columnCards(window.board(), 'specifying')?.[0];
  assert.ok(card);
  assert.equal(card.phaseRow, undefined);
  rmSync(dir, {recursive: true, force: true});
}

function proveImplementingCountsTasksMdAndOmitsTheCountWhenTheFileIsAbsent54(): void {
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
}

function proveVerifyingShowsRedAndNoneLeavesTheCheckRowBlank55(): void {
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
}

function proveAFocusGapShowsSpecifyAndHidesASolidPlan56(): void {
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
}

function proveEveryRecordedLayerSolidHasNoLayerLine57(): void {
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
}

function proveARunningStepHidesTheIconWhileTheOccasionStillSortsFirst58(): void {
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
  assert.equal(hidden?.reason, 'Ask');
  assert.equal(shown?.icon, true);
  assert.equal(shown?.reason, 'Ask');
  rmSync(dir, {recursive: true, force: true});
}

function proveAMissingCatalogOutranksAMissingServiceConfigInTheReason60(): void {
  const {dir, home, arcadia} = yard();
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openCycles(home, [cycle('1', 'proposed', {sddService: 'services/missing'})]);
  const card = columnCards(window.board(), 'proposing')?.[0];
  assert.equal(card?.reason?.startsWith('каталога нет'), true);
  assert.equal(card?.reason?.startsWith('конфига сервиса нет'), false);
  assert.equal(card?.reason?.includes('конфига сервиса нет'), false);
  rmSync(dir, {recursive: true, force: true});
}

function proveAQuestionOnlyOccasionWhosePhaseRowShowsTheCountHasNoReasonLine61(): void {
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
}

function proveAChildRecordPutsAndThatKeyOnTheReason63(): void {
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
}

function proveAMissingHomeFileLeavesSettingsClosedUntilTheManagerOpensThem66(): void {
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
}

function proveAnOpenWatchListTicketWithSddCycleNoPhaseAndNoAssigneeStandsInThePool67(): void {
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
}

function proveAnOpenTicketOnTheWatchListWithoutSddCycleIsNotInThePool68(): void {
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
}

function proveAPhaselessTicketAssignedToThisLoginMovesToProposingAfterSpyWhenModelsAreSet70(): void {
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
}

function proveAPhaselessTicketAssignedToThisLoginStaysInThePoolWhenAModelSlotIsEmpty71(): void {
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
}

function proveTwoOpenPullRequestsKeepAnAssignedTicketInThePoolAndSpyDoesNotSetProposing72(): void {
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
}

function proveAMissingCheckoutKeepsAnAssignedTicketInThePoolAndSpyDoesNotSetProposing73(): void {
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
}

function proveOneOpenPullRequestLetsSpySetProposingForAnAssignedTicket74(): void {
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
}

function proveTakeOnAPhaselessTicketSetsTheAssigneeAndSpyThenSetsProposing75(): void {
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
}

function proveTakeDoesNotCallWriteAssigneeWhenTheHomePathIsAbsent76(): void {
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
}

function proveTakeOnAnImplementingPoolCycleSetsTheAssigneeAndLeavesThePhase77(): void {
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
}

function proveTakeOnAnImplementingPoolCycleWritesTheAssigneeWhenAModelSlotIsEmpty78(): void {
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
}

function proveTwoOpenPullRequestsKeepTheCardInThePoolAndDoNotWriteTheAssignee79(): void {
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
}

function proveOneOpenPullRequestLetsTakeWriteTheAssignee80(): void {
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
}

function proveAPoolTicketWithACheckoutBreakShowsTheIconAndTakeDoesNotWrite81(): void {
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
}

function proveAnOverlayMechanicalModelReplacesTheHomeIdAndAMissingOverlayKeepsHome84(): void {
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
}

function proveChangingTheOverlayAgentToOpencodeWritesThePairAndNoEffortOrSpeed85(): void {
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
}

function proveAnOverlayEditIsOnDiskAfterSettingsClose86(): void {
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
}

function proveAnOverlayAgentOfCodexWithNoEffortKeyDoesNotTakeHomeEffortMax87(): void {
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
}

function proveClearingTheOverlayAgentRemovesAgentModelsEffortAndSpeed88(): void {
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
}

function proveClearingOverlayEffortAndSpeedRemovesThoseKeys(): void {
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
  assert.deepEqual(window.overlay().effortWords, ['low', 'medium', 'high', 'xhigh', 'max']);
  assert.deepEqual(window.overlay().speedWords, ['fast']);
  window.leaveOverlayEffort('mechanical', 'turbo');
  window.leaveOverlaySpeed('judgment', 'slow');
  const kept = readHome(path.join(checkout, '.aifactory', 'config.yaml'));
  assert.equal(kept.effort?.mechanical, 'high');
  assert.equal(kept.speed?.mechanical, 'fast');
  window.leaveOverlayEffort('mechanical', '');
  window.leaveOverlayEffort('judgment', '');
  window.leaveOverlaySpeed('mechanical', '');
  const doc = readHome(path.join(checkout, '.aifactory', 'config.yaml'));
  assert.equal(doc.agent, 'codex');
  assert.equal(doc.effort, undefined);
  assert.equal(doc.speed, undefined);
  rmSync(dir, {recursive: true, force: true});
}

function proveClearingOverlayJudgmentWithNoOverlayAgentShowsTheHomeJudgmentId89(): void {
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
}

function proveOneGatheredCheckoutIsSelectedWhenSettingsOpenWithNoCard91(): void {
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
  assert.equal(window.serviceConfig().checkout, checkout);
  rmSync(dir, {recursive: true, force: true});
}

function proveSeveralGatheredCheckoutsWriteNothingUntilChooseCheckout92(): void {
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
  assert.equal(window.serviceConfig().checkout, '');
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
}

function proveAnEmptyMergedMechanicalModelNamesTheCheckoutAndStopsOnlyThatStep93(): void {
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
}

function proveASilentAgentDoesNotShowTheCheckoutEmptyModelRow94(): void {
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
}

function proveACatalogThatRejectsTheRecordedJudgmentIdKeepsItAndStopsTheStep95(): void {
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
}

function proveAStartedStepKeepsTheMechanicalIdFromThatCallUntilLeadingIsFalse96(): void {
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
}

function proveHealthyPoolCardsAreOrderedByKeyAndHaveNoIcon97(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(home, [
    ticket({key: 'c', queue: 'alpha', sddService: 'services/billing', title: 'Third'}),
    cycle('b', 'proposed', {assignee: '', title: 'Gate', openPullRequests: 1}),
    ticket({key: 'a', queue: 'alpha', sddService: 'services/billing', title: 'First'}),
  ]);
  window.chooseAgent('cursor');
  const checkout = path.join(arcadia, 'services', 'billing');
  const place = {
    queue: 'alpha',
    choices: ['services/billing'],
    checkout,
    service: 'services/billing',
  };
  assert.deepEqual(window.board().pool, [
    {key: 'a', title: 'First', take: true, ...place},
    {
      key: 'b',
      title: 'Gate',
      take: true,
      station: 'proposing',
      phaseRow: 0,
      reason: 'proposed',
      ...place,
    },
    {key: 'c', title: 'Third', take: true, ...place},
  ]);
  rmSync(dir, {recursive: true, force: true});
}

function proveTheServiceConfigGroupOmitsADefaultBaseAndWritesMainBesideSchemaContextAndRules98(): void {
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
}

function proveTheServiceConfigGroupKeepsAnUnknownSddKey99(): void {
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
}

function proveTheServiceConfigGroupSavesQueueOrderOmitsAnEmptyDescriptionAndChildQueueReturnsTheFirst100(): void {
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
}

function proveTheServiceConfigGroupOmitsIgnoreCommentsWhenTheLastPatternIsRemoved101(): void {
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
}

function proveTheServiceConfigGroupWarnsWhenAnIgnoreCommentsPatternDoesNotCompile102(): void {
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
}

function proveTheServiceConfigGroupWarnsOnAnEmptyQueueNameAndOnTheLastQueue103(): void {
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
}

function proveTheServiceConfigGroupWarnsWhenYAMLHasNoSddKey104(): void {
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
}

function proveTheServiceConfigGroupCanOnlyRemoveANonStringIgnoreCommentsValue105(): void {
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
}

function proveTheServiceConfigGroupHasNoFieldsWhenTheFileDoesNotParseAndOnlyThatCheckoutLosesItsCards106(): void {
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
  assert.equal(group.line, 'конфиг сервиса не читается');
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
}

function proveTheServiceConfigGroupCreatesAMissingFileFromTheQueueTheManagerAdds108(): void {
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
  assert.deepEqual(window.serviceConfig().queues, {items: []});
  assert.equal(window.serviceConfig().save, true);
  assert.equal(window.serviceConfig().line, undefined);
  window.saveServiceConfig();
  assert.equal(existsSync(file), true);
  const created = readServiceYaml(file);
  assert.equal(created.schema, undefined);
  assert.equal(created.context, undefined);
  assert.equal(created.rules, undefined);
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
}

function proveTheServiceConfigGroupDiscardsAnUnsavedQueueEditAndTheSpyReadsTheDiskQueues110(): void {
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
}

function proveTheServiceConfigGroupShowsTheDiskCopyWhenTheFileChangedBeforeSave111(): void {
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
}

function proveAnOpenCycleWhoseOnlySidebarBlockIsFocusShowsThatBlock113(): void {
  const {dir, home, arcadia} = yard();
  const checkout = prepare(arcadia, home);
  writeChange(
    checkout,
    '1',
    'proposal.md',
    'UNIQUE PROPOSAL BODY that must stay out of the sidebar\n',
  );
  const item = cycle('1', 'implementing', {
    comments: [{body: 'sdd:focus\nSpecify thread 4\n'}],
  });
  Object.assign(item, {body: 'MIRROR TEXT stays in the issue'});
  const window = openSide(home, [item]);
  window.openCard('1');
  const blocks = window.sidebar();
  assert.deepEqual(blocks, [{kind: 'focus', body: 'Specify thread 4\n'}]);
  const text = JSON.stringify(blocks);
  assert.equal(text.includes('UNIQUE PROPOSAL BODY'), false);
  assert.equal(text.includes('MIRROR TEXT'), false);
  assert.equal(text.includes('sdd:focus'), false);
  rmSync(dir, {recursive: true, force: true});
}

function proveASpecifyingCycleWithNoOccasionHasNoReasonBlock(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openSide(home, [cycle('1', 'specifying')]);
  const card = columnCards(window.board(), 'specifying')?.[0];
  assert.equal(card?.icon, undefined);
  assert.equal(card?.reason, undefined);
  window.openCard('1');
  assert.equal(kinds(window.sidebar()).includes('reason'), false);
  rmSync(dir, {recursive: true, force: true});
}

function proveACardWithNoIconHasNoSidebarReasonBlock115(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openSide(
    home,
    [
      cycle('1', 'specifying', {
        labels: ['sdd:cycle', 'sdd:specifying', 'sdd:wait-human'],
        comments: [{body: 'please decide'}],
      }),
    ],
    {leading: key => key === '1'},
  );
  const card = columnCards(window.board(), 'specifying')?.[0];
  assert.equal(card?.icon, undefined);
  assert.equal(card?.reason, 'Ask');
  window.openCard('1');
  const blocks = window.sidebar();
  assert.deepEqual(blocks, [
    {kind: 'reason', line: 'Ask'},
    {kind: 'ask', body: 'please decide'},
  ]);
  rmSync(dir, {recursive: true, force: true});
}

function proveAQuestionOnlyCardHidesTheLineAndTheSidebarStillShowsIt116(): void {
  const {dir, home, arcadia} = yard();
  const checkout = prepare(arcadia, home);
  writeChange(checkout, 'b', 'proposal.md', '## Open questions\n\n- [ ] one\n- [ ] two\n');
  const window = openSide(home, [cycle('b', 'proposing')]);
  const card = columnCards(window.board(), 'proposing')?.[0];
  assert.equal(card?.phaseRow, 2);
  assert.equal(card?.icon, true);
  assert.equal(card?.reason, undefined);
  window.openCard('b');
  assert.deepEqual(window.sidebar(), [{kind: 'reason', line: 'вопросы 2'}]);
  rmSync(dir, {recursive: true, force: true});
}

function proveTheSidebarAskIsTheLatestCommentThatDoesNotStartWithSddFocus118(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openSide(home, [
    cycle('1', 'implementing', {
      labels: ['sdd:cycle', 'sdd:implementing', 'sdd:wait-human'],
      comments: [
        {body: 'older note'},
        {body: 'please decide\nthe rest'},
        {body: 'sdd:focus\nPlan gap\n'},
      ],
    }),
  ]);
  window.openCard('1');
  const ask = window.sidebar().find(block => block.kind === 'ask');
  assert.deepEqual(ask, {kind: 'ask', body: 'please decide\nthe rest'});
  rmSync(dir, {recursive: true, force: true});
}

function proveRemovingSddWaitHumanRemovesTheSidebarAskWhileTheCommentsRemain119(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const labels = ['sdd:cycle', 'sdd:implementing', 'sdd:wait-human'];
  const comments = [{body: 'please decide'}, {body: 'sdd:focus\nPlan gap\n'}];
  const window = openSide(home, [cycle('1', 'implementing', {labels, comments})]);
  window.openCard('1');
  assert.equal(kinds(window.sidebar()).includes('ask'), true);
  labels.splice(labels.indexOf('sdd:wait-human'), 1);
  const blocks = window.sidebar();
  assert.equal(kinds(blocks).includes('ask'), false);
  assert.deepEqual(blocks, [{kind: 'focus', body: 'Plan gap\n'}]);
  assert.equal(comments.length, 2);
  rmSync(dir, {recursive: true, force: true});
}

function proveNoSddFocusCommentLeavesNoSidebarFocusBlock120(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openSide(home, [cycle('1', 'implementing', {comments: [{body: 'just a note'}]})]);
  window.openCard('1');
  assert.deepEqual(window.sidebar(), []);
  rmSync(dir, {recursive: true, force: true});
}

function proveTheSidebarFocusPlaqueDoesNotIncludeTheMarkerLine121(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openSide(home, [
    cycle('1', 'implementing', {
      comments: [
        {body: 'sdd:focus\nSpecify thread 4\nwhy this gap\n'},
        {body: 'sdd:focus\nPlan gap\n', manager: true},
        {body: 'a later note'},
      ],
    }),
  ]);
  window.openCard('1');
  const blocks = window.sidebar();
  assert.deepEqual(blocks, [{kind: 'focus', body: 'Specify thread 4\nwhy this gap\n'}]);
  assert.equal(JSON.stringify(blocks).includes('sdd:focus'), false);
  assert.equal(JSON.stringify(blocks).includes('Plan gap'), false);
  rmSync(dir, {recursive: true, force: true});
}

function proveAThreadWithNoMarkerIsInTheSidebarUnansweredBlock122(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  let asked = '';
  const window = openSide(home, [cycle('1', 'implementing')], {
    review: key => {
      asked = key;
      return {
        threads: [
          {marker: null, lines: ['please look', 'at the diff']},
          {marker: 'code', lines: ['already marked']},
        ],
        conversation: {last: {marker: 'note', body: 'answered already'}},
      };
    },
  });
  window.openCard('1');
  const blocks = window.sidebar();
  assert.equal(asked, '1');
  assert.deepEqual(blocks, [
    {kind: 'unanswered', threads: [{lines: ['please look', 'at the diff']}]},
  ]);
  const text = JSON.stringify(blocks);
  assert.equal(text.includes('already marked'), false);
  assert.equal(text.includes('answered already'), false);
  rmSync(dir, {recursive: true, force: true});
}

function proveEveryMarkedThreadAndAMarkedLastCommentLeaveNoSidebarUnansweredBlock123(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openSide(home, [cycle('1', 'implementing')], {
    review: () => ({
      threads: [
        {marker: 'code', lines: ['one']},
        {marker: 'fixed', lines: ['two']},
      ],
      conversation: {last: {marker: 'note', body: 'done'}},
    }),
  });
  window.openCard('1');
  assert.deepEqual(window.sidebar(), []);
  rmSync(dir, {recursive: true, force: true});
}

function proveSddHooksListsArchiveBeforeThenCreateProposalAfterInTheSidebar126(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const item = cycle('1', 'implementing');
  item.sddHooks = [
    {action: 'archive', point: 'before', value: 'keep the archive\nstill here'},
    {action: 'create-proposal', point: 'after', value: 'then propose'},
  ];
  const window = openSide(home, [item]);
  window.openCard('1');
  assert.deepEqual(window.sidebar(), [
    {
      kind: 'hook',
      points: [
        {action: 'archive', point: 'before', paragraph: 'keep the archive\nstill here'},
        {action: 'create-proposal', point: 'after', paragraph: 'then propose'},
      ],
    },
  ]);
  rmSync(dir, {recursive: true, force: true});
}

function proveANestedSddHooksMapKeepsFieldOrderInTheSidebar127(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const item = cycle('1', 'implementing');
  item.sddHooks = {
    archive: {before: 'keep the archive\nstill here'},
    'create-proposal': {after: 'then propose'},
  };
  const window = openSide(home, [item]);
  window.openCard('1');
  assert.deepEqual(window.sidebar(), [
    {
      kind: 'hook',
      points: [
        {action: 'archive', point: 'before', paragraph: 'keep the archive\nstill here'},
        {action: 'create-proposal', point: 'after', paragraph: 'then propose'},
      ],
    },
  ]);
  rmSync(dir, {recursive: true, force: true});
}

function proveASpacePointDropsFromTheSidebarAndTheOtherPointRemains(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const item = cycle('1', 'implementing');
  item.sddHooks = {archive: {before: '   ', after: 'keep'}};
  const window = openSide(home, [item]);
  window.openCard('1');
  assert.deepEqual(window.sidebar(), [
    {
      kind: 'hook',
      points: [{action: 'archive', point: 'after', paragraph: 'keep'}],
    },
  ]);
  rmSync(dir, {recursive: true, force: true});
}

function proveAMissingOrEmptySddHooksLeavesNoSidebarHookBlock128(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const missing = cycle('1', 'implementing', {
    comments: [{body: 'sdd:focus\nPlan gap\n'}],
  });
  const empty = cycle('2', 'implementing', {
    comments: [{body: 'sdd:focus\nPlan gap\n'}],
    sddHooks: '',
  });
  const blank = cycle('3', 'implementing', {
    comments: [{body: 'sdd:focus\nPlan gap\n'}],
    sddHooks: {},
  });
  const noPoints = cycle('4', 'implementing', {
    comments: [{body: 'sdd:focus\nPlan gap\n'}],
    sddHooks: {archive: {}},
  });
  const list = cycle('5', 'implementing', {
    comments: [{body: 'sdd:focus\nPlan gap\n'}],
    sddHooks: [],
  });
  const spaces = cycle('6', 'implementing', {
    comments: [{body: 'sdd:focus\nPlan gap\n'}],
    sddHooks: {archive: {before: '   '}},
  });
  const window = openSide(home, [missing, empty, blank, noPoints, list, spaces]);
  for (const key of ['1', '2', '3', '4', '5', '6']) {
    window.openCard(key);
    const blocks = window.sidebar();
    assert.deepEqual(blocks, [{kind: 'focus', body: 'Plan gap\n'}]);
    assert.equal(kinds(blocks).includes('hook'), false);
  }
  rmSync(dir, {recursive: true, force: true});
}

function proveASingleStringSddHooksIsTheSidebarLine129(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const item = cycle('1', 'implementing', {sddHooks: 'not a map'});
  const window = openSide(home, [item]);
  window.openCard('1');
  const blocks = window.sidebar();
  assert.deepEqual(blocks, [{kind: 'hook', line: 'поле хука не читается'}]);
  assert.equal(JSON.stringify(blocks).includes('not a map'), false);
  assert.equal('points' in blocks[0], false);
  rmSync(dir, {recursive: true, force: true});
}

function proveOneNonStringSddHooksPointShowsThatLineInTheSidebarAndTheStringPointRemains130(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const mapped = cycle('1', 'implementing', {
    sddHooks: {
      archive: {before: 4},
      'create-proposal': {after: 'keep this'},
    },
  });
  const listed = cycle('2', 'implementing', {
    sddHooks: [
      {action: 'archive', point: 'before', value: 4},
      {action: 'create-proposal', point: 'after', value: 'keep this'},
    ],
  });
  const window = openSide(home, [mapped, listed]);
  const expected = {
    kind: 'hook',
    points: [
      {action: 'archive', point: 'before', paragraph: 'поле хука не читается'},
      {action: 'create-proposal', point: 'after', paragraph: 'keep this'},
    ],
  };
  window.openCard('1');
  assert.deepEqual(window.sidebar(), [expected]);
  window.openCard('2');
  assert.deepEqual(window.sidebar(), [expected]);
  rmSync(dir, {recursive: true, force: true});
}

function proveBothModelsEmpty135(): void {
  const {dir, home, arcadia} = yard();
  const billing = path.join(arcadia, 'services', 'billing');
  mkdirSync(billing, {recursive: true});
  writeServiceConfig(billing, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia});
  writeOverlay(billing, [], 'models:\n  mechanical: ""\n  judgment: ""\n');
  const assignees: string[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      answers: () => true,
      tickets: () => [
        ticket({key: '1', queue: 'alpha', sddService: 'services/billing', title: 'Bare'}),
      ],
      writeAssignee: key => {
        assignees.push(key);
      },
    },
  );
  window.chooseAgent('cursor');
  const row = window.board().rows.find(item => item.text.includes(billing));
  assert.ok(row);
  assert.equal(row.text.includes('нужны модели mechanical и judgment'), true);
  window.take('1');
  assert.deepEqual(assignees, []);
  rmSync(dir, {recursive: true, force: true});
}

function proveTheSameIdMayFillBothSlots136(): void {
  const {dir, home} = scratch();
  const window = openWindow({homePath: home}, {answers: () => true});
  window.chooseAgent('cursor');
  window.leaveModel('judgment', 'composer-2.5-fast');
  const doc = readHome(home);
  assert.equal(doc.models?.mechanical, 'composer-2.5-fast');
  assert.equal(doc.models?.judgment, 'composer-2.5-fast');
  rmSync(dir, {recursive: true, force: true});
}

function proveEachGroupNamesItsFile137(): void {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  window.openCard('1');
  window.openSettings();
  assert.equal(window.overlay().file, '.aifactory/config.yaml');
  assert.equal(window.serviceConfig().file, 'openspec/config.yaml');
  rmSync(dir, {recursive: true, force: true});
}

spec('board', () => {
  requirement('The board is a column of keys and seven stations', () => {
    scenario('An empty station stays the same width', () => {
      proveAnEmptySpecifyingColumnStaysAndTheWindowWritesNoPhase46();
    });
    scenario('The window adds no phase control', () => {
      proveAnEmptySpecifyingColumnStaysAndTheWindowWritesNoPhase46();
    });
  });
  requirement('A gate shares the column of the phase it closes', () => {
    scenario('Proposed stands in proposing', () => {
      proveProposedStandsInProposingAndSpecifiedStandsInSpecifying47();
    });
    scenario('Specified stands in specifying', () => {
      proveProposedStandsInProposingAndSpecifiedStandsInSpecifying47();
    });
  });
  requirement("A column shows this manager's cycles", () => {
    scenario('Another assignee is hidden', () => {
      proveAnotherAssigneeIsAbsentAndAPhaseWithNoAssigneeStandsInThePool48();
    });
    scenario('A phase without an assignee stands in the pool', () => {
      proveAnotherAssigneeIsAbsentAndAPhaseWithNoAssigneeStandsInThePool48();
    });
    scenario('Accepting shows the merge while the issue is open', () => {
      proveAnOpenMergeStandsInAcceptingAndAClosedIssueLeaves50();
    });
    scenario('Cancelled leaves the board', () => {
      proveSddCancelledWithAnEarlierPhaseShowsNoCard49();
    });
  });
  requirement('The pool holds cycles the manager can take', () => {
    scenario('A bare cycle label with no assignee is in the pool', () => {
      proveAnOpenWatchListTicketWithSddCycleNoPhaseAndNoAssigneeStandsInThePool67();
    });
    scenario('An issue without the cycle label is absent', () => {
      proveAnOpenTicketOnTheWatchListWithoutSddCycleIsNotInThePool68();
    });
    scenario("This manager's cycle enters proposing when a step can start", () => {
      proveAPhaselessTicketAssignedToThisLoginMovesToProposingAfterSpyWhenModelsAreSet70();
      proveOneOpenPullRequestLetsSpySetProposingForAnAssignedTicket74();
    });
    scenario("This manager's cycle stays when a step cannot start", () => {
      proveAPhaselessTicketAssignedToThisLoginStaysInThePoolWhenAModelSlotIsEmpty71();
    });
    scenario('Two pull requests keep an assigned cycle in the pool', () => {
      proveTwoOpenPullRequestsKeepAnAssignedTicketInThePoolAndSpyDoesNotSetProposing72();
    });
    scenario('A checkout break keeps an assigned cycle in the pool', () => {
      proveAMissingCheckoutKeepsAnAssignedTicketInThePoolAndSpyDoesNotSetProposing73();
    });
  });
  requirement('Take writes this process login', () => {
    scenario('Take on a phaseless cycle writes the login only', () => {
      proveTakeOnAPhaselessTicketSetsTheAssigneeAndSpyThenSetsProposing75();
    });
    scenario('Take does nothing without a home config', () => {
      proveTakeDoesNotCallWriteAssigneeWhenTheHomePathIsAbsent76();
    });
  });
  requirement('Take on a cycle that has a phase keeps the phase', () => {
    scenario('Take keeps the phase', () => {
      proveTakeOnAnImplementingPoolCycleSetsTheAssigneeAndLeavesThePhase77();
    });
    scenario('An empty model still allows Take on a phased cycle', () => {
      proveTakeOnAnImplementingPoolCycleWritesTheAssigneeWhenAModelSlotIsEmpty78();
    });
  });
  requirement('Two open pull requests block Take', () => {
    scenario('Two pull requests leave the card in the pool', () => {
      proveTwoOpenPullRequestsKeepTheCardInThePoolAndDoNotWriteTheAssignee79();
    });
    scenario('One pull request allows Take', () => {
      proveOneOpenPullRequestLetsTakeWriteTheAssignee80();
    });
  });
  requirement('A plaque shows the top and the bottom in order', () => {
    scenario('A focus gap is the top when there is no ask', () => {
      proveAFocusGapShowsSpecifyAndHidesASolidPlan56();
    });
    scenario('A solid focus adds no gap line', () => {
      proveEveryRecordedLayerSolidHasNoLayerLine57();
    });
  });
  requirement('The phase row is read from the cycle', () => {
    scenario('Proposing shows the open-question count', () => {
      proveProposingShowsTwoOpenQuestionsUnderTheHeading51();
    });
    scenario('Specifying has no phase row', () => {
      proveSpecifyingHasNoPhaseRow52();
    });
    scenario('Implementing without tasks.md has no count', () => {
      proveImplementingCountsTasksMdAndOmitsTheCountWhenTheFileIsAbsent54();
    });
    scenario('Verifying shows one check state', () => {
      proveVerifyingShowsRedAndNoneLeavesTheCheckRowBlank55();
    });
    scenario('None leaves the check row blank', () => {
      proveVerifyingShowsRedAndNoneLeavesTheCheckRowBlank55();
    });
  });
  requirement('Column order follows the icon occasion', () => {
    scenario('A hidden icon still sorts first', () => {
      proveARunningStepHidesTheIconWhileTheOccasionStillSortsFirst58();
    });
  });
  requirement('The icon is hidden while a step runs or checks are waited', () => {
    scenario('A gate shows the icon', () => {
      proveProposedStandsInProposingAndSpecifiedStandsInSpecifying47();
    });
    scenario('A running step hides the icon', () => {
      proveARunningStepHidesTheIconWhileTheOccasionStillSortsFirst58();
    });
  });
  requirement('The icon reason is one line', () => {
    scenario('A missing catalog outranks a missing service config', () => {
      proveAMissingCatalogOutranksAMissingServiceConfigInTheReason60();
    });
    scenario('The card hides a question-only reason', () => {
      proveAQuestionOnlyOccasionWhosePhaseRowShowsTheCountHasNoReasonLine61();
    });
    scenario('Children are keys from parent', () => {
      proveAChildRecordPutsAndThatKeyOnTheReason63();
    });
  });
  requirement('A healthy pool card shows Take', () => {
    scenario('A healthy pool card has no icon', () => {
      proveHealthyPoolCardsAreOrderedByKeyAndHaveNoIcon97();
    });
    scenario('A broken pool card disables Take', () => {
      proveAPoolTicketWithACheckoutBreakShowsTheIconAndTakeDoesNotWrite81();
    });
  });
  requirement('No home config leaves one row', () => {
    scenario('The board asks for an agent', () => {
      proveALaunchWithNoHomePathShowsOneRowThatTheFactoryStillNeedsAnAgent0();
      proveAMissingHomeFileShowsTheBoardAndDoesNotStartAStep1();
    });
  });
  requirement('A silent agent leaves one row', () => {
    scenario('A silent agent hides the empty-model row', () => {
      proveASilentAgentHidesTheEmptyModelRow17();
      proveASilentAgentDoesNotShowTheCheckoutEmptyModelRow94();
    });
  });
  requirement('An empty or rejected model names the checkout', () => {
    scenario('Both models empty', () => {
      proveBothModelsEmpty135();
    });
    scenario('A rejected id names the slot', () => {
      proveACatalogThatRejectsTheRecordedJudgmentIdKeepsItAndStopsTheStep95();
    });
    scenario('The factory row comes before the service-config row', () => {
      proveTheServiceConfigGroupHasNoFieldsWhenTheFileDoesNotParseAndOnlyThatCheckoutLosesItsCards106();
    });
  });
});

spec('factory-config', () => {
  requirement('The home config is the file the launch named', () => {
    scenario('No launch path writes no home file', () => {
      proveNoHomePathWritesNoFileWhenTheManagerChoosesAnAgent8();
    });
    scenario('The home file has no person field', () => {
      proveTheHomeFileGainsNoPersonPhaseFocusOrMetrics18();
    });
  });
  requirement('The service overlay replaces keys and does not replace roots', () => {
    scenario('An overlay model replaces the home model', () => {
      proveAnOverlayMechanicalModelReplacesTheHomeIdAndAMissingOverlayKeepsHome84();
    });
    scenario('A missing overlay keeps the home values', () => {
      proveAnOverlayMechanicalModelReplacesTheHomeIdAndAMissingOverlayKeepsHome84();
    });
    scenario('The machine without the window ignores the overlay', async () => {
      await proveTheMachineSpyLeavesABareCycleOutAndDoesNotReadAifactory45();
    });
  });
  requirement("The merged config is one agent and that agent's fields", () => {
    scenario('A running step keeps its model', () => {
      proveAStartedStepKeepsTheMechanicalIdFromThatCallUntilLeadingIsFalse96();
    });
    scenario('The same id may fill both slots', () => {
      proveTheSameIdMayFillBothSlots136();
    });
  });
  requirement('A known pair is written with the agent', () => {
    scenario('Cursor writes its pair', () => {
      proveChoosingCursorWritesItsPairAndOmitsEffortAndSpeed2();
    });
    scenario('Codex writes its pair', () => {
      proveChoosingCodexWritesItsPairAndEffortAndOmitsSpeed3();
    });
    scenario('Claude-code writes its pair', () => {
      proveChoosingClaudeCodeWritesItsPairAndEffortAndOmitsSpeed4();
    });
    scenario('OpenCode writes its pair', () => {
      proveChoosingOpencodeWritesItsPairAndOmitsEffortAndSpeed5();
    });
  });
  requirement('Changing the agent replaces the whole set', () => {
    scenario('Codex replaces a cursor set', () => {
      proveChangingTheAgentReplacesTheSetAndDropsOldEffortAndSpeed15();
    });
    scenario('OpenCode writes no effort key', () => {
      proveChangingTheOverlayAgentToOpencodeWritesThePairAndNoEffortOrSpeed85();
    });
  });
  requirement("Effort and speed are the agent's own fields", () => {
    scenario('Empty effort does not stop a step', () => {
      proveEmptyEffortAndSpeedAreTheAgentDefaultAndDoNotStopAStep12();
    });
    scenario('An empty model stops Take on a phaseless cycle', () => {
      proveAnEmptyMergedMechanicalModelNamesTheCheckoutAndStopsOnlyThatStep93();
    });
  });
  requirement('An overlay agent does not borrow effort or speed', () => {
    scenario('An overlay agent ignores home effort', () => {
      proveAnOverlayAgentOfCodexWithNoEffortKeyDoesNotTakeHomeEffortMax87();
      proveClearingOverlayEffortAndSpeedRemovesThoseKeys();
    });
    scenario('Clearing the overlay agent drops the set', () => {
      proveClearingTheOverlayAgentRemovesAgentModelsEffortAndSpeed88();
    });
    scenario('Clearing a model shows home', () => {
      proveClearingOverlayJudgmentWithNoOverlayAgentShowsTheHomeJudgmentId89();
    });
  });
  requirement('A recorded agent or model that fails is kept', () => {
    scenario('A silent agent leaves the file', () => {
      proveARecordedAgentThatDoesNotAnswerStaysInTheFile16();
    });
    scenario('A rejected id leaves the file', () => {
      proveACatalogThatRejectsTheRecordedJudgmentIdKeepsItAndStopsTheStep95();
    });
  });
});

spec('service-config', () => {
  requirement('The group writes the sdd fields', () => {
    scenario('A default base is omitted', () => {
      proveTheServiceConfigGroupOmitsADefaultBaseAndWritesMainBesideSchemaContextAndRules98();
    });
    scenario('A custom base is written', () => {
      proveTheServiceConfigGroupOmitsADefaultBaseAndWritesMainBesideSchemaContextAndRules98();
    });
    scenario('An unknown sdd key remains', () => {
      proveTheServiceConfigGroupKeepsAnUnknownSddKey99();
    });
  });
  requirement('Queues are an ordered list of names', () => {
    scenario("The first queue is the child's queue", () => {
      proveTheServiceConfigGroupSavesQueueOrderOmitsAnEmptyDescriptionAndChildQueueReturnsTheFirst100();
    });
    scenario('An empty description is omitted', () => {
      proveTheServiceConfigGroupSavesQueueOrderOmitsAnEmptyDescriptionAndChildQueueReturnsTheFirst100();
    });
    scenario('Duplicate names stay in order', () => {
      proveTheServiceConfigGroupSavesQueueOrderOmitsAnEmptyDescriptionAndChildQueueReturnsTheFirst100();
    });
  });
  requirement('Ignore-comments is an ordered list of strings', () => {
    scenario('An empty list removes the key', () => {
      proveTheServiceConfigGroupOmitsIgnoreCommentsWhenTheLastPatternIsRemoved101();
    });
  });
  requirement('An unreadable edit is not written', () => {
    scenario('A pattern that does not compile blocks save', () => {
      proveTheServiceConfigGroupWarnsWhenAnIgnoreCommentsPatternDoesNotCompile102();
    });
    scenario('An empty queue name blocks save', () => {
      proveTheServiceConfigGroupWarnsOnAnEmptyQueueNameAndOnTheLastQueue103();
    });
    scenario('The last queue cannot be removed into an empty list', () => {
      proveTheServiceConfigGroupWarnsOnAnEmptyQueueNameAndOnTheLastQueue103();
    });
    scenario('YAML without sdd warns', () => {
      proveTheServiceConfigGroupWarnsWhenYAMLHasNoSddKey104();
    });
  });
  requirement('A non-string ignore-comments value can only be removed', () => {
    scenario('Removing a number drops the key', () => {
      proveTheServiceConfigGroupCanOnlyRemoveANonStringIgnoreCommentsValue105();
    });
    scenario('Closing keeps the number', () => {
      proveTheServiceConfigGroupCanOnlyRemoveANonStringIgnoreCommentsValue105();
    });
  });
  requirement('A service config that does not parse hides that checkout', () => {
    scenario('One broken file hides only its cards', () => {
      proveTheServiceConfigGroupHasNoFieldsWhenTheFileDoesNotParseAndOnlyThatCheckoutLosesItsCards106();
    });
    scenario('The group does not rewrite a file that does not parse', () => {
      proveTheServiceConfigGroupHasNoFieldsWhenTheFileDoesNotParseAndOnlyThatCheckoutLosesItsCards106();
    });
  });
  requirement('A missing service config keeps the card', () => {
    scenario('A missing file leaves the card', () => {
      proveTheServiceConfigGroupCreatesAMissingFileFromTheQueueTheManagerAdds108();
    });
    scenario('Save creates the file', () => {
      proveTheServiceConfigGroupCreatesAMissingFileFromTheQueueTheManagerAdds108();
    });
  });
});

spec('settings', () => {
  requirement('Settings are two blocks and do not open themselves', () => {
    scenario('A missing home file leaves settings closed', () => {
      proveAMissingHomeFileLeavesSettingsClosedUntilTheManagerOpensThem66();
    });
    scenario('Each group names its file', () => {
      proveEachGroupNamesItsFile137();
    });
  });
  requirement("Service groups write the open card's checkout", () => {
    scenario('One checkout is selected', () => {
      proveOneGatheredCheckoutIsSelectedWhenSettingsOpenWithNoCard91();
    });
    scenario('No choice writes nothing', () => {
      proveSeveralGatheredCheckoutsWriteNothingUntilChooseCheckout92();
    });
  });
  requirement('A write rereads the file first', () => {
    scenario('A newer home file blocks the user block', () => {
      proveANewerHomeFileBlocksTheWriteAndTheWindowShowsTheDisk13();
    });
    scenario('A newer service config blocks the save', () => {
      proveTheServiceConfigGroupShowsTheDiskCopyWhenTheFileChangedBeforeSave111();
    });
  });
  requirement('The overlay group writes immediately', () => {
    scenario('An overlay edit is on disk before settings close', () => {
      proveAnOverlayEditIsOnDiskAfterSettingsClose86();
    });
  });
  requirement('The service-config group writes on save', () => {
    scenario('Closing discards an unsaved edit', () => {
      proveTheServiceConfigGroupDiscardsAnUnsavedQueueEditAndTheSpyReadsTheDiskQueues110();
    });
    scenario('The spy reads the previous file', () => {
      proveTheServiceConfigGroupDiscardsAnUnsavedQueueEditAndTheSpyReadsTheDiskQueues110();
    });
  });
  requirement('Choosing an agent writes at once', () => {
    scenario('Choosing cursor writes the home file', () => {
      proveChoosingCursorWritesItsPairAndOmitsEffortAndSpeed2();
    });
    scenario('An empty agent list writes nothing', () => {
      proveAnEmptyAgentListWritesNoHomeFile9();
    });
    scenario('Leaving a model empty writes the empty field', () => {
      proveLeavingAModelEmptyWritesThatField10();
    });
  });
});

spec('sidebar', () => {
  requirement('The open row shows only the blocks the cycle has', () => {
    scenario('A cycle with only focus shows focus', () => {
      proveAnOpenCycleWhoseOnlySidebarBlockIsFocusShowsThatBlock113();
    });
    scenario('Change bodies stay out', () => {
      proveAnOpenCycleWhoseOnlySidebarBlockIsFocusShowsThatBlock113();
    });
  });
  requirement("The icon reason block is the card's line", () => {
    scenario('The open row shows the hidden tail', () => {
      proveAQuestionOnlyCardHidesTheLineAndTheSidebarStillShowsIt116();
    });
    scenario('No icon means no reason block', () => {
      proveASpecifyingCycleWithNoOccasionHasNoReasonBlock();
    });
  });
  requirement('Ask shows the latest comment that is not focus', () => {
    scenario('Wait shows the ask', () => {
      proveACardWithNoIconHasNoSidebarReasonBlock115();
    });
    scenario('A focus comment is skipped', () => {
      proveTheSidebarAskIsTheLatestCommentThatDoesNotStartWithSddFocus118();
    });
    scenario('Clearing the label removes the ask', () => {
      proveRemovingSddWaitHumanRemovesTheSidebarAskWhileTheCommentsRemain119();
    });
  });
  requirement('Focus shows the body after the marker line', () => {
    scenario('The plaque drops the marker line', () => {
      proveTheSidebarFocusPlaqueDoesNotIncludeTheMarkerLine121();
    });
    scenario('No focus comment leaves no block', () => {
      proveNoSddFocusCommentLeavesNoSidebarFocusBlock120();
    });
  });
  requirement('Unanswered review shows threads the port already gives', () => {
    scenario('An unmarked thread is shown', () => {
      proveAThreadWithNoMarkerIsInTheSidebarUnansweredBlock122();
    });
    scenario('A marked thread is omitted', () => {
      proveEveryMarkedThreadAndAMarkedLastCommentLeaveNoSidebarUnansweredBlock123();
    });
  });
  requirement('The hook block shows sddHooks in field order', () => {
    scenario('Points stay in field order', () => {
      proveSddHooksListsArchiveBeforeThenCreateProposalAfterInTheSidebar126();
      proveANestedSddHooksMapKeepsFieldOrderInTheSidebar127();
      proveASpacePointDropsFromTheSidebarAndTheOtherPointRemains();
    });
    scenario('An empty field leaves no block', () => {
      proveAMissingOrEmptySddHooksLeavesNoSidebarHookBlock128();
    });
    scenario('A non-map is one error line', () => {
      proveASingleStringSddHooksIsTheSidebarLine129();
    });
    scenario('A non-string point keeps the others', () => {
      proveOneNonStringSddHooksPointShowsThatLineInTheSidebarAndTheStringPointRemains130();
    });
  });
});

spec('watch-list', () => {
  requirement("The board and the window's spy read one watch list", () => {
    scenario('The pool and the columns share the list', () => {
      proveTheBoardAndTheWindowSpyReadOneWatchList44();
    });
    scenario("The machine's spy ignores a bare cycle label", async () => {
      await proveTheMachineSpyLeavesABareCycleOutAndDoesNotReadAifactory45();
    });
  });
  requirement('Each read rebuilds the list from the files', () => {
    scenario('An overlay name joins the home list', () => {
      proveAnOverlayWatchNameJoinsTheHomeListAndARepeatedNameIsOne26();
    });
    scenario('A name on either file remains', () => {
      proveANameRemovedFromOneFileStaysWhileTheOtherFileStillHasIt27();
    });
    scenario('Both lists empty means no cards', () => {
      proveEmptyWatchListsLeaveTheBoardWithNoCards30();
    });
    scenario('Service queues do not join the list', () => {
      proveServiceQueuesDoNotJoinTheWatchList31();
    });
  });
  requirement('A Tracker queue is the port field', () => {
    scenario('The port field selects the cycle', () => {
      proveATrackerTicketIsSelectedByThePortQueueAndALabelDoesNotReplaceIt32();
    });
    scenario('A queue missing from the service config blocks Take', () => {
      proveTheFirstCheckoutBreakIsTheOnlyReasonAndTakeDoesNotWriteTheAssignee35();
    });
  });
  requirement('A GitHub queue is a label in sdd.queues', () => {
    scenario('The first matching queue name wins', () => {
      proveAGithubQueueIsTheFirstSddQueuesNameOnTheIssueAndTheKeyIsOwnerRepo33();
    });
    scenario('No matching label is a break', () => {
      proveAGithubQueueIsTheFirstSddQueuesNameOnTheIssueAndTheKeyIsOwnerRepo33();
    });
  });
  requirement('A checkout is gathered from sddService', () => {
    scenario('Tracker gathers under the Arcadia root', () => {
      proveTrackerGathersTheCheckoutUnderTheArcadiaRoot23();
    });
    scenario('An empty root keeps the default', () => {
      proveAnEmptyRootLeavesArcadiaOrGithub21();
    });
    scenario('GitHub empty sddService is the repository root', () => {
      proveGithubGathersUnderTheRepositoryAndAnEmptySddServiceIsThatRoot24();
    });
    scenario('A path outside the root is a missing catalog', () => {
      proveAPathWithOrOutsideTheRootIsAMissingCatalog25();
    });
  });
  requirement('A missing field offers a choice', () => {
    scenario('One Tracker service writes itself', () => {
      proveOneTrackerServiceThatAlreadyListsTheQueueWritesItself37();
      proveABlankTrackerSddServiceWritesTheSingleServiceThatListsTheQueue38();
    });
    scenario('Several Tracker services stay a choice', () => {
      proveSeveralTrackerServicesThatListTheQueueStayAChoice39();
    });
    scenario('One GitHub directory writes itself', () => {
      proveOneGithubDirectoryWithAnSddKeyWritesItselfAndSeveralStayAChoice40();
    });
    scenario('A queue that is still missing keeps the reason', () => {
      proveWritingSddServiceKeepsTheQueueBreakWhenTheServiceStillLacksTheQueue41();
    });
  });
  requirement('A missing catalog keeps the cycle card', () => {
    scenario('A missing directory leaves the card', () => {
      proveAMissingCatalogKeepsTheCardAndTheChoiceAndDoesNotStartAStep36();
    });
  });
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
  assert.equal(card.reason, 'несколько pull request');
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
  assert.equal(card.reason, 'каталога нет');
  assert.equal(card.takeDisabled, true);
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

function openHookGroup(body: string, over: Partial<WindowTicket> = {}) {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  const file = writeServiceYaml(checkout, body);
  writeLaunch(home, ['alpha'], {arcadia});
  const item = cycle('1', 'implementing', over);
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {login: () => MANAGER, tickets: () => [item]},
  );
  window.openCard('1');
  return {dir, file, window, item};
}

const queues = ['sdd:', '  queues:', '    - name: alpha', ''].join('\n');

function proveABlankStringDoesNotCreateAPoint(): void {
  const {dir, file, window} = openHookGroup(queues);
  const choices = window.serviceConfig().hookChoices ?? [];
  assert.deepEqual([...new Set(choices.map(item => item.action))], Object.keys(ACTION_SKILL));
  assert.deepEqual(
    choices.filter(item => item.action === 'archive').map(item => item.point),
    ['before', 'after'],
  );
  window.chooseServiceHook('archive', 'before', '');
  window.chooseServiceHook('archive', 'before', '   ');
  window.chooseServiceHook('custom', 'before', 'no');
  window.chooseServiceHook('archive', 'during', 'no');
  window.saveServiceConfig();
  assert.equal(readServiceYaml(file).sdd?.hooks, undefined);
  assert.equal(
    window
      .serviceConfig()
      .hookChoices?.some(item => item.action === 'archive' && item.point === 'before'),
    true,
  );
  rmSync(dir, {recursive: true, force: true});
}

function proveTheLastStringRemovesThePoint(): void {
  const {dir, file, window} = openHookGroup(
    [
      'sdd:',
      '  queues:',
      '    - name: alpha',
      '  hooks:',
      '    archive:',
      '      before:',
      '        - only',
      '      after:',
      '        - stay',
      '',
    ].join('\n'),
  );
  assert.equal(
    window.serviceConfig().hookChoices?.some(item => item.action === 'archive'),
    false,
  );
  window.setServiceHook('archive', 'before', []);
  window.saveServiceConfig();
  const hooks = readServiceYaml(file).sdd?.hooks;
  assert.equal(hooks?.archive?.before, undefined);
  assert.deepEqual(hooks?.archive?.after, ['stay']);
  rmSync(dir, {recursive: true, force: true});
}

function proveASingleStringIsWrittenBackAsAList(): void {
  const {dir, file, window} = openHookGroup(
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
}

function proveTheWindowDoesNotWriteTheField(): void {
  const {dir, window, item} = openHookGroup(queues, {
    sddHooks: {archive: {before: 'keep the cycle'}},
  });
  window.chooseServiceHook('archive', 'before', 'service line');
  window.saveServiceConfig();
  assert.deepEqual(item.sddHooks, {archive: {before: 'keep the cycle'}});
  assert.deepEqual(window.sidebar(), [
    {
      kind: 'hook',
      points: [{action: 'archive', point: 'before', paragraph: 'keep the cycle'}],
    },
  ]);
  rmSync(dir, {recursive: true, force: true});
}

test('a free point is written as a list and a later string skips the choice', () => {
  const {dir, file, window} = openHookGroup(queues);
  window.chooseServiceHook('archive', 'before', 'first\nstill');
  window.saveServiceConfig();
  assert.deepEqual(readServiceYaml(file).sdd?.hooks?.archive?.before, ['first\nstill']);
  assert.equal(
    window
      .serviceConfig()
      .hookChoices?.some(item => item.action === 'archive' && item.point === 'before'),
    false,
  );
  window.setServiceHook('archive', 'before', ['first\nstill', 'second']);
  window.chooseServiceHook('archive', 'before', 'not through the choice');
  window.saveServiceConfig();
  assert.deepEqual(readServiceYaml(file).sdd?.hooks?.archive?.before, ['first\nstill', 'second']);
  rmSync(dir, {recursive: true, force: true});
});

test('an action leaves the free list when both points are taken', () => {
  const {dir, file, window} = openHookGroup(
    [
      'sdd:',
      '  queues:',
      '    - name: alpha',
      '  hooks:',
      '    archive:',
      '      before:',
      '        - kept',
      '',
    ].join('\n'),
  );
  assert.deepEqual(
    window
      .serviceConfig()
      .hookChoices?.filter(item => item.action === 'archive')
      .map(item => item.point),
    ['after'],
  );
  window.chooseServiceHook('archive', 'after', 'tail');
  assert.equal(
    window.serviceConfig().hookChoices?.some(item => item.action === 'archive'),
    false,
  );
  assert.equal(
    window.serviceConfig().hookChoices?.some(item => item.action === 'create-proposal'),
    true,
  );
  window.saveServiceConfig();
  const hooks = readServiceYaml(file).sdd?.hooks;
  assert.deepEqual(hooks?.archive?.before, ['kept']);
  assert.deepEqual(hooks?.archive?.after, ['tail']);
  rmSync(dir, {recursive: true, force: true});
});

test('an unknown point is edited and is not offered', () => {
  const {dir, file, window} = openHookGroup(
    [
      'sdd:',
      '  queues:',
      '    - name: alpha',
      '  hooks:',
      '    custom:',
      '      during:',
      '        - old',
      '      before: 4',
      '',
    ].join('\n'),
  );
  assert.deepEqual(window.serviceConfig().hooks, [
    {action: 'custom', point: 'during', values: ['old']},
  ]);
  assert.equal(
    window
      .serviceConfig()
      .hookChoices?.some(item => item.action === 'custom' || item.point === 'during'),
    false,
  );
  window.setServiceHook('custom', 'during', ['new']);
  window.chooseServiceHook('custom', 'before', 'no');
  window.setServiceHook('custom', 'before', ['no']);
  window.saveServiceConfig();
  const hooks = readServiceYaml(file).sdd?.hooks;
  assert.deepEqual(hooks?.custom?.during, ['new']);
  assert.equal(hooks?.custom?.before, 4);
  rmSync(dir, {recursive: true, force: true});
});

test('an empty key stays out of the free list and a new string skips the choice', () => {
  for (const stored of ['[]', '""', '"   "']) {
    const {dir, file, window} = openHookGroup(
      [
        'sdd:',
        '  queues:',
        '    - name: alpha',
        '  hooks:',
        '    archive:',
        `      before: ${stored}`,
        '',
      ].join('\n'),
    );
    assert.deepEqual(window.serviceConfig().hooks, [
      {action: 'archive', point: 'before', values: []},
    ]);
    assert.equal(
      window
        .serviceConfig()
        .hookChoices?.some(item => item.action === 'archive' && item.point === 'before'),
      false,
    );
    window.chooseServiceHook('archive', 'before', 'through the choice');
    assert.deepEqual(window.serviceConfig().hooks, [
      {action: 'archive', point: 'before', values: []},
    ]);
    window.setServiceHook('archive', 'before', ['added']);
    window.saveServiceConfig();
    assert.deepEqual(readServiceYaml(file).sdd?.hooks?.archive?.before, ['added']);
    rmSync(dir, {recursive: true, force: true});
  }
});

test('spaces stay out of a hook list and the manager can reorder it', () => {
  const {dir, file, window} = openHookGroup(
    [
      'sdd:',
      '  queues:',
      '    - name: alpha',
      '  hooks:',
      '    archive:',
      '      before:',
      '        - one',
      '        - two',
      '',
    ].join('\n'),
  );
  window.setServiceHook('archive', 'before', ['two', '   ', '', 'one']);
  window.saveServiceConfig();
  assert.deepEqual(readServiceYaml(file).sdd?.hooks?.archive?.before, ['two', 'one']);
  rmSync(dir, {recursive: true, force: true});
});

test('sidebar() with no open card has no blocks', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openSide(home, [
    cycle('1', 'implementing', {comments: [{body: 'sdd:focus\nPlan gap\n'}]}),
  ]);
  assert.deepEqual(window.sidebar(), []);
  rmSync(dir, {recursive: true, force: true});
});

test('the sidebar reason is the card full line', () => {
  const {dir, home, arcadia} = yard();
  const checkout = prepare(arcadia, home);
  writeChange(checkout, 'p', 'proposal.md', '## Open questions\n\n- [ ] one\n');
  const window = openSide(home, [
    cycle('p', 'proposed', {
      labels: ['sdd:cycle', 'sdd:proposed', 'sdd:wait-human'],
      open: true,
      mergeAhead: true,
      dependsOn: ['a'],
    }),
    ticket({key: 'c-1', parent: 'p', queue: 'other', labels: ['sdd:cycle']}),
    ticket({key: 'a', queue: 'other', labels: ['note']}),
  ]);
  const card = columnCards(window.board(), 'accepting')?.find(item => item.key === 'p');
  const line = 'proposed · Ask · вопросы 1 · мерж · дети c-1 · блокеры a';
  assert.equal(card?.reason, line);
  window.openCard('p');
  assert.deepEqual(window.sidebar()[0], {kind: 'reason', line});
  rmSync(dir, {recursive: true, force: true});
});

test('a decision-only card hides the line and the sidebar still shows it', () => {
  const {dir, home, arcadia} = yard();
  const checkout = prepare(arcadia, home);
  writeChange(checkout, '1', 'design.md', '## Open decisions\n\n- [ ] one\n');
  const window = openSide(home, [cycle('1', 'designing')]);
  const card = columnCards(window.board(), 'designing')?.[0];
  assert.equal(card?.phaseRow, 1);
  assert.equal(card?.icon, true);
  assert.equal(card?.reason, undefined);
  window.openCard('1');
  assert.deepEqual(window.sidebar(), [{kind: 'reason', line: 'решения 1'}]);
  rmSync(dir, {recursive: true, force: true});
});

test('a conversation last comment with no marker is in the sidebar unanswered block', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openSide(home, [cycle('1', 'implementing')], {
    review: () => ({
      threads: [{marker: 'code', lines: ['kept out']}],
      conversation: {last: {body: 'please reply'}},
    }),
  });
  window.openCard('1');
  const blocks = window.sidebar();
  assert.deepEqual(blocks, [{kind: 'unanswered', comment: 'please reply'}]);
  assert.equal(JSON.stringify(blocks).includes('kept out'), false);
  rmSync(dir, {recursive: true, force: true});
});

test('the review port returning nothing leaves no sidebar unanswered block', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const silent = openSide(home, [cycle('1', 'implementing')], {review: () => undefined});
  silent.openCard('1');
  assert.deepEqual(silent.sidebar(), []);
  const absent = openSide(home, [cycle('1', 'implementing')]);
  absent.openCard('1');
  assert.deepEqual(absent.sidebar(), []);
  rmSync(dir, {recursive: true, force: true});
});

test('an action point other than before or after keeps its place in the sidebar', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const item = cycle('1', 'implementing', {
    sddHooks: [
      {action: 'other', point: 'during', value: 'stay'},
      {action: 'archive', point: 'before', value: 'one'},
    ],
  });
  const window = openSide(home, [item]);
  window.openCard('1');
  assert.deepEqual(window.sidebar(), [
    {
      kind: 'hook',
      points: [
        {action: 'other', point: 'during', paragraph: 'stay'},
        {action: 'archive', point: 'before', paragraph: 'one'},
      ],
    },
  ]);
  rmSync(dir, {recursive: true, force: true});
});

test('the sidebar shows sddHooks after the field changes', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const item = cycle('1', 'implementing');
  item.sddHooks = [{action: 'archive', point: 'before', value: 'first'}];
  let writes = 0;
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => [item],
      writeAssignee: () => {
        writes += 1;
      },
    },
  );
  window.openCard('1');
  assert.deepEqual(window.sidebar(), [
    {kind: 'hook', points: [{action: 'archive', point: 'before', paragraph: 'first'}]},
  ]);
  item.sddHooks = [{action: 'archive', point: 'before', value: 'second\nline'}];
  assert.deepEqual(window.sidebar(), [
    {kind: 'hook', points: [{action: 'archive', point: 'before', paragraph: 'second\nline'}]},
  ]);
  assert.equal(writes, 0);
  rmSync(dir, {recursive: true, force: true});
});

test('opening a pool card and opening a column card both use sidebar() the same way', () => {
  const {dir, home, arcadia} = yard();
  const checkout = prepare(arcadia, home);
  const body = 'sdd:focus\nPlan gap\nwhy\n';
  const window = openSide(home, [
    cycle('1', 'implementing', {assignee: '', comments: [{body}]}),
    cycle('2', 'implementing', {comments: [{body}]}),
  ]);
  const board = window.board();
  assert.equal(
    board.pool.some(card => card.key === '1'),
    true,
  );
  assert.equal(
    columnCards(board, 'implementing')?.some(card => card.key === '2'),
    true,
  );
  window.openCard('1');
  assert.equal(window.overlay().checkout, checkout);
  const fromPool = window.sidebar();
  window.openCard('2');
  assert.equal(window.overlay().checkout, checkout);
  const fromColumn = window.sidebar();
  assert.deepEqual(fromPool, [{kind: 'focus', body: 'Plan gap\nwhy\n'}]);
  assert.deepEqual(fromColumn, fromPool);
  rmSync(dir, {recursive: true, force: true});
});

async function proveAReviewPlaceOpensThePortUrl(): Promise<void> {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const body = ['sdd:focus', 'Change solid', 'Code src/a.ts:4', 'the check failed', ''].join('\n');
  let asked: {file: string; line: number} | undefined;
  let calls = 0;
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => [
        cycle('1', 'implementing', {
          comments: [{body}],
        }),
      ],
      reviewPlace: place => {
        calls += 1;
        asked = place;
        return 'https://arcanum.example/review/42';
      },
    },
  );
  window.openCard('1');
  const card = columnCards(window.board(), 'implementing')?.[0];
  assert.equal(card?.layers, 'Code');
  assert.equal(JSON.stringify(card).includes('src/a.ts'), false);
  assert.equal(JSON.stringify(card).includes('the check failed'), false);
  assert.equal(window.openReviewPlace('src/a.ts', 4), 'https://arcanum.example/review/42');
  assert.deepEqual(asked, {file: 'src/a.ts', line: 4});
  assert.equal(window.openReviewPlace('src/b.ts', 4), undefined);
  assert.equal(calls, 1);
  const plaque = window.sidebar().find(block => block.kind === 'focus');
  assert.deepEqual(plaque, {
    kind: 'focus',
    body: 'Change solid\nCode src/a.ts:4\nthe check failed\n',
  });
  rmSync(dir, {recursive: true, force: true});
}

test('the sidebar lists the blocks that exist from reason through hook', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const item = cycle('1', 'proposed', {
    labels: ['sdd:cycle', 'sdd:proposed', 'sdd:wait-human'],
    comments: [{body: 'please decide'}, {body: 'sdd:focus\nPlan gap\n'}],
    sddHooks: [{action: 'archive', point: 'before', value: 'keep'}],
  });
  const window = openSide(home, [item], {
    review: () => ({
      threads: [{marker: null, lines: ['please look']}],
      conversation: {last: {marker: 'note', body: 'answered'}},
    }),
  });
  window.openCard('1');
  assert.deepEqual(window.sidebar(), [
    {kind: 'reason', line: 'proposed · Ask'},
    {kind: 'ask', body: 'please decide'},
    {kind: 'focus', body: 'Plan gap\n'},
    {kind: 'unanswered', threads: [{lines: ['please look']}]},
    {kind: 'hook', points: [{action: 'archive', point: 'before', paragraph: 'keep'}]},
  ]);
  rmSync(dir, {recursive: true, force: true});
});

spec('focus', () => {
  requirement('The window shows the body after the marker line', () => {
    scenario('A manager comment is not the plaque', () => {
      proveTheSidebarFocusPlaqueDoesNotIncludeTheMarkerLine121();
    });
  });
  requirement('A gap is one pointer and a why line', () => {
    scenario('A review place opens the port URL', async () => {
      await proveAReviewPlaceOpensThePortUrl();
    });
  });
});

spec('hook', () => {
  requirement('A service hook is a list of strings at sdd.hooks', () => {
    scenario('A blank string does not create a point', () => {
      proveABlankStringDoesNotCreateAPoint();
    });
    scenario('The last string removes the point', () => {
      proveTheLastStringRemovesThePoint();
    });
    scenario('A single string is written back as a list', () => {
      proveASingleStringIsWrittenBackAsAList();
    });
    scenario('A non-string hook value is left in place', () => {
      proveASingleStringIsWrittenBackAsAList();
    });
  });
  requirement('The cycle keeps one sddHooks map', () => {
    scenario('The window does not write the field', () => {
      proveTheWindowDoesNotWriteTheField();
    });
  });
});

function proveTheShelfShowsTheOutcomeBeforeTheDrag(): void {
  const {dir, home, arcadia} = yard();
  const other = scratch();
  prepare(arcadia, home);
  writeFileSync(
    home,
    [
      'watch:',
      '  - alpha',
      'roots:',
      `  arcadia: ${arcadia}`,
      'roles:',
      '  - name: Page',
      '    outcome: html',
      '    text: <p>hello</p>',
      '',
    ].join('\n'),
  );
  writeFileSync(
    other.home,
    ['roles:', '  - name: Note', '    outcome: pull-comment', '    text: hi', ''].join('\n'),
  );
  const window = openWindow({homePath: home, adapter: 'tracker'});
  const theirs = openWindow({homePath: other.home});
  assert.deepEqual(window.shelf(), [{name: 'Page', outcome: 'html'}]);
  assert.deepEqual(theirs.shelf(), [{name: 'Note', outcome: 'pull-comment'}]);
  const service = readServiceYaml(
    path.join(arcadia, 'services', 'billing', 'openspec', 'config.yaml'),
  );
  assert.equal('roles' in service, false);
  rmSync(dir, {recursive: true, force: true});
  rmSync(other.dir, {recursive: true, force: true});
}

type HomeRole = {name?: string; outcome?: string; text?: string; labels?: string[]};

function homeRoles(file: string): HomeRole[] {
  const roles = readHome(file).roles;
  return Array.isArray(roles) ? (roles as HomeRole[]) : [];
}

function proveRemovingARoleWritesTheHomeConfig(): void {
  const {dir, home} = scratch();
  writeFileSync(
    home,
    [
      'watch:',
      '  - alpha',
      'roles:',
      '  - name: Page',
      '    outcome: html',
      '    text: <p>hi</p>',
      '  - name: Note',
      '    outcome: pull-comment',
      '    text: hi',
      '',
    ].join('\n'),
  );
  const window = openWindow({homePath: home});
  window.removeRole('Page');
  assert.deepEqual(
    homeRoles(home).map(role => role.name),
    ['Note'],
  );
  assert.deepEqual(readHome(home).watch, ['alpha']);
  assert.deepEqual(window.shelf(), [{name: 'Note', outcome: 'pull-comment'}]);
  rmSync(dir, {recursive: true, force: true});
}

function proveTicketFieldsStoresTheLabels(): void {
  const {dir, home} = scratch();
  writeFileSync(home, 'watch:\n  - alpha\n');
  const window = openWindow({homePath: home});
  window.addRole({
    name: 'Plan',
    outcome: 'ticket-fields',
    text: 'note',
    labels: ['sdd:auto-plan', 'sdd:auto-merge'],
  });
  const [role] = homeRoles(home);
  assert.equal(role?.outcome, 'ticket-fields');
  assert.ok(role?.labels?.includes('sdd:auto-plan'));
  assert.equal(role?.labels?.includes('sdd:auto-merge'), false);
  rmSync(dir, {recursive: true, force: true});
}

function proveTheUserBlockEditsARoleImmediately(): void {
  const {dir, home} = scratch();
  writeFileSync(home, 'watch:\n  - alpha\n');
  const window = openWindow({homePath: home});
  assert.equal(window.settings().open, false);
  window.addRole({name: 'Page', outcome: 'html', text: 'one'});
  assert.equal(homeRoles(home)[0]?.name, 'Page');
  window.renameRole('Page', 'Sheet');
  assert.equal(homeRoles(home)[0]?.name, 'Sheet');
  window.chooseRoleOutcome('Sheet', 'ticket-fields');
  assert.equal(homeRoles(home)[0]?.outcome, 'ticket-fields');
  window.setRoleText('Sheet', 'archive:\n  before: keep\n');
  assert.equal(homeRoles(home)[0]?.text, 'archive:\n  before: keep\n');
  window.setRoleLabels('Sheet', ['sdd:auto-spec', 'sdd:auto-merge']);
  assert.deepEqual(homeRoles(home)[0]?.labels, ['sdd:auto-spec']);
  assert.deepEqual(readHome(home).watch, ['alpha']);
  assert.equal(window.settings().open, false);
  rmSync(dir, {recursive: true, force: true});
}

function proveADragDoesNotMoveThePhase(): void {
  const {dir, home, arcadia} = yard();
  const checkout = prepare(arcadia, home);
  const config = path.join(checkout, 'openspec', 'config.yaml');
  const before = readFileSync(config, 'utf8');
  const item = cycle('1', 'implementing');
  let phases = 0;
  let assignees = 0;
  let started = 0;
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => [item],
      writePhase: () => {
        phases += 1;
      },
      writeAssignee: () => {
        assignees += 1;
      },
      startStep: () => {
        started += 1;
      },
    },
  );
  window.addRole({name: 'Page', outcome: 'html', text: '<p>stay</p>'});
  assert.deepEqual(window.drag('Page', '1'), {popup: '<p>stay</p>'});
  assert.deepEqual(item.labels, ['sdd:cycle', 'sdd:implementing']);
  assert.equal(item.assignee, MANAGER);
  assert.equal(phases, 0);
  assert.equal(assignees, 0);
  assert.equal(started, 0);
  assert.equal(readFileSync(config, 'utf8'), before);
  assert.equal('role' in item, false);
  assert.equal(columnCards(window.board(), 'implementing')?.[0]?.key, '1');
  rmSync(dir, {recursive: true, force: true});
}

function proveAnEmptyModelStillRunsTheRole(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const item = ticket({
    key: '1',
    queue: 'alpha',
    sddService: 'services/billing',
    assignee: '',
    labels: ['sdd:cycle'],
  });
  let started = 0;
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      answers: () => false,
      startStep: () => {
        started += 1;
      },
      tickets: () => [item],
    },
  );
  window.chooseAgent('cursor');
  window.leaveModel('judgment', '');
  window.addRole({name: 'Page', outcome: 'html', text: 'shown'});
  const card = window.board().pool.find(entry => entry.key === '1');
  assert.ok(card);
  assert.equal(card.takeDisabled, true);
  assert.equal(window.board().stepsStart, false);
  assert.deepEqual(window.drag('Page', '1'), {popup: 'shown'});
  assert.equal(started, 0);
  assert.equal(item.assignee, '');
  rmSync(dir, {recursive: true, force: true});
}

function proveTheSpyDoesNotStartARole(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const item = cycle('1', 'implementing');
  let labels = 0;
  let hooks = 0;
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      answers: () => true,
      tickets: () => [item],
      editLabels: () => {
        labels += 1;
      },
      writeHooks: () => {
        hooks += 1;
      },
    },
  );
  window.chooseAgent('cursor');
  window.addRole({
    name: 'Spec',
    outcome: 'ticket-fields',
    text: 'just a note',
    labels: ['sdd:auto-spec'],
  });
  window.drag('Spec', '1');
  assert.equal(labels, 1);
  assert.equal(hooks, 0);
  window.spy();
  assert.equal(labels, 1);
  assert.equal(hooks, 0);
  rmSync(dir, {recursive: true, force: true});
}

function proveNamedLabelsAreSet(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const item = cycle('1', 'implementing');
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => [item],
      editLabels: (_key, add) => {
        item.labels = [...item.labels, ...add];
      },
    },
  );
  window.addRole({
    name: 'Spec',
    outcome: 'ticket-fields',
    text: 'just a note',
    labels: ['sdd:auto-spec', 'sdd:auto-merge'],
  });
  window.drag('Spec', '1');
  assert.ok(item.labels.includes('sdd:auto-spec'));
  assert.equal(item.labels.includes('sdd:auto-merge'), false);
  assert.ok(item.labels.includes('sdd:implementing'));
  assert.equal(item.assignee, MANAGER);
  rmSync(dir, {recursive: true, force: true});
}

function proveAPointMapReplacesSddHooks(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const text = 'archive:\n  before: keep the cycle\n';
  const item = cycle('1', 'implementing', {sddHooks: {'create-proposal': {after: 'old'}}});
  let written = '';
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => [item],
      writeHooks: (_key, next) => {
        written = next;
        item.sddHooks = parse(next);
      },
    },
  );
  window.addRole({name: 'Hooks', outcome: 'ticket-fields', text, labels: ['sdd:auto-plan']});
  window.openCard('1');
  window.drag('Hooks', '1');
  assert.equal(written, text);
  assert.deepEqual(window.sidebar(), [
    {kind: 'hook', points: [{action: 'archive', point: 'before', paragraph: 'keep the cycle'}]},
  ]);
  rmSync(dir, {recursive: true, force: true});
}

function proveProseLeavesSddHooks(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const item = cycle('1', 'implementing', {sddHooks: {archive: {before: 'old'}}});
  let hooks = 0;
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => [item],
      editLabels: (_key, add) => {
        item.labels = [...item.labels, ...add];
      },
      writeHooks: () => {
        hooks += 1;
      },
    },
  );
  window.addRole({
    name: 'Spec',
    outcome: 'ticket-fields',
    text: 'just a note',
    labels: ['sdd:auto-spec'],
  });
  window.openCard('1');
  window.drag('Spec', '1');
  assert.equal(hooks, 0);
  assert.deepEqual(item.sddHooks, {archive: {before: 'old'}});
  assert.ok(item.labels.includes('sdd:auto-spec'));
  assert.deepEqual(window.sidebar(), [
    {kind: 'hook', points: [{action: 'archive', point: 'before', paragraph: 'old'}]},
  ]);
  rmSync(dir, {recursive: true, force: true});
}

test('an empty point map does not replace sddHooks', () => {
  for (const text of ['{}\n', 'archive: {}\n', 'archive:\n  before: "   "\n']) {
    const {dir, home, arcadia} = yard();
    prepare(arcadia, home);
    const item = cycle('1', 'implementing', {sddHooks: {archive: {before: 'old'}}});
    let hooks = 0;
    const window = openWindow(
      {homePath: home, adapter: 'tracker'},
      {
        login: () => MANAGER,
        tickets: () => [item],
        editLabels: (_key, add) => {
          item.labels = [...item.labels, ...add];
        },
        writeHooks: () => {
          hooks += 1;
        },
      },
    );
    window.addRole({name: 'Hooks', outcome: 'ticket-fields', text, labels: ['sdd:auto-plan']});
    window.drag('Hooks', '1');
    assert.equal(hooks, 0);
    assert.deepEqual(item.sddHooks, {archive: {before: 'old'}});
    assert.ok(item.labels.includes('sdd:auto-plan'));
    rmSync(dir, {recursive: true, force: true});
  }
});

function proveOnePullRequestReceivesTheText(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const item = cycle('1', 'implementing', {openPullRequests: 1});
  const comments: string[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => [item],
      commentPull: (_key, body) => {
        comments.push(body);
      },
    },
  );
  window.addRole({name: 'Note', outcome: 'pull-comment', text: 'ship it'});
  window.drag('Note', '1');
  assert.deepEqual(comments, ['ship it']);
  rmSync(dir, {recursive: true, force: true});
}

function proveZeroPullRequestsSetNoIcon(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const item = cycle('1', 'implementing', {openPullRequests: 0});
  const comments: string[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => [item],
      commentPull: (_key, body) => {
        comments.push(body);
      },
    },
  );
  window.addRole({name: 'Note', outcome: 'pull-comment', text: 'ship it'});
  const before = columnCards(window.board(), 'implementing')?.[0];
  assert.equal(before?.icon, undefined);
  assert.deepEqual(window.drag('Note', '1'), {status: 'комментарий не записан'});
  const after = columnCards(window.board(), 'implementing')?.[0];
  assert.equal(after?.icon, undefined);
  assert.deepEqual(comments, []);
  rmSync(dir, {recursive: true, force: true});
}

function proveHtmlStaysOffTheIssue(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const item = cycle('1', 'implementing', {comments: [{body: 'already'}]});
  const comments: string[] = [];
  let hooks = 0;
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => [item],
      commentPull: (_key, body) => {
        comments.push(body);
      },
      writeHooks: () => {
        hooks += 1;
      },
    },
  );
  window.addRole({name: 'Page', outcome: 'html', text: '<p>hello</p>'});
  assert.deepEqual(window.drag('Page', '1'), {popup: '<p>hello</p>'});
  assert.deepEqual(comments, []);
  assert.equal(hooks, 0);
  assert.deepEqual(item.comments, [{body: 'already'}]);
  rmSync(dir, {recursive: true, force: true});
}

function proveAMissingCycleFileSavesNothing(): void {
  const {dir, home, arcadia} = yard();
  const checkout = prepare(arcadia, home);
  const item = cycle('1', 'implementing');
  let started = 0;
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => [item],
      startStep: () => {
        started += 1;
      },
    },
  );
  window.addRole({name: 'File', outcome: 'cycle-file', text: 'notes.md'});
  const missing = path.join(checkout, 'notes.md');
  assert.deepEqual(window.drag('File', '1'), {popup: 'файла нет'});
  assert.equal(existsSync(missing), false);
  assert.equal(started, 0);
  writeFileSync(missing, 'body\n');
  assert.deepEqual(window.drag('File', '1'), {popup: 'body\n'});
  assert.equal(readFileSync(missing, 'utf8'), 'body\n');
  assert.equal(started, 0);
  rmSync(dir, {recursive: true, force: true});
}

function proveSeveralPullRequestsWriteNothing(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const item = cycle('1', 'implementing', {openPullRequests: 2});
  const comments: string[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => [item],
      commentPull: (_key, body) => {
        comments.push(body);
      },
    },
  );
  window.addRole({name: 'Note', outcome: 'pull-comment', text: 'ship it'});
  assert.equal(columnCards(window.board(), 'implementing')?.[0]?.icon, true);
  assert.deepEqual(window.drag('Note', '1'), {status: 'комментарий не записан'});
  assert.deepEqual(comments, []);
  rmSync(dir, {recursive: true, force: true});
}

function proveAWriteThatDoesNotFitLeavesThePreviousValue(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const text = 'archive:\n  before: next\n';
  const item = cycle('1', 'implementing', {sddHooks: {archive: {before: 'old'}}});
  let seen = '';
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => [item],
      writeHooks: (_key, next) => {
        seen = next;
      },
    },
  );
  window.addRole({name: 'Wide', outcome: 'ticket-fields', text, labels: ['sdd:auto-plan']});
  window.openCard('1');
  window.drag('Wide', '1');
  assert.equal(seen, text);
  assert.deepEqual(item.sddHooks, {archive: {before: 'old'}});
  assert.deepEqual(window.sidebar(), [
    {kind: 'hook', points: [{action: 'archive', point: 'before', paragraph: 'old'}]},
  ]);
  rmSync(dir, {recursive: true, force: true});
}

function proveTheLastDragWritesItsOwnText(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const item = cycle('1', 'implementing', {sddHooks: {archive: {before: 'old'}}});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => [item],
      writeHooks: (_key, next) => {
        item.sddHooks = parse(next);
      },
    },
  );
  window.addRole({
    name: 'First',
    outcome: 'ticket-fields',
    text: 'archive:\n  before: keep\n',
  });
  window.addRole({
    name: 'Second',
    outcome: 'ticket-fields',
    text: 'create-proposal:\n  after: fresh\n',
  });
  window.openCard('1');
  window.drag('First', '1');
  window.drag('Second', '1');
  assert.deepEqual(window.sidebar(), [
    {kind: 'hook', points: [{action: 'create-proposal', point: 'after', paragraph: 'fresh'}]},
  ]);
  rmSync(dir, {recursive: true, force: true});
}

test('checkouts includes a cycle that stands only in a column', () => {
  const {dir, home, arcadia} = yard();
  try {
    prepare(arcadia, home);
    const other = path.join(arcadia, 'services', 'other');
    writeServiceConfig(other, ['alpha']);
    const window = openWindow(
      {homePath: home, adapter: 'tracker'},
      {
        login: () => MANAGER,
        tickets: () => [
          ticket({
            key: '1',
            queue: 'alpha',
            sddService: 'services/billing',
            title: 'Pool',
          }),
          cycle('2', 'implementing', {sddService: 'services/other', title: 'Column'}),
        ],
      },
    );
    const board = window.board();
    assert.equal(
      board.pool.some(card => card.key === '2'),
      false,
    );
    assert.equal(
      board.pool.some(card => card.checkout?.endsWith(path.join('services', 'other'))),
      false,
    );
    const listed = window.checkouts();
    assert.ok(listed.some(item => item.endsWith(path.join('services', 'billing'))));
    assert.ok(listed.some(item => item.endsWith(path.join('services', 'other'))));
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

spec('role', () => {
  requirement("Verbs list this manager's roles", () => {
    scenario('The shelf shows the outcome before the drag', () => {
      proveTheShelfShowsTheOutcomeBeforeTheDrag();
    });
    scenario('Removing a role writes the home config', () => {
      proveRemovingARoleWritesTheHomeConfig();
    });
  });
  requirement('A role record is a name, one outcome, and its text', () => {
    scenario('Ticket-fields stores the labels', () => {
      proveTicketFieldsStoresTheLabels();
    });
  });
  requirement('The window runs one press and does not keep the role', () => {
    scenario('A drag does not move the phase', () => {
      proveADragDoesNotMoveThePhase();
    });
    scenario('An empty model still runs the role', () => {
      proveAnEmptyModelStillRunsTheRole();
    });
    scenario('The spy does not start a role', () => {
      proveTheSpyDoesNotStartARole();
    });
  });
  requirement('Ticket-fields sets the named labels and may replace sddHooks', () => {
    scenario('Named labels are set', () => {
      proveNamedLabelsAreSet();
    });
    scenario('A point map replaces sddHooks', () => {
      proveAPointMapReplacesSddHooks();
    });
    scenario('Prose leaves sddHooks', () => {
      proveProseLeavesSddHooks();
    });
  });
  requirement('A pull comment needs exactly one open pull request', () => {
    scenario('One pull request receives the text', () => {
      proveOnePullRequestReceivesTheText();
    });
    scenario('Zero pull requests set no icon', () => {
      proveZeroPullRequestsSetNoIcon();
    });
  });
  requirement('HTML opens and is not written on the cycle', () => {
    scenario('HTML stays off the issue', () => {
      proveHtmlStaysOffTheIssue();
    });
  });
  requirement("A cycle file opens from the card's checkout", () => {
    scenario('A missing cycle file saves nothing', () => {
      proveAMissingCycleFileSavesNothing();
    });
  });
});

test('the user block edits a role immediately', () => {
  proveTheUserBlockEditsARoleImmediately();
});

test('several open pull requests write nothing', () => {
  proveSeveralPullRequestsWriteNothing();
});

test('a write that does not fit leaves the previous value', () => {
  proveAWriteThatDoesNotFitLeavesThePreviousValue();
});

test('the last drag writes its own text', () => {
  proveTheLastDragWritesItsOwnText();
});

type ThreadPlace = {path: string; line: number; side: 'right' | 'left'};

function hostedAnswer(openPullRequests: number) {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const comments: {key: string; body: string}[] = [];
  const threads: {key: string; body: string; place: ThreadPlace}[] = [];
  const spoken: {key: string; body: string}[] = [];
  const hosts: {
    commentPull: (key: string, body: string) => void;
    threadPull: (key: string, body: string, place: ThreadPlace) => Promise<void>;
    speakPull: (key: string, body: string) => Promise<void>;
  } = {
    commentPull(key, body) {
      comments.push({key, body});
    },
    async threadPull(key, body, place) {
      threads.push({key, body, place});
    },
    async speakPull(key, body) {
      spoken.push({key, body});
    },
  };
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => [cycle('1', 'implementing', {openPullRequests})],
      commentPull: (key, body) => {
        hosts.commentPull(key, body);
      },
      threadPull: (key, body, place) => hosts.threadPull(key, body, place),
      speakPull: (key, body) => hosts.speakPull(key, body),
    },
  );
  return {dir, window, comments, threads, spoken, hosts};
}

test('one open pull request with a path and a line opens a thread', async () => {
  const hosted = hostedAnswer(1);
  try {
    const status = await hosted.window.answer(
      '1',
      '',
      'ответ',
      'строка',
      'src/a.ts',
      '12',
      'right',
    );
    assert.equal(status, undefined);
    assert.deepEqual(hosted.threads, [
      {key: '1', body: 'ответ', place: {path: 'src/a.ts', line: 12, side: 'right'}},
    ]);
    assert.deepEqual(hosted.comments, []);
    assert.deepEqual(hosted.spoken, []);
  } finally {
    rmSync(hosted.dir, {recursive: true, force: true});
  }
});

test('an empty side on a live anchor is the right side', async () => {
  const hosted = hostedAnswer(1);
  try {
    await hosted.window.answer('1', '', 'ответ', 'строка', 'src/a.ts', '12', '');
    assert.deepEqual(hosted.threads, [
      {key: '1', body: 'ответ', place: {path: 'src/a.ts', line: 12, side: 'right'}},
    ]);
  } finally {
    rmSync(hosted.dir, {recursive: true, force: true});
  }
});

test('a left side stays on the left', async () => {
  const hosted = hostedAnswer(1);
  try {
    await hosted.window.answer('1', '', 'ответ', 'строка', 'src/a.ts', '12', 'left');
    assert.deepEqual(hosted.threads, [
      {key: '1', body: 'ответ', place: {path: 'src/a.ts', line: 12, side: 'left'}},
    ]);
  } finally {
    rmSync(hosted.dir, {recursive: true, force: true});
  }
});

test('a refused thread falls back to a quoted conversation comment', async () => {
  const hosted = hostedAnswer(1);
  hosted.hosts.threadPull = async () => {
    throw new Error('host refused the thread');
  };
  try {
    const status = await hosted.window.answer('1', '', 'ответ', 'строка', 'src/a.ts', '4', 'right');
    assert.equal(status, undefined);
    assert.equal(String(status).includes('host refused the thread'), false);
    assert.deepEqual(hosted.spoken, [{key: '1', body: '> строка\n\nответ'}]);
    assert.deepEqual(hosted.comments, []);
  } finally {
    rmSync(hosted.dir, {recursive: true, force: true});
  }
});

test('a refused thread and a refused quote are not written', async () => {
  const hosted = hostedAnswer(1);
  hosted.hosts.threadPull = async () => {
    throw new Error('host refused the thread');
  };
  hosted.hosts.speakPull = async () => {
    throw new Error('host refused the quote');
  };
  try {
    const status = await hosted.window.answer('1', '', 'ответ', 'строка', 'src/a.ts', '4', 'right');
    assert.equal(status, 'комментарий не записан');
    assert.equal(status.includes('host refused'), false);
  } finally {
    rmSync(hosted.dir, {recursive: true, force: true});
  }
});

test('a missing path quotes the line through the conversation', async () => {
  const hosted = hostedAnswer(1);
  try {
    const status = await hosted.window.answer('1', '', 'ответ', 'строка');
    assert.equal(status, undefined);
    assert.deepEqual(hosted.comments, [{key: '1', body: '> строка\n\nответ'}]);
    assert.deepEqual(hosted.threads, []);
    assert.deepEqual(hosted.spoken, []);
  } finally {
    rmSync(hosted.dir, {recursive: true, force: true});
  }
});

test('a path without a whole line number quotes the line', async () => {
  const hosted = hostedAnswer(1);
  try {
    const status = await hosted.window.answer(
      '1',
      '',
      'ответ',
      'строка',
      'src/a.ts',
      '4.2',
      'right',
    );
    assert.equal(status, undefined);
    assert.deepEqual(hosted.comments, [{key: '1', body: '> строка\n\nответ'}]);
    assert.deepEqual(hosted.threads, []);
  } finally {
    rmSync(hosted.dir, {recursive: true, force: true});
  }
});

test('a question ignores the anchor and posts a checklist comment', async () => {
  const hosted = hostedAnswer(1);
  try {
    const status = await hosted.window.answer(
      '1',
      'вопрос',
      'ответ',
      'строка',
      'src/a.ts',
      '12',
      'right',
    );
    assert.equal(status, undefined);
    assert.deepEqual(hosted.comments, [{key: '1', body: '- [ ] вопрос\n\nответ'}]);
    assert.deepEqual(hosted.threads, []);
    assert.deepEqual(hosted.spoken, []);
  } finally {
    rmSync(hosted.dir, {recursive: true, force: true});
  }
});

test('an empty reply names the empty field and calls no host', async () => {
  const hosted = hostedAnswer(1);
  try {
    assert.equal(
      await hosted.window.answer('1', '', '   ', 'строка', 'src/a.ts', '12', 'right'),
      'Комментарий пустой. Напишите его в поле.',
    );
    assert.equal(
      await hosted.window.answer('1', 'вопрос', '', 'строка', 'src/a.ts', '12', 'right'),
      'Ответ пустой. Напишите его в поле.',
    );
    assert.deepEqual(hosted.comments, []);
    assert.deepEqual(hosted.threads, []);
    assert.deepEqual(hosted.spoken, []);
  } finally {
    rmSync(hosted.dir, {recursive: true, force: true});
  }
});

test('zero or two open pull requests write nothing', async () => {
  for (const count of [0, 2]) {
    const hosted = hostedAnswer(count);
    try {
      const status = await hosted.window.answer(
        '1',
        '',
        'ответ',
        'строка',
        'src/a.ts',
        '12',
        'right',
      );
      assert.equal(status, 'комментарий не записан');
      assert.deepEqual(hosted.comments, []);
      assert.deepEqual(hosted.threads, []);
      assert.deepEqual(hosted.spoken, []);
    } finally {
      rmSync(hosted.dir, {recursive: true, force: true});
    }
  }
});
