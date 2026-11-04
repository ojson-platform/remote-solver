import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {parse} from 'yaml';

import {memoryPorts} from '../adapters/github.ts';
import {changeDir} from '../machine/naming.ts';
import type {FileSource} from '../machine/port.ts';
import {loadCycle} from '../machine/snapshot.ts';

import {focusBlockProse} from './focus.ts';
import {openWindow, type WindowTicket} from './window.ts';

export function scratch(): {dir: string; home: string} {
  const dir = mkdtempSync(path.join(tmpdir(), 'ai-factory-home-'));
  return {dir, home: path.join(dir, 'home.yaml')};
}


export type HomeDoc = {
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


export function readHome(file: string): HomeDoc {
  return parse(readFileSync(file, 'utf8')) as HomeDoc;
}


export function assertNoEmptyStrings(value: unknown): void {
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


export function yard(): {dir: string; home: string; arcadia: string; github: string} {
  const dir = mkdtempSync(path.join(tmpdir(), 'ai-factory-watch-'));
  const arcadia = path.join(dir, 'arcadia');
  const github = path.join(dir, 'github');
  mkdirSync(arcadia, {recursive: true});
  mkdirSync(github, {recursive: true});
  return {dir, home: path.join(dir, 'home.yaml'), arcadia, github};
}


export function writeLaunch(
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


export function writeServiceConfig(checkout: string, queues: readonly string[]): void {
  const dir = path.join(checkout, 'openspec');
  mkdirSync(dir, {recursive: true});
  const lines = ['sdd:', '  queues:'];
  for (const name of queues) {
    lines.push(`    - name: ${name}`);
  }
  lines.push('');
  writeFileSync(path.join(dir, 'config.yaml'), lines.join('\n'));
}


export function writeOverlay(checkout: string, watch: readonly string[], extra = ''): void {
  const dir = path.join(checkout, '.aifactory');
  mkdirSync(dir, {recursive: true});
  const lines = ['watch:'];
  for (const name of watch) {
    lines.push(`  - ${name}`);
  }
  writeFileSync(path.join(dir, 'config.yaml'), `${lines.join('\n')}\n${extra}`);
}


export function ticket(over: Partial<WindowTicket> & Pick<WindowTicket, 'key'>): WindowTicket {
  return {title: over.key, labels: ['sdd:cycle'], ...over};
}


export const MANAGER = 'ada';


export const COLUMN_NAMES = [
  'proposing',
  'specifying',
  'designing',
  'tasking',
  'implementing',
  'verifying',
  'accepting',
];


export function prepare(arcadia: string, home: string): string {
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia});
  return checkout;
}


export function cycle(key: string, phase: string, over: Partial<WindowTicket> = {}): WindowTicket {
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


export function openCycles(
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


export function writeChange(checkout: string, key: string, name: string, body: string): void {
  const dir = path.join(checkout, changeDir(key));
  mkdirSync(dir, {recursive: true});
  writeFileSync(path.join(dir, name), body);
}


export function columnCards(
  board: ReturnType<ReturnType<typeof openWindow>['board']>,
  name: string,
): {key: string}[] | undefined {
  return board.columns?.find(column => column.name === name)?.cards;
}


export type ServiceYaml = {
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


export function writeServiceYaml(checkout: string, body: string): string {
  const dir = path.join(checkout, 'openspec');
  mkdirSync(dir, {recursive: true});
  const file = path.join(dir, 'config.yaml');
  writeFileSync(file, body.endsWith('\n') ? body : `${body}\n`);
  return file;
}


export function readServiceYaml(file: string): ServiceYaml {
  return parse(readFileSync(file, 'utf8')) as ServiceYaml;
}


export function visibleKeys(board: ReturnType<ReturnType<typeof openWindow>['board']>): string[] {
  return [
    ...board.cards.map(card => card.key),
    ...board.pool.map(card => card.key),
    ...board.columns.flatMap(column => column.cards.map(card => card.key)),
  ];
}


export type ReviewReading = {
  threads: readonly {marker?: string | null; lines: readonly string[]}[];
  conversation?: {last?: {marker?: string | null; body: string} | null} | null;
};


export function openSide(
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


export function kinds(blocks: readonly {kind: string}[]): string[] {
  return blocks.map(block => block.kind);
}

export type HomeRole = {name?: string; outcome?: string; text?: string; labels?: string[]};

export function homeRoles(file: string): HomeRole[] {
  const roles = readHome(file).roles;
  return Array.isArray(roles) ? (roles as HomeRole[]) : [];
}

export function proveChoosingCursorWritesItsPairAndOmitsEffortAndSpeed2(): void {
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


export const hookQueues = ['sdd:', '  queues:', '    - name: alpha', ''].join('\n');


export function openHookGroup(body: string, over: Partial<WindowTicket> = {}) {
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


export function proveTheSidebarFocusPlaqueDoesNotIncludeTheMarkerLine121(): void {
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
  assert.deepEqual(blocks, [
    {
      kind: 'focus',
      marker: 'sdd:focus',
      body: 'Specify thread 4\nwhy this gap\n',
      display: focusBlockProse('sdd:focus', 'Specify thread 4\nwhy this gap\n'),
    },
  ]);
  assert.equal(blocks[0]?.kind === 'focus' && blocks[0].body.includes('sdd:focus'), false);
  assert.equal(JSON.stringify(blocks).includes('Plan gap'), false);
  rmSync(dir, {recursive: true, force: true});
}

export function proveAnOpenCycleWhoseOnlySidebarBlockIsFocusShowsThatBlock113(): void {
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
  assert.deepEqual(blocks, [
    {
      kind: 'focus',
      marker: 'sdd:focus',
      body: 'Specify thread 4\n',
      display: focusBlockProse('sdd:focus', 'Specify thread 4\n'),
    },
  ]);
  const text = JSON.stringify(blocks);
  assert.equal(text.includes('UNIQUE PROPOSAL BODY'), false);
  assert.equal(text.includes('MIRROR TEXT'), false);
  assert.equal(blocks[0]?.kind === 'focus' && blocks[0].body.includes('sdd:focus'), false);
  rmSync(dir, {recursive: true, force: true});
}

export function proveACatalogThatRejectsTheRecordedJudgmentIdKeepsItAndStopsTheStep95(): void {
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

export function proveTheServiceConfigGroupHasNoFieldsWhenTheFileDoesNotParseAndOnlyThatCheckoutLosesItsCards106(): void {
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

export async function proveTheMachineSpyLeavesABareCycleOutAndDoesNotReadAifactory45(): Promise<void> {
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
