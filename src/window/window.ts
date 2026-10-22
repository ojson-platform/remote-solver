import {existsSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import path from 'node:path';

import {parse, stringify} from 'yaml';

import {HEADINGS} from '../machine/change.ts';
import {changeDir} from '../machine/naming.ts';
import {GATE_CLOSES, GATE_PHASES, phaseOf, type Phase} from '../machine/phase.ts';
import {queueOf} from '../machine/queues.ts';

const NEEDS_AGENT = 'фабрике ещё нужен агент';
const SILENT_AGENT = 'агент не отвечает';

const FACTORY_AGENTS = ['cursor', 'codex', 'claude-code', 'opencode'] as const;

type SkillMode = 'mechanical' | 'judgment';

type Pair = {
  mechanical: string;
  judgment: string;
  effort?: {mechanical: string; judgment: string};
  /** Codex has a speed field. The default is to omit the key. */
  speed: boolean;
};

/** Known pairs. Choosing an agent does not read a live catalog. */
const PAIRS: Record<string, Pair> = {
  cursor: {
    mechanical: 'composer-2.5-fast',
    judgment: 'grok-4.7-high-fast',
    speed: false,
  },
  codex: {
    mechanical: 'gpt-6-luna',
    judgment: 'gpt-6.1-sol',
    effort: {mechanical: 'low', judgment: 'high'},
    speed: true,
  },
  'claude-code': {
    mechanical: 'sonnet',
    judgment: 'opus',
    effort: {mechanical: 'medium', judgment: 'medium'},
    speed: false,
  },
  opencode: {
    mechanical: 'moonshotai/kimi-k2.7-code',
    judgment: 'moonshotai/kimi-k3',
    speed: false,
  },
};

const AGENT_KEYS = new Set(['agent', 'models', 'effort', 'speed']);
const FORBIDDEN = new Set(['person', 'phase', 'focus', 'metrics']);

type Doc = Record<string, unknown>;

export type AdapterKind = 'tracker' | 'github';

export type Launch = {
  /** Path the launch passed. No path means no home file is written. */
  homePath?: string;
  /** Agents this window can offer. An empty list writes no home file. */
  agents?: readonly string[];
  /** One running ai-factory. Not stored in the home file. */
  adapter?: AdapterKind;
};

export type WindowTicket = {
  key: string;
  title: string;
  labels: readonly string[];
  /** Tracker port field. A label of another queue does not replace it. */
  queue?: string;
  /** GitHub watch-list key, `owner/repo`. */
  repo?: string;
  /** Absent when the field is missing. An empty string is a present value. */
  sddService?: string;
  assignee?: string;
  /** Absent when the adapter did not say. Closed is `false`. */
  open?: boolean;
  /** The merge is still ahead. The window does not discover this from a host. */
  mergeAhead?: boolean;
  checks?: 'green' | 'red' | 'pending' | 'none';
  parent?: string;
  dependsOn?: readonly string[];
  openPullRequests?: number;
  comments?: readonly WindowComment[];
};

export type WindowComment = {
  body: string;
  /** A manager comment is not an `sdd:focus` record. */
  manager?: boolean;
};

export type WindowOutside = {
  /** Whether a recorded agent id still answers. The window asks; it does not start that agent. */
  answers?: (agentId: string) => boolean;
  /** Live model catalog. Choosing an agent does not read it. */
  catalog?: (agentId: string) => {mechanical: string; judgment: string};
  /** Assignee write. Take calls this with the ticket key and `login()`. */
  writeAssignee?: (key: string, login: string) => void;
  /** Phase write. The window's spy calls this with `proposing`. */
  writePhase?: (key: string, phase: string) => void;
  /** A step the window's spy would start, in the gathered checkout. */
  startStep?: (checkout?: string) => void;
  /** Open tickets this adapter can see. The window filters them by the watch list. */
  tickets?: () => readonly WindowTicket[];
  /** Login of this process. Not a Tracker or GitHub call. */
  login?: () => string;
  /** True while an agent leads a step for this key. */
  leading?: (key: string) => boolean;
  /** Write `sddService`. The next read sees it. */
  writeService?: (key: string, service: string) => void;
};

export type ModelField = {value: string; needsValue: boolean};

export type SettingsState = {
  open: boolean;
  agent: string;
  models: {mechanical: ModelField; judgment: ModelField};
  effort?: {mechanical: string; judgment: string};
  speed?: {mechanical: string; judgment: string};
  watch: string[];
  roots: {arcadia: string; github: string};
};

export type CardState = {
  key: string;
  reason: string;
  takeDisabled: boolean;
  choices: string[];
  /** Gathered checkout when the path stays inside the root. */
  checkout?: string;
  /** Tracker port field, or the GitHub label `queueOf` found. */
  queue: string;
};

/** A pool card. `take` is the same gesture as dragging the card onto the board. */
export type PoolCard = {
  key: string;
  title: string;
  take: true;
  takeDisabled?: true;
  icon?: true;
  reason?: string;
  /** Gathered checkout copied from the checkout card. */
  checkout?: string;
  /** Tracker port field, or the GitHub label `queueOf` found. */
  queue: string;
  /** Service choices copied from the checkout card. */
  choices: string[];
};

const COLUMN_NAMES = [
  'proposing',
  'specifying',
  'designing',
  'tasking',
  'implementing',
  'verifying',
  'accepting',
] as const;

export type ColumnName = (typeof COLUMN_NAMES)[number];

export type PhaseRow = number | {done: number; open: number} | 'green' | 'red' | 'pending';

/** A column card. `icon` is present or absent: one mark, no letters. */
export type CycleCard = {
  key: string;
  title: string;
  icon?: true;
  reason?: string;
  phaseRow?: PhaseRow;
  layers?: string;
};

export type BoardState = {
  visible: true;
  rows: {text: string}[];
  settingsOpen: boolean;
  stepsStart: boolean;
  takeDisabled: boolean;
  cards: CardState[];
  watch: string[];
  pool: PoolCard[];
  columns: {name: ColumnName; cards: CycleCard[]}[];
};

const CATALOG_MISSING = 'каталога нет';
const SERVICE_UNNAMED = 'не назван сервис';
const CONFIG_MISSING = 'конфига сервиса нет';
const QUEUE_MISSING = 'очереди нет в конфиге сервиса';

function isDoc(value: unknown): value is Doc {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === 'string' && item !== '' && !out.includes(item)) {
      out.push(item);
    }
  }
  return out;
}

