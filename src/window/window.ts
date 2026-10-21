import {existsSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import path from 'node:path';

import {parse, stringify} from 'yaml';

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
};

export type WindowOutside = {
  /** Whether a recorded agent id still answers. The window asks; it does not start that agent. */
  answers?: (agentId: string) => boolean;
  /** Live model catalog. Choosing an agent does not read it. */
  catalog?: (agentId: string) => {mechanical: string; judgment: string};
  /** Assignee write. This window does not call it: Take that writes an assignee is later. */
  writeAssignee?: () => void;
  /** A step the window's spy would start, in the gathered checkout. */
  startStep?: (checkout?: string) => void;
  /** Open tickets this adapter can see. The window filters them by the watch list. */
  tickets?: () => readonly WindowTicket[];
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

export type BoardState = {
  visible: true;
  rows: {text: string}[];
  settingsOpen: boolean;
  stepsStart: boolean;
  takeDisabled: boolean;
  cards: CardState[];
  watch: string[];
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

  function board(): BoardState {
    const live = answers();
    const view = settle();
    return {
      visible: true,
      rows: rows(live),
      settingsOpen,
      stepsStart: live && modelsReady(),
      takeDisabled: !live,
      cards: outside.tickets ? view.cards : [],
      watch: view.watch,
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
      const card = settle().cards.find(item => item.key === key);
      if (!card || card.takeDisabled) {
        return;
      }
    },
    spy() {
      if (!answers() || !modelsReady()) {
        return;
      }
      if (!outside.tickets) {
        outside.startStep?.();
        return;
      }
      for (const card of settle().cards) {
        if (card.reason === '' && card.checkout) {
          outside.startStep?.(card.checkout);
        }
      }
    },
  };
}
