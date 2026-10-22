import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {homedir} from 'node:os';
import path from 'node:path';

import {parse} from 'yaml';

import {queueOf} from '../machine/queues.ts';

import {
  isDoc,
  stringList,
  type AdapterKind,
  type CardState,
  type Doc,
  type WindowTicket,
} from './types.ts';

const CATALOG_MISSING = 'каталога нет';
const SERVICE_UNNAMED = 'не назван сервис';
const CONFIG_MISSING = 'конфига сервиса нет';
const CONFIG_UNREADABLE = 'конфиг сервиса не читается';
const QUEUE_MISSING = 'очереди нет в конфиге сервиса';

function expandRoot(value: string): string {
  if (value === '~') {
    return homedir();
  }
  if (value.startsWith('~/')) {
    return path.join(homedir(), value.slice(2));
  }
  return value;
}

export function rootText(doc: Doc, kind: 'arcadia' | 'github'): string {
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

export function queueNames(checkout: string): string[] | undefined {
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

export function serviceFile(checkout: string): string {
  return path.join(checkout, 'openspec', 'config.yaml');
}

export type ServiceRead =
  {kind: 'missing'} | {kind: 'broken'; text: string} | {kind: 'doc'; text: string; doc: Doc};

export function readServiceFile(checkout: string): ServiceRead {
  const file = serviceFile(checkout);
  if (!existsSync(file)) {
    return {kind: 'missing'};
  }
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return {kind: 'broken', text: ''};
  }
  try {
    const raw = parse(text);
    if (!isDoc(raw)) {
      return {kind: 'broken', text};
    }
    return {kind: 'doc', text, doc: raw};
  } catch {
    return {kind: 'broken', text};
  }
}

export function serviceBroken(checkout: string): boolean {
  return readServiceFile(checkout).kind === 'broken';
}

export function unreadableRow(checkout: string): {text: string} {
  return {text: `${checkout} · ${CONFIG_UNREADABLE}`};
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

export function openCheckout(ports: {
  kind: AdapterKind;
  home: () => Doc;
  tickets?: () => readonly WindowTicket[];
  writeService?: (key: string, service: string) => void;
}) {
  const {kind, home, tickets, writeService} = ports;

  function sorted(): WindowTicket[] {
    return [...(tickets?.() ?? [])].sort((left, right) =>
      left.key.localeCompare(right.key, undefined, {numeric: true}),
    );
  }

  function unnamed(item: WindowTicket): boolean {
    if (kind === 'github') {
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
    const root = expandRoot(rootText(home(), 'github'));
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
    if (kind === 'github') {
      const root = repoRootOf(item);
      if (!root) {
        return undefined;
      }
      if (service.trim() === '') {
        return root;
      }
      return joinInside(root, service);
    }
    return joinInside(expandRoot(rootText(home(), 'arcadia')), service);
  }

  function onWatch(item: WindowTicket, names: readonly string[]): boolean {
    if (!item.labels.includes('sdd:cycle')) {
      return false;
    }
    if (kind === 'github') {
      return typeof item.repo === 'string' && item.repo !== '' && names.includes(item.repo);
    }
    return typeof item.queue === 'string' && item.queue !== '' && names.includes(item.queue);
  }

  function readWatch(): string[] {
    const names = stringList(home().watch);
    const seen = new Set<string>();
    let grew = true;
    while (grew) {
      grew = false;
      const checkouts = new Set<string>();
      for (const item of sorted()) {
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
    for (const item of sorted()) {
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
    if (kind === 'github') {
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
    if (kind === 'tracker') {
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
      kind === 'tracker'
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
    if (!writeService) {
      return;
    }
    if (kind === 'github') {
      for (const item of sorted()) {
        if (!onWatch(item, names) || item.sddService !== undefined) {
          continue;
        }
        const root = repoRootOf(item);
        const dirs = root ? serviceDirs(root) : [];
        if (dirs.length === 1) {
          writeService(item.key, dirs[0]);
        }
      }
      return;
    }
    for (const item of sorted()) {
      if (!onWatch(item, names) || !unnamed(item)) {
        continue;
      }
      const choices = trackerChoices(item.queue ?? '');
      if (choices.length === 1) {
        writeService(item.key, choices[0]);
      }
    }
  }

  function settle(): {watch: string[]; cards: CardState[]} {
    let watch = readWatch();
    if (tickets) {
      let guard = 0;
      for (;;) {
        const before = sorted()
          .map(item => `${item.key}\0${item.sddService}`)
          .join('\n');
        writeMissingServices(watch);
        watch = readWatch();
        const after = sorted()
          .map(item => `${item.key}\0${item.sddService}`)
          .join('\n');
        guard += 1;
        if (before === after || guard > 8) {
          break;
        }
      }
    }
    const cards = sorted()
      .filter(item => onWatch(item, watch))
      .map(cardOf);
    return {watch, cards};
  }

  function gatheredCheckouts(): string[] {
    if (!tickets) {
      return [];
    }
    const names = readWatch();
    const found: string[] = [];
    for (const item of sorted()) {
      if (!onWatch(item, names)) {
        continue;
      }
      const checkout = gathered(item);
      if (!checkout || found.includes(checkout)) {
        continue;
      }
      found.push(checkout);
    }
    return found;
  }

  return {sorted, gathered, onWatch, cardOf, settle, gatheredCheckouts, serviceBroken};
}