function expandRoot(value: string): string {
  if (value === '~') {
    return homedir();
  }
  if (value.startsWith('~/')) {
    return path.join(homedir(), value.slice(2));
  }
  return value;
}

function rootText(doc: Doc, kind: 'arcadia' | 'github'): string {
  const roots = isDoc(doc.roots) ? doc.roots : {};
  const value = roots[kind];
  if (typeof value !== 'string' || value.trim() === '') {
    return kind === 'arcadia' ? '~/arcadia' : '~/github';
  }
  return value.trim();
}

function hasDotDot(service: string): boolean {
  return service.split(/[/\\]/).includes('..');
}

function staysInside(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** A service path that stays under `root`. `..` is the missing-catalog break. */
function joinInside(root: string, service: string): string | undefined {
  if (service.trim() === '' || hasDotDot(service)) {
    return undefined;
  }
  const resolved = path.resolve(root, service);
  if (!staysInside(root, resolved)) {
    return undefined;
  }
  return resolved;
}

function overlayNames(checkout: string): string[] {
  const file = path.join(checkout, '.aifactory', 'config.yaml');
  if (!existsSync(file)) {
    return [];
  }
  try {
    const raw = parse(readFileSync(file, 'utf8'));
    if (!isDoc(raw)) {
      return [];
    }
    return stringList(raw.watch);
  } catch {
    return [];
  }
}

function readSdd(checkout: string): Doc | undefined {
  const file = path.join(checkout, 'openspec', 'config.yaml');
  if (!existsSync(file)) {
    return undefined;
  }
  try {
    const raw = parse(readFileSync(file, 'utf8'));
    if (!isDoc(raw) || !isDoc(raw.sdd)) {
      return undefined;
    }
    return raw.sdd;
  } catch {
    return undefined;
  }
}

function queueNames(checkout: string): string[] | undefined {
  const sdd = readSdd(checkout);
  if (!sdd || !Array.isArray(sdd.queues)) {
    return undefined;
  }
  const names: string[] = [];
  for (const item of sdd.queues) {
    if (typeof item === 'string' && item !== '') {
      names.push(item);
    } else if (isDoc(item) && typeof item.name === 'string' && item.name !== '') {
      names.push(item.name);
    }
  }
  return names;
}

function serviceDirs(repoRoot: string): string[] {
  if (!existsSync(repoRoot)) {
    return [];
  }
  const found: string[] = [];
  const walk = (dir: string): void => {
    if (readSdd(dir)) {
      found.push(path.relative(repoRoot, dir));
    }
    let entries;
    try {
      entries = readdirSync(dir, {withFileTypes: true});
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === '.git' || entry.name === 'node_modules') {
        continue;
      }
      walk(path.join(dir, entry.name));
    }
  };
  walk(repoRoot);
  found.sort((left, right) => {
    if (left === '') {
      return -1;
    }
    if (right === '') {
      return 1;
    }
    return left.localeCompare(right);
  });
  return found;
}

