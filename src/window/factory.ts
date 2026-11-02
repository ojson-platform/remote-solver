import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';

import {parse, stringify} from 'yaml';

import {rootText} from './checkout.ts';
import {rolesFrom, storedRoles} from './role.ts';
import {
  isDoc,
  stringList,
  type Doc,
  type OverlayGroup,
  type RoleRecord,
  type SettingsState,
  type SkillMode,
} from './types.ts';

const NEEDS_AGENT = 'фабрике ещё нужен агент';
const SILENT_AGENT = 'агент не отвечает';

export {FACTORY_AGENTS} from './types.ts';

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
const EFFORT_WORDS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
const SPEED_WORDS = ['fast'] as const;

export type Factory = {
  agent: string;
  mechanical: string;
  judgment: string;
  effort?: {mechanical: string; judgment: string};
  speed?: {mechanical: string; judgment: string};
};

function textOf(homePath: string | undefined): string | null {
  if (!homePath || !existsSync(homePath)) {
    return null;
  }
  return readFileSync(homePath, 'utf8');
}

export function parseDoc(text: string | null): Doc {
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

function overlayFile(checkout: string): string {
  return path.join(checkout, '.aifactory', 'config.yaml');
}

export function readOverlayDoc(checkout: string): Doc | null {
  const text = textOf(overlayFile(checkout));
  if (text === null) {
    return null;
  }
  return parseDoc(text);
}

function hasKey(doc: Doc | null, key: string): doc is Doc {
  return doc !== null && Object.prototype.hasOwnProperty.call(doc, key);
}

/** An overlay agent uses its own field. Otherwise a present overlay key replaces home. */
function ownOrHome(
  overlay: Doc | null,
  ownAgent: boolean,
  key: 'effort' | 'speed',
  home: Doc,
): unknown {
  if (ownAgent) {
    return overlay?.[key];
  }
  if (hasKey(overlay, key)) {
    return overlay[key];
  }
  return home[key];
}

/** A present slot, including an empty string. Absent means the caller keeps the home id. */
function slotPresent(models: unknown, mode: SkillMode): string | undefined {
  if (!isDoc(models) || !Object.prototype.hasOwnProperty.call(models, mode)) {
    return undefined;
  }
  const value = models[mode];
  return typeof value === 'string' ? value : '';
}

/** Overlay keys replace home keys. An overlay agent does not borrow effort or speed. */
export function mergeFactory(home: Doc, overlay: Doc | null): Factory {
  const overlayAgent =
    overlay && typeof overlay.agent === 'string' && overlay.agent !== '' ? overlay.agent : '';
  const agent = overlayAgent || agentOf(home);
  const pair = PAIRS[agent];
  const factory: Factory = {
    agent,
    mechanical: slotPresent(overlay?.models, 'mechanical') ?? slot(home.models, 'mechanical'),
    judgment: slotPresent(overlay?.models, 'judgment') ?? slot(home.models, 'judgment'),
  };
  const ownAgent = overlayAgent !== '';
  if (pair?.effort) {
    const source = modeValues(ownOrHome(overlay, ownAgent, 'effort', home));
    factory.effort = {
      mechanical: source.mechanical ?? pair.effort.mechanical,
      judgment: source.judgment ?? pair.effort.judgment,
    };
  }
  if (pair?.speed) {
    const source = modeValues(ownOrHome(overlay, ownAgent, 'speed', home));
    factory.speed = {
      mechanical: source.mechanical ?? '',
      judgment: source.judgment ?? '',
    };
  }
  return factory;
}

function missingModel(mechanical: string, judgment: string): string | undefined {
  if (mechanical === '' && judgment === '') {
    return 'нужны модели mechanical и judgment';
  }
  if (mechanical === '') {
    return 'нужна модель mechanical';
  }
  if (judgment === '') {
    return 'нужна модель judgment';
  }
  return undefined;
}

export function modelRow(doc: Doc): {text: string}[] {
  const text = missingModel(slot(doc.models, 'mechanical'), slot(doc.models, 'judgment'));
  return text === undefined ? [] : [{text}];
}

export function agentRows(recorded: boolean, live: boolean): {text: string}[] | undefined {
  if (!recorded) {
    return [{text: NEEDS_AGENT}];
  }
  if (!live) {
    return [{text: SILENT_AGENT}];
  }
  return undefined;
}

export function gapRows(
  checkout: string,
  factory: Factory,
  slots: readonly {mode: SkillMode; id: string}[],
): {text: string}[] {
  const out: {text: string}[] = [];
  const missing = missingModel(factory.mechanical, factory.judgment);
  if (missing !== undefined) {
    out.push({text: `${checkout} · ${missing}`});
  }
  for (const rejected of slots) {
    out.push({
      text: `${checkout} · модель не запускается · ${rejected.mode} · ${rejected.id}`,
    });
  }
  return out;
}

export function rejectedSlots(
  factory: Factory,
  listed: {mechanical: string; judgment: string},
): {mode: SkillMode; id: string}[] {
  const out: {mode: SkillMode; id: string}[] = [];
  if (factory.mechanical !== '' && listed.mechanical !== factory.mechanical) {
    out.push({mode: 'mechanical', id: factory.mechanical});
  }
  if (factory.judgment !== '' && listed.judgment !== factory.judgment) {
    out.push({mode: 'judgment', id: factory.judgment});
  }
  return out;
}

/** Catalog ids that are not the recorded id. No catalog and no agent reject nothing. */
export function catalogRejections(
  factory: Factory,
  catalog: ((agentId: string) => {mechanical: string; judgment: string}) | undefined,
): {mode: SkillMode; id: string}[] {
  if (!catalog || factory.agent === '') {
    return [];
  }
  return rejectedSlots(factory, catalog(factory.agent));
}

/** Both slots are filled and the catalog rejected none of them. */
export function slotsFilled(factory: Factory, rejected: readonly unknown[]): boolean {
  return factory.mechanical !== '' && factory.judgment !== '' && rejected.length === 0;
}

export function takeBlock(
  factory: Factory,
  rejected: boolean,
): {emptyModel: boolean; rejected: boolean} {
  return {
    emptyModel: factory.mechanical === '' || factory.judgment === '',
    rejected,
  };
}

function cleanHome(next: Doc): Doc {
  const clean: Doc = {};
  for (const [key, value] of Object.entries(next)) {
    if (FORBIDDEN.has(key) || value === undefined) {
      continue;
    }
    clean[key] = value;
  }
  return clean;
}

function cleanOverlay(next: Doc): Doc {
  const clean: Doc = {};
  for (const [key, value] of Object.entries(next)) {
    if (
      FORBIDDEN.has(key) ||
      key === 'roots' ||
      key === 'roles' ||
      value === undefined ||
      value === ''
    ) {
      continue;
    }
    clean[key] = value;
  }
  return clean;
}

function settingsOf(doc: Doc, open: boolean): SettingsState {
  const agent = agentOf(doc);
  const pair = PAIRS[agent];
  const effortFile = modeValues(doc.effort);
  const speedFile = modeValues(doc.speed);
  const mechanical = slot(doc.models, 'mechanical');
  const judgment = slot(doc.models, 'judgment');
  const state: SettingsState = {
    open,
    agent,
    models: {
      mechanical: {value: mechanical, needsValue: agent !== '' && mechanical === ''},
      judgment: {value: judgment, needsValue: agent !== '' && judgment === ''},
    },
    watch: stringList(doc.watch),
    roots: {arcadia: rootText(doc, 'arcadia'), github: rootText(doc, 'github')},
    roles: rolesFrom(doc.roles),
  };
  if (pair?.effort) {
    state.effort = {
      mechanical: effortFile.mechanical ?? pair.effort.mechanical,
      judgment: effortFile.judgment ?? pair.effort.judgment,
    };
    state.effortWords = EFFORT_WORDS;
  }
  if (pair?.speed) {
    state.speed = {
      mechanical: speedFile.mechanical ?? '',
      judgment: speedFile.judgment ?? '',
    };
    state.speedWords = SPEED_WORDS;
  }
  return state;
}

function emptyOverlay(): OverlayGroup {
  return {
    file: '.aifactory/config.yaml',
    checkout: '',
    agent: '',
    models: {
      mechanical: {value: '', needsValue: false},
      judgment: {value: '', needsValue: false},
    },
    watch: [],
  };
}

function overlayOf(home: Doc, overlayDoc: Doc, checkout: string): OverlayGroup {
  if (checkout === '') {
    return emptyOverlay();
  }
  const factory = mergeFactory(home, overlayDoc);
  const group: OverlayGroup = {
    file: '.aifactory/config.yaml',
    checkout,
    agent: factory.agent,
    models: {
      mechanical: {
        value: factory.mechanical,
        needsValue: factory.agent !== '' && factory.mechanical === '',
      },
      judgment: {
        value: factory.judgment,
        needsValue: factory.agent !== '' && factory.judgment === '',
      },
    },
    watch: stringList(overlayDoc.watch),
  };
  if (factory.effort) {
    group.effort = factory.effort;
    group.effortWords = EFFORT_WORDS;
  }
  if (factory.speed) {
    group.speed = factory.speed;
    group.speedWords = SPEED_WORDS;
  }
  return group;
}

export function openHome(homePath: string | undefined, offered: readonly string[]) {
  let baseline = textOf(homePath);
  let doc = parseDoc(baseline);

  function adopt(text: string | null): void {
    baseline = text;
    doc = parseDoc(text);
  }

  function recorded(): boolean {
    return Boolean(homePath) && baseline !== null && agentOf(doc) !== '';
  }

  function canWrite(): boolean {
    if (!homePath) {
      return false;
    }
    const disk = textOf(homePath);
    if (disk !== baseline) {
      adopt(disk);
      return false;
    }
    return true;
  }

  function commit(next: Doc): void {
    if (!homePath) {
      return;
    }
    const clean = cleanHome(next);
    const text = stringify(clean);
    writeFileSync(homePath, text);
    baseline = text;
    doc = clean;
  }

  function modelsReady(): boolean {
    return slot(doc.models, 'mechanical') !== '' && slot(doc.models, 'judgment') !== '';
  }

  function chooseAgent(agentId: string): void {
    if (!homePath || offered.length === 0 || !offered.includes(agentId)) {
      return;
    }
    if (agentOf(doc) === agentId) {
      return;
    }
    if (!canWrite()) {
      return;
    }
    commit(replaceAgent(doc, agentId));
  }

  function leaveModel(mode: SkillMode, value: string): void {
    if (!recorded() || !canWrite()) {
      return;
    }
    const models = isDoc(doc.models) ? {...doc.models} : {};
    models[mode] = value;
    commit({...doc, models});
  }

  function leaveEffort(mode: SkillMode, value: string): void {
    const pair = PAIRS[agentOf(doc)];
    if (!pair?.effort || !recorded() || !canWrite()) {
      return;
    }
    const effort = {...modeValues(doc.effort)};
    if (value === '') {
      delete effort[mode];
    } else if ((EFFORT_WORDS as readonly string[]).includes(value)) {
      effort[mode] = value;
    } else {
      return;
    }
    const next: Doc = {...doc};
    if (effort.mechanical === undefined && effort.judgment === undefined) {
      delete next.effort;
    } else {
      next.effort = effort;
    }
    commit(next);
  }

  function leaveSpeed(mode: SkillMode, value: string): void {
    const pair = PAIRS[agentOf(doc)];
    if (!pair?.speed || !recorded() || !canWrite()) {
      return;
    }
    const speed = {...modeValues(doc.speed)};
    if (value === '') {
      delete speed[mode];
    } else if ((SPEED_WORDS as readonly string[]).includes(value)) {
      speed[mode] = value;
    } else {
      return;
    }
    const next: Doc = {...doc};
    if (speed.mechanical === undefined && speed.judgment === undefined) {
      delete next.speed;
    } else {
      next.speed = speed;
    }
    commit(next);
  }

  function leaveWatch(names: readonly string[]): void {
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
  }

  function leaveRoots(nextRoots: {arcadia?: string; github?: string}): void {
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
  }

  function leaveRoles(nextRoles: readonly RoleRecord[]): void {
    if (!canWrite()) {
      return;
    }
    const next: Doc = {...doc};
    if (nextRoles.length === 0) {
      delete next.roles;
    } else {
      next.roles = storedRoles(nextRoles);
    }
    commit(next);
  }

  return {
    doc: () => doc,
    disk: () => parseDoc(textOf(homePath)),
    agent: () => agentOf(doc),
    recorded,
    modelsReady,
    settings: (open: boolean) => settingsOf(doc, open),
    chooseAgent,
    leaveModel,
    leaveEffort,
    leaveSpeed,
    leaveWatch,
    leaveRoots,
    leaveRoles,
  };
}

export function openOverlay(offered: readonly string[]) {
  let checkout = '';
  let baseline: string | null = null;
  let doc: Doc = {};

  function bind(next: string): void {
    checkout = next;
    baseline = textOf(overlayFile(checkout));
    doc = parseDoc(baseline);
  }

  function canWrite(): boolean {
    if (checkout === '') {
      return false;
    }
    const disk = textOf(overlayFile(checkout));
    if (disk !== baseline) {
      baseline = disk;
      doc = parseDoc(disk);
      return false;
    }
    return true;
  }

  function commit(next: Doc): void {
    const clean = cleanOverlay(next);
    const file = overlayFile(checkout);
    mkdirSync(path.dirname(file), {recursive: true});
    const text = stringify(clean);
    writeFileSync(file, text);
    baseline = text;
    doc = clean;
  }

  function chooseAgent(agentId: string): void {
    if (checkout === '' || offered.length === 0 || !offered.includes(agentId)) {
      return;
    }
    if (!canWrite()) {
      return;
    }
    const next = replaceAgent(doc, agentId);
    delete next.roots;
    delete next.roles;
    commit(next);
  }

  function clearAgent(): void {
    if (checkout === '' || !canWrite()) {
      return;
    }
    const next: Doc = {...doc};
    delete next.agent;
    delete next.models;
    delete next.effort;
    delete next.speed;
    commit(next);
  }

  function leaveModel(mode: SkillMode, value: string): void {
    if (checkout === '' || !canWrite()) {
      return;
    }
    const models = isDoc(doc.models) ? {...doc.models} : {};
    if (value === '') {
      delete models[mode];
    } else {
      models[mode] = value;
    }
    const next: Doc = {...doc};
    if (Object.keys(models).length === 0) {
      delete next.models;
    } else {
      next.models = models;
    }
    commit(next);
  }

  function leaveEffort(mode: SkillMode, value: string): void {
    if (checkout === '' || !canWrite()) {
      return;
    }
    const pair = PAIRS[agentOf(doc)];
    if (value !== '' && !pair?.effort) {
      return;
    }
    if (value !== '' && !(EFFORT_WORDS as readonly string[]).includes(value)) {
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
  }

  function leaveSpeed(mode: SkillMode, value: string): void {
    if (checkout === '' || !canWrite()) {
      return;
    }
    const pair = PAIRS[agentOf(doc)];
    if (value !== '' && !pair?.speed) {
      return;
    }
    if (value !== '' && !(SPEED_WORDS as readonly string[]).includes(value)) {
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
  }

  function leaveWatch(names: readonly string[]): void {
    if (checkout === '' || !canWrite()) {
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
  }

  return {
    bind,
    checkout: () => checkout,
    view: (home: Doc) => overlayOf(home, doc, checkout),
    chooseAgent,
    clearAgent,
    leaveModel,
    leaveEffort,
    leaveSpeed,
    leaveWatch,
  };
}