function textOf(homePath: string | undefined): string | null {
  if (!homePath || !existsSync(homePath)) {
    return null;
  }
  return readFileSync(homePath, 'utf8');
}

function parseDoc(text: string | null): Doc {
  if (text === null || text.trim() === '') {
    return {};
  }
  const raw = parse(text);
  return isDoc(raw) ? raw : {};
}

function agentOf(doc: Doc): string {
  return typeof doc.agent === 'string' ? doc.agent : '';
}

function slot(models: unknown, mode: SkillMode): string {
  if (!isDoc(models)) {
    return '';
  }
  const value = models[mode];
  return typeof value === 'string' ? value : '';
}

function modeValues(value: unknown): {mechanical?: string; judgment?: string} {
  if (!isDoc(value)) {
    return {};
  }
  const out: {mechanical?: string; judgment?: string} = {};
  if (typeof value.mechanical === 'string' && value.mechanical !== '') {
    out.mechanical = value.mechanical;
  }
  if (typeof value.judgment === 'string' && value.judgment !== '') {
    out.judgment = value.judgment;
  }
  return out;
}

function restOf(doc: Doc): Doc {
  const rest: Doc = {};
  for (const [key, value] of Object.entries(doc)) {
    if (AGENT_KEYS.has(key) || FORBIDDEN.has(key) || value === undefined) {
      continue;
    }
    rest[key] = value;
  }
  return rest;
}

function replaceAgent(previous: Doc, agentId: string): Doc {
  const next: Doc = {agent: agentId};
  const pair = PAIRS[agentId];
  if (pair) {
    next.models = {mechanical: pair.mechanical, judgment: pair.judgment};
    if (pair.effort) {
      next.effort = {mechanical: pair.effort.mechanical, judgment: pair.effort.judgment};
    }
  }
  return {...next, ...restOf(previous)};
}

function modelRow(doc: Doc): {text: string}[] {
  const mechanical = slot(doc.models, 'mechanical');
  const judgment = slot(doc.models, 'judgment');
  if (mechanical === '' && judgment === '') {
    return [{text: 'нужны модели mechanical и judgment'}];
  }
  if (mechanical === '') {
    return [{text: 'нужна модель mechanical'}];
  }
  if (judgment === '') {
    return [{text: 'нужна модель judgment'}];
  }
  return [];
}

const LAYERS = ['Change', 'Plan', 'Specify', 'Design', 'Tasks', 'Code'] as const;

type Placed = {card: CycleCard; occasion: boolean};

function isColumn(phase: Phase): phase is ColumnName {
  return (COLUMN_NAMES as readonly string[]).includes(phase);
}

function isGate(phase: Phase): boolean {
  return (GATE_PHASES as readonly string[]).includes(phase);
}

function keyOrder(left: string, right: string): number {
  return left.localeCompare(right, undefined, {numeric: true});
}

function byKey<T extends {key: string}>(left: T, right: T): number {
  return keyOrder(left.key, right.key);
}

/** `sdd:cancelled` removes the card. `phaseOf` leaves an earlier phase in place. */
function slotOf(
  item: WindowTicket,
  phase: Phase | null,
  manager: string | undefined,
): 'cards' | 'hide' | 'pool' | ColumnName {
  if (item.labels.includes('sdd:cancelled') || phase === 'cancelled') {
    return 'hide';
  }
  if (phase === null) {
    if (item.open === false) {
      return 'cards';
    }
    if (item.assignee !== undefined && item.assignee !== '' && item.assignee !== manager) {
      return 'hide';
    }
    return 'pool';
  }
  if (item.open === false && (item.mergeAhead === true || phase === 'accepted')) {
    return 'hide';
  }
  const column = columnOf(phase, item);
  if (!column) {
    return 'hide';
  }
  if (item.assignee === undefined || item.assignee === '') {
    if (item.open === true && item.mergeAhead === true) {
      return column;
    }
    return 'pool';
  }
  if (manager !== undefined && item.assignee === manager) {
    return column;
  }
  return 'hide';
}

function columnOf(phase: Phase, item: WindowTicket): ColumnName | null {
  if (item.open === true && item.mergeAhead === true) {
    return 'accepting';
  }
  if (phase === 'accepted') {
    return 'accepting';
  }
  const closed = GATE_CLOSES[phase];
  if (closed && isColumn(closed)) {
    return closed;
  }
  if (isColumn(phase)) {
    return phase;
  }
  return null;
}

function section(text: string, heading: string): string {
  const match = new RegExp(`^## ${heading}\\s*$`, 'm').exec(text);
  if (!match) {
    return '';
  }
  const rest = text.slice(match.index + match[0].length);
  const next = rest.search(/^## /m);
  return next === -1 ? rest : rest.slice(0, next);
}

function unchecked(text: string, heading: string): number {
  return section(text, heading)
    .split('\n')
    .filter(line => line.trimStart().startsWith('- [ ]')).length;
}

function readChangeText(checkout: string | undefined, key: string, name: string): string {
  if (!checkout) {
    return '';
  }
  const file = path.join(checkout, changeDir(key), name);
  if (!existsSync(file)) {
    return '';
  }
  return readFileSync(file, 'utf8');
}

function openCount(
  checkout: string | undefined,
  key: string,
  name: string,
  heading: string,
): number {
  return unchecked(readChangeText(checkout, key, name), heading);
}

function taskRow(
  checkout: string | undefined,
  key: string,
): {done: number; open: number} | undefined {
  if (!checkout) {
    return undefined;
  }
  const file = path.join(checkout, changeDir(key), 'tasks.md');
  if (!existsSync(file)) {
    return undefined;
  }
  let done = 0;
  let open = 0;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('- [x]')) {
      done += 1;
    } else if (trimmed.startsWith('- [ ]')) {
      open += 1;
    }
  }
  return {done, open};
}

function phaseRowOf(
  column: ColumnName,
  item: WindowTicket,
  checkout: string | undefined,
  questions: number,
  decisions: number,
): PhaseRow | undefined {
  if (column === 'proposing') {
    return questions;
  }
  if (column === 'designing') {
    return decisions;
  }
  if (column === 'implementing') {
    return taskRow(checkout, item.key);
  }
  if (
    (column === 'verifying' || column === 'accepting') &&
    (item.checks === 'green' || item.checks === 'red' || item.checks === 'pending')
  ) {
    return item.checks;
  }
  return undefined;
}

function childKeys(item: WindowTicket, reading: readonly WindowTicket[]): string[] {
  return reading
    .filter(
      record =>
        record.key !== item.key &&
        record.labels.includes('sdd:cycle') &&
        record.parent === item.key,
    )
    .map(record => record.key)
    .sort(keyOrder);
}

function blockerKeys(item: WindowTicket, reading: readonly WindowTicket[]): string[] {
  const known = new Set(reading.map(record => record.key));
  const found = new Set<string>();
  for (const key of item.dependsOn ?? []) {
    if (known.has(key)) {
      found.add(key);
    }
  }
  return [...found].sort(keyOrder);
}

/** The phase row already shows this count, so the card keeps the occasion and drops the line. */
function reasonHidden(parts: readonly string[], phaseRow: PhaseRow | undefined): boolean {
  if (parts.length !== 1 || typeof phaseRow !== 'number') {
    return false;
  }
  return parts[0] === `вопросы ${phaseRow}` || parts[0] === `решения ${phaseRow}`;
}

function focusLayers(comments: readonly WindowComment[] | undefined): string | undefined {
  let body: string | undefined;
  for (const comment of comments ?? []) {
    if (comment.manager) {
      continue;
    }
    const first = comment.body.split('\n', 1)[0] ?? '';
    if (first.trim() === 'sdd:focus') {
      body = comment.body;
    }
  }
  if (body === undefined) {
    return undefined;
  }
  const names: string[] = [];
  for (const line of body.split('\n').slice(1)) {
    const trimmed = line.trim();
    if (trimmed === '') {
      continue;
    }
    const token = trimmed.split(/\s+/)[0] ?? '';
    if (!(LAYERS as readonly string[]).includes(token)) {
      continue;
    }
    const rest = trimmed.slice(token.length).trim();
    if (rest === 'solid') {
      continue;
    }
    names.push(token);
  }
  return names.length === 0 ? undefined : names.join(' · ');
}

function ordered(items: readonly Placed[]): CycleCard[] {
  const occasion = items
    .filter(item => item.occasion)
    .map(item => item.card)
    .sort(byKey);
  const rest = items
    .filter(item => !item.occasion)
    .map(item => item.card)
    .sort(byKey);
  return [...occasion, ...rest];
}

function buildCycle(
  item: WindowTicket,
  phase: Phase,
  column: ColumnName,
  checkout: string | undefined,
  breakReason: string,
  reading: readonly WindowTicket[],
  hideIcon: boolean,
): Placed {
  const questions = openCount(checkout, item.key, 'proposal.md', HEADINGS.openQuestions);
  const decisions = openCount(checkout, item.key, 'design.md', HEADINGS.openDecisions);
  const phaseRow = phaseRowOf(column, item, checkout, questions, decisions);
  const parts: string[] = [];
  if (breakReason !== '') {
    parts.push(breakReason);
  }
  if (isGate(phase)) {
    parts.push(phase);
  }
  if (item.labels.includes('sdd:wait-human')) {
    parts.push('Ask');
  }
  if (questions > 0) {
    parts.push(`вопросы ${questions}`);
  }
  if (decisions > 0) {
    parts.push(`решения ${decisions}`);
  }
  if (item.mergeAhead === true) {
    parts.push('мерж');
  }
  const children = childKeys(item, reading);
  if (children.length > 0) {
    parts.push(`дети ${children.join(' ')}`);
  }
  const blockers = blockerKeys(item, reading);
  if (blockers.length > 0) {
    parts.push(`блокеры ${blockers.join(' ')}`);
  }
  if ((item.openPullRequests ?? 0) > 1) {
    parts.push('несколько pull request');
  }
  const occasion = parts.length > 0;
  const card: CycleCard = {key: item.key, title: item.title};
  if (occasion && !hideIcon) {
    card.icon = true;
  }
  if (occasion && !hideIcon && !reasonHidden(parts, phaseRow)) {
    card.reason = parts.join(' · ');
  }
  if (phaseRow !== undefined) {
    card.phaseRow = phaseRow;
  }
  const layers = focusLayers(item.comments);
  if (layers) {
    card.layers = layers;
  }
  return {card, occasion};
}

/** A pool card copies the checkout, queue, and choices. A break or two pull requests keeps the column reason. */
function poolCard(
  item: WindowTicket,
  checkout: CardState,
  phase: Phase | null,
  reading: readonly WindowTicket[],
  ready: boolean,
  live: boolean,
  hideIcon: boolean,
): PoolCard {
  const several = (item.openPullRequests ?? 0) > 1;
  const broken = checkout.reason !== '';
  const card: PoolCard = {
    key: item.key,
    title: item.title,
    take: true,
    queue: checkout.queue,
    choices: checkout.choices,
  };
  if (checkout.checkout) {
    card.checkout = checkout.checkout;
  }
  if (broken || several) {
    card.takeDisabled = true;
    const column = (phase && columnOf(phase, item)) || 'implementing';
    const placed = buildCycle(
      item,
      phase ?? 'implementing',
      column,
      checkout.checkout,
      checkout.reason,
      reading,
      hideIcon,
    );
    if (placed.card.icon) {
      card.icon = true;
    }
    if (placed.card.reason !== undefined) {
      card.reason = placed.card.reason;
    }
    return card;
  }
  if (!live || (phase === null && !ready)) {
    card.takeDisabled = true;
  }
  return card;
}

/** The window for one launch. Another launch has its own home path. */
export function openWindow(launch: Launch = {}, outside: WindowOutside = {}) {
  const offered = launch.agents ?? FACTORY_AGENTS;
  let baseline = textOf(launch.homePath);
  let doc = parseDoc(baseline);
  let settingsOpen = false;

  function adopt(text: string | null): void {
    baseline = text;
    doc = parseDoc(text);
  }

  function recorded(): boolean {
    return Boolean(launch.homePath) && baseline !== null && agentOf(doc) !== '';
  }

  function answers(): boolean {
    if (!recorded()) {
      return false;
    }
    return outside.answers?.(agentOf(doc)) ?? true;
  }

  function canWrite(): boolean {
    if (!launch.homePath) {
      return false;
    }
    const disk = textOf(launch.homePath);
    if (disk !== baseline) {
      adopt(disk);
      return false;
    }
    return true;
  }

  function commit(next: Doc): void {
    if (!launch.homePath) {
      return;
    }
    const clean: Doc = {};
    for (const [key, value] of Object.entries(next)) {
      if (FORBIDDEN.has(key) || value === undefined) {
        continue;
      }
      clean[key] = value;
    }
    const text = stringify(clean);
    writeFileSync(launch.homePath, text);
    baseline = text;
    doc = clean;
  }

  function settings(): SettingsState {
    const agent = agentOf(doc);
    const pair = PAIRS[agent];
    const effortFile = modeValues(doc.effort);
    const speedFile = modeValues(doc.speed);
    const mechanical = slot(doc.models, 'mechanical');
    const judgment = slot(doc.models, 'judgment');
    const state: SettingsState = {
      open: settingsOpen,
      agent,
      models: {
        mechanical: {value: mechanical, needsValue: agent !== '' && mechanical === ''},
        judgment: {value: judgment, needsValue: agent !== '' && judgment === ''},
      },
      watch: stringList(doc.watch),
      roots: {arcadia: rootText(doc, 'arcadia'), github: rootText(doc, 'github')},
    };
    if (pair?.effort) {
      state.effort = {
        mechanical: effortFile.mechanical ?? pair.effort.mechanical,
        judgment: effortFile.judgment ?? pair.effort.judgment,
      };
    }
    if (pair?.speed) {
      state.speed = {
        mechanical: speedFile.mechanical ?? '',
        judgment: speedFile.judgment ?? '',
      };
    }
    return state;
  }

  function modelsReady(): boolean {
    return slot(doc.models, 'mechanical') !== '' && slot(doc.models, 'judgment') !== '';
  }

  function rows(live: boolean): {text: string}[] {
    if (!recorded()) {
      return [{text: NEEDS_AGENT}];
    }
    if (!live) {
      return [{text: SILENT_AGENT}];
    }
    return modelRow(doc);
  }

  function diskHome(): Doc {
    return parseDoc(textOf(launch.homePath));
  }

  function kind(): AdapterKind {
    return launch.adapter ?? 'tracker';
  }

  function unnamed(item: WindowTicket): boolean {
    if (kind() === 'github') {
      return item.sddService === undefined;
    }
    return item.sddService === undefined || item.sddService.trim() === '';
  }

  function repoRootOf(item: WindowTicket): string | undefined {
    const repo = item.repo ?? '';
    if (repo === '' || hasDotDot(repo)) {
      return undefined;
    }
    const parts = repo.split('/').filter(part => part !== '' && part !== '.' && part !== '..');
    if (parts.length === 0) {
      return undefined;
    }
    const root = expandRoot(rootText(diskHome(), 'github'));
    const resolved = path.join(root, ...parts);
    if (!staysInside(root, resolved)) {
      return undefined;
    }
    return resolved;
  }

  function gathered(item: WindowTicket): string | undefined {
    if (unnamed(item)) {
      return undefined;
    }
    const service = item.sddService ?? '';
    if (kind() === 'github') {
      const root = repoRootOf(item);
      if (!root) {
        return undefined;
      }
      if (service.trim() === '') {
        return root;
      }
      return joinInside(root, service);
    }
    return joinInside(expandRoot(rootText(diskHome(), 'arcadia')), service);
  }

  function onWatch(item: WindowTicket, names: readonly string[]): boolean {
    if (!item.labels.includes('sdd:cycle')) {
      return false;
    }
    if (kind() === 'github') {
      return typeof item.repo === 'string' && item.repo !== '' && names.includes(item.repo);
    }
    return typeof item.queue === 'string' && item.queue !== '' && names.includes(item.queue);
  }

  function sortedTickets(): WindowTicket[] {
    return [...(outside.tickets?.() ?? [])].sort((left, right) =>
      left.key.localeCompare(right.key, undefined, {numeric: true}),
    );
  }

  function readWatch(): string[] {
    const names = stringList(diskHome().watch);
    const seen = new Set<string>();
    let grew = true;
    while (grew) {
      grew = false;
      const checkouts = new Set<string>();
      for (const item of sortedTickets()) {
        const checkout = gathered(item);
        if (!checkout || !existsSync(checkout)) {
          continue;
        }
        checkouts.add(checkout);
      }
      for (const checkout of checkouts) {
        if (seen.has(checkout)) {
          continue;
        }
        seen.add(checkout);
        const before = names.length;
        for (const name of overlayNames(checkout)) {
          if (!names.includes(name)) {
            names.push(name);
          }
        }
        if (names.length !== before) {
          grew = true;
        }
      }
    }
    return names;
  }

  function trackerChoices(queue: string): string[] {
    const choices: string[] = [];
    for (const item of sortedTickets()) {
      if (unnamed(item)) {
        continue;
      }
      const checkout = gathered(item);
      if (!checkout || !existsSync(checkout)) {
        continue;
      }
      const queues = queueNames(checkout);
      if (!queues?.includes(queue)) {
        continue;
      }
      const service = (item.sddService ?? '').trim();
      if (service === '' || choices.includes(service)) {
        continue;
      }
      choices.push(service);
    }
    return choices;
  }

  function choicesFor(item: WindowTicket): string[] {
    if (kind() === 'github') {
      const root = repoRootOf(item);
      return root ? serviceDirs(root) : [];
    }
    return trackerChoices(item.queue ?? '');
  }

  function queueListed(item: WindowTicket, checkout: string): boolean {
    const queues = queueNames(checkout);
    if (!queues) {
      return false;
    }
    if (kind() === 'tracker') {
      return queues.includes(item.queue ?? '');
    }
    return (
      queueOf(
        item.labels,
        queues.map(name => ({name})),
      ) !== undefined
    );
  }

  function cardOf(item: WindowTicket): CardState {
    const found = gathered(item);
    let reason = '';
    let checkout: string | undefined;
    if (unnamed(item)) {
      reason = SERVICE_UNNAMED;
    } else if (!found || !existsSync(found)) {
      reason = CATALOG_MISSING;
      checkout = found;
    } else if (!existsSync(path.join(found, 'openspec', 'config.yaml'))) {
      reason = CONFIG_MISSING;
      checkout = found;
    } else if (!queueListed(item, found)) {
      reason = QUEUE_MISSING;
      checkout = found;
    } else {
      checkout = found;
    }
    const queues = checkout ? queueNames(checkout) : undefined;
    const queue =
      kind() === 'tracker'
        ? (item.queue ?? '')
        : queues
          ? (queueOf(
              item.labels,
              queues.map(name => ({name})),
            )?.name ?? '')
          : '';
    const card: CardState = {
      key: item.key,
      reason,
      takeDisabled: reason !== '',
      choices: choicesFor(item),
      queue,
    };
    if (checkout) {
      card.checkout = checkout;
    }
    return card;
  }

  function writeMissingServices(names: readonly string[]): void {
    if (!outside.writeService) {
      return;
    }
    if (kind() === 'github') {
      for (const item of sortedTickets()) {
        if (!onWatch(item, names) || item.sddService !== undefined) {
          continue;
        }
        const root = repoRootOf(item);
        const dirs = root ? serviceDirs(root) : [];
        if (dirs.length === 1) {
          outside.writeService(item.key, dirs[0]);
        }
      }
      return;
    }
    for (const item of sortedTickets()) {
      if (!onWatch(item, names) || !unnamed(item)) {
        continue;
      }
      const choices = trackerChoices(item.queue ?? '');
      if (choices.length === 1) {
        outside.writeService(item.key, choices[0]);
      }
    }
  }

  function settle(): {watch: string[]; cards: CardState[]} {
    let watch = readWatch();
    if (outside.tickets) {
      let guard = 0;
      for (;;) {
        const before = sortedTickets()
          .map(item => `${item.key}\0${item.sddService}`)
          .join('\n');
        writeMissingServices(watch);
        watch = readWatch();
        const after = sortedTickets()
          .map(item => `${item.key}\0${item.sddService}`)
          .join('\n');
        guard += 1;
        if (before === after || guard > 8) {
          break;
        }
      }
    }
    const cards = sortedTickets()
      .filter(item => onWatch(item, watch))
      .map(cardOf);
    return {watch, cards};
  }

  function lay(watch: readonly string[]): {
    taken: Set<string>;
    pool: PoolCard[];
    columns: {name: ColumnName; cards: CycleCard[]}[];
  } {
    const reading = sortedTickets();
    const manager = outside.login?.();
    const live = answers();
    const ready = live && modelsReady();
    const taken = new Set<string>();
    const pool: PoolCard[] = [];
    const buckets = new Map<ColumnName, Placed[]>();
    for (const item of reading) {
      if (!onWatch(item, watch)) {
        continue;
      }
      const phase = phaseOf([...item.labels]);
      const where = slotOf(item, phase, manager);
      if (where === 'cards') {
        continue;
      }
      if (where === 'hide') {
        taken.add(item.key);
        continue;
      }
      const checkout = cardOf(item);
      const hideIcon = outside.leading?.(item.key) === true || item.checks === 'pending';
      if (!phase) {
        taken.add(item.key);
        pool.push(poolCard(item, checkout, null, reading, ready, live, hideIcon));
        continue;
      }
      taken.add(item.key);
      const column = where === 'pool' ? columnOf(phase, item) : where;
      if (!column) {
        continue;
      }
      if (where === 'pool') {
        pool.push(poolCard(item, checkout, phase, reading, ready, live, hideIcon));
        continue;
      }
      const placed = buildCycle(
        item,
        phase,
        column,
        checkout.checkout,
        checkout.reason,
        reading,
        hideIcon,
      );
      const list = buckets.get(column) ?? [];
      list.push(placed);
      buckets.set(column, list);
    }
    pool.sort(byKey);
    return {
      taken,
      pool,
      columns: COLUMN_NAMES.map(name => ({name, cards: ordered(buckets.get(name) ?? [])})),
    };
  }

  function board(): BoardState {
    const live = answers();
    const view = settle();
    const cycles = lay(view.watch);
    return {
      visible: true,
      rows: rows(live),
      settingsOpen,
      stepsStart: live && modelsReady(),
      takeDisabled: !live,
      cards: outside.tickets ? view.cards.filter(card => !cycles.taken.has(card.key)) : [],
      watch: view.watch,
      pool: cycles.pool,
      columns: cycles.columns,
    };
  }

  return {
    board,
    settings,
    openSettings() {
      settingsOpen = true;
    },
    closeSettings() {
      settingsOpen = false;
    },
    chooseAgent(agentId: string) {
      if (!launch.homePath || offered.length === 0 || !offered.includes(agentId)) {
        return;
      }
      if (!canWrite()) {
        return;
      }
      commit(replaceAgent(doc, agentId));
    },
    leaveModel(mode: SkillMode, value: string) {
      if (!recorded() || !canWrite()) {
        return;
      }
      const models = isDoc(doc.models) ? {...doc.models} : {};
      models[mode] = value;
      commit({...doc, models});
    },
    leaveEffort(mode: SkillMode, value: string) {
      const pair = PAIRS[agentOf(doc)];
      if (!pair?.effort || !recorded() || !canWrite()) {
        return;
      }
      const effort = {...modeValues(doc.effort)};
      if (value === '') {
        delete effort[mode];
      } else {
        effort[mode] = value;
      }
      const next: Doc = {...doc};
      if (effort.mechanical === undefined && effort.judgment === undefined) {
        delete next.effort;
      } else {
        next.effort = effort;
      }
      commit(next);
    },
    leaveSpeed(mode: SkillMode, value: string) {
      const pair = PAIRS[agentOf(doc)];
      if (!pair?.speed || !recorded() || !canWrite()) {
        return;
      }
      const speed = {...modeValues(doc.speed)};
      if (value === '') {
        delete speed[mode];
      } else {
        speed[mode] = value;
      }
      const next: Doc = {...doc};
      if (speed.mechanical === undefined && speed.judgment === undefined) {
        delete next.speed;
      } else {
        next.speed = speed;
      }
      commit(next);
    },
    leaveWatch(names: readonly string[]) {
      if (!canWrite()) {
        return;
      }
      const watch = stringList(names);
      const next: Doc = {...doc};
      if (watch.length === 0) {
        delete next.watch;
      } else {
        next.watch = watch;
      }
      commit(next);
    },
    leaveRoots(nextRoots: {arcadia?: string; github?: string}) {
      if (!canWrite()) {
        return;
      }
      const roots: Doc = isDoc(doc.roots) ? {...doc.roots} : {};
      for (const key of ['arcadia', 'github'] as const) {
        const value = nextRoots[key];
        if (value === undefined) {
          continue;
        }
        if (value.trim() === '') {
          delete roots[key];
        } else {
          roots[key] = value.trim();
        }
      }
      const next: Doc = {...doc};
      if (Object.keys(roots).length === 0) {
        delete next.roots;
      } else {
        next.roots = roots;
      }
      commit(next);
    },
    chooseService(key: string, service: string) {
      outside.writeService?.(key, service);
    },
    take(key?: string) {
      if (!key || !answers()) {
        return;
      }
      const view = settle();
      const card = lay(view.watch).pool.find(item => item.key === key);
      if (!card || card.takeDisabled) {
        return;
      }
      const login = outside.login?.();
      if (login === undefined) {
        return;
      }
      outside.writeAssignee?.(key, login);
    },
    spy() {
      if (!answers() || !modelsReady()) {
        return;
      }
      if (!outside.tickets) {
        outside.startStep?.();
        return;
      }
      const view = settle();
      const manager = outside.login?.();
      const reading = sortedTickets();
      for (const card of view.cards) {
        if (card.reason !== '' || !card.checkout) {
          continue;
        }
        const item = reading.find(ticket => ticket.key === card.key);
        if (!item) {
          continue;
        }
        const phase = phaseOf([...item.labels]);
        const where = slotOf(item, phase, manager);
        if (where !== 'cards' && where !== 'pool' && where !== 'hide') {
          continue;
        }
        outside.startStep?.(card.checkout);
      }
      if (manager === undefined) {
        return;
      }
      for (const item of reading) {
        if (!onWatch(item, view.watch) || item.open === false) {
          continue;
        }
        if (item.labels.includes('sdd:cancelled') || phaseOf([...item.labels]) !== null) {
          continue;
        }
        if (item.assignee !== manager) {
          continue;
        }
        outside.writePhase?.(item.key, 'proposing');
      }
    },
  };
}
