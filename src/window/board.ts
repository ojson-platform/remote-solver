import {existsSync, readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';

import {HEADINGS} from '../machine/change.ts';
import {isFocusRecord} from '../machine/marker.ts';
import {changeDir} from '../machine/naming.ts';
import {GATE_CLOSES, GATE_PHASES, phaseOf, type Phase} from '../machine/phase.ts';

import {focusLayers} from './focus.ts';
import {
  COLUMN_NAMES,
  GATE_LABEL,
  GATE_STATIONS,
  type CardState,
  type ColumnName,
  type CycleCard,
  type GateStation,
  type PhaseRow,
  type PoolCard,
  type StationDoor,
  type WindowReview,
  type WindowTicket,
} from './types.ts';

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
export function slotOf(
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

export function questionCount(checkout: string | undefined, key: string): number {
  return openCount(checkout, key, 'proposal.md', HEADINGS.openQuestions);
}

export function decisionCount(checkout: string | undefined, key: string): number {
  return openCount(checkout, key, 'design.md', HEADINGS.openDecisions);
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

export function reasonParts(
  item: WindowTicket,
  phase: Phase,
  breakReason: string,
  reading: readonly WindowTicket[],
  questions: number,
  decisions: number,
): string[] {
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
  return parts;
}

function walkFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  const out: string[] = [];
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(abs));
    } else if (entry.isFile()) {
      out.push(abs);
    }
  }
  return out;
}

function specFiles(checkout: string, key: string): {id: string; file: string}[] {
  const specsDir = path.join(checkout, changeDir(key), 'specs');
  const found: {id: string; file: string}[] = [];
  for (const abs of walkFiles(specsDir)) {
    if (!abs.endsWith(`${path.sep}spec.md`)) {
      continue;
    }
    const rel = path.relative(specsDir, abs);
    const id = path.dirname(rel);
    if (id === '.') {
      continue;
    }
    found.push({id, file: path.join(changeDir(key), 'specs', rel)});
  }
  found.sort((left, right) => left.id.localeCompare(right.id));
  return found;
}

function stationOfFile(file: string): ColumnName | null {
  const base = path.basename(file);
  if (base === 'proposal.md') {
    return 'proposing';
  }
  if (base === 'spec.md' || file.includes(`${path.sep}specs${path.sep}`)) {
    return 'specifying';
  }
  if (base === 'design.md') {
    return 'designing';
  }
  if (base === 'tasks.md') {
    return 'tasking';
  }
  if (file !== '') {
    return 'implementing';
  }
  return null;
}

function markedStations(
  threads: readonly {marker?: string | null; file?: string}[] | undefined,
): Set<ColumnName> {
  const found = new Set<ColumnName>();
  for (const thread of threads ?? []) {
    if (thread.marker !== 'note' && thread.marker !== 'out') {
      continue;
    }
    const station = thread.file ? stationOfFile(thread.file) : null;
    if (station) {
      found.add(station);
    }
  }
  return found;
}

function changeFile(checkout: string, key: string, name: string): string | undefined {
  const rel = path.join(changeDir(key), name);
  return existsSync(path.join(checkout, rel)) ? rel : undefined;
}

/** Doors on every station except the plaque. The current station stays the plaque. */
function stationDoors(
  item: WindowTicket,
  column: ColumnName,
  checkout: string | undefined,
  parts: readonly string[],
  marked: ReadonlySet<ColumnName>,
): Partial<Record<ColumnName, StationDoor>> | undefined {
  const doors: Partial<Record<ColumnName, StationDoor>> = {};
  const put = (name: ColumnName, door: StationDoor) => {
    if (name === column) {
      return;
    }
    if (marked.has(name)) {
      door.dot = true;
    }
    doors[name] = door;
  };
  if (checkout) {
    const proposal = changeFile(checkout, item.key, 'proposal.md');
    if (proposal) {
      put('proposing', {kind: 'plan', file: proposal});
    }
    const specs = specFiles(checkout, item.key);
    if (specs.length === 1) {
      put('specifying', {kind: 'spec', file: specs[0]?.file});
    } else if (specs.length > 1) {
      put('specifying', {kind: 'spec', specs});
    }
    const design = changeFile(checkout, item.key, 'design.md');
    if (design) {
      put('designing', {kind: 'design', file: design});
    }
    const tasks = changeFile(checkout, item.key, 'tasks.md');
    if (tasks) {
      put('tasking', {kind: 'tasks', file: tasks});
    }
  }
  if (item.openPullRequests === 1 && item.diff === true) {
    put('implementing', {kind: 'code'});
  }
  if (item.checks === 'green' || item.checks === 'red' || item.checks === 'pending') {
    put('verifying', {kind: 'check', ...(item.checks === 'red' ? {bad: true as const} : {})});
  }
  if (item.open !== false && parts.some(part => part.includes('мерж'))) {
    put('accepting', {kind: 'check'});
  }
  return Object.keys(doors).length > 0 ? doors : undefined;
}

function gateOffOf(labels: readonly string[]): CycleCard['gateOff'] {
  const off: Partial<Record<GateStation, true>> = {};
  for (const name of GATE_STATIONS) {
    if (labels.includes(GATE_LABEL[name])) {
      off[name] = true;
    }
  }
  return Object.keys(off).length > 0 ? off : undefined;
}

function withGates(card: PoolCard, labels: readonly string[]): PoolCard {
  const off = gateOffOf(labels);
  if (off) {
    card.gateOff = off;
  }
  return card;
}

function askText(item: WindowTicket): string | undefined {
  if (!item.labels.includes('sdd:wait-human')) {
    return undefined;
  }
  const list = item.comments ?? [];
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const comment = list[index];
    if (!comment || isFocusRecord(comment.body)) {
      continue;
    }
    return comment.body;
  }
  return undefined;
}

function unansweredText(review: WindowReview | undefined): string | undefined {
  if (!review) {
    return undefined;
  }
  const thread = review.threads.find(item => !item.marker);
  if (thread && thread.lines.length > 0) {
    return thread.lines.join('\n');
  }
  const last = review.conversation?.last;
  if (last && !last.marker && last.body !== '') {
    return last.body;
  }
  return undefined;
}

function phaseText(row: PhaseRow): string {
  if (typeof row === 'number') {
    return String(row);
  }
  if (typeof row === 'string') {
    return row;
  }
  return `${row.done} сделано · ${row.open} открыто`;
}

/** Top and bottom of a plaque. The window reads these lines; it does not write them. */
export function plaqueLines(input: {
  ask?: string;
  gaps?: string;
  unanswered?: string;
  station?: ColumnName;
  phaseRow?: PhaseRow;
  reason?: string;
}): {top?: string; bottom?: string} {
  const phase = input.phaseRow === undefined ? undefined : phaseText(input.phaseRow);
  const check =
    (input.station === 'verifying' || input.station === 'accepting') &&
    (input.phaseRow === 'red' || input.phaseRow === 'green' || input.phaseRow === 'pending')
      ? input.phaseRow
      : undefined;
  let top: string | undefined;
  if (input.ask !== undefined) {
    top = 'ask';
  } else if (input.gaps) {
    top = input.gaps;
  } else if (input.unanswered) {
    top = 'ревью';
  } else if (check) {
    top = check;
  }
  const candidates = [
    top === 'ask' ? input.ask : undefined,
    phase,
    input.reason,
    top === 'ревью' ? input.unanswered : undefined,
  ];
  const bottom = candidates.find(line => line !== undefined && line !== '' && line !== top);
  return {top, bottom};
}

function buildCycle(
  item: WindowTicket,
  phase: Phase,
  column: ColumnName,
  checkout: string | undefined,
  breakReason: string,
  reading: readonly WindowTicket[],
  hideIcon: boolean,
  review: WindowReview | undefined,
): Placed {
  const questions = openCount(checkout, item.key, 'proposal.md', HEADINGS.openQuestions);
  const decisions = openCount(checkout, item.key, 'design.md', HEADINGS.openDecisions);
  const phaseRow = phaseRowOf(column, item, checkout, questions, decisions);
  const parts = reasonParts(item, phase, breakReason, reading, questions, decisions);
  const occasion = parts.length > 0;
  const card: CycleCard = {key: item.key, title: item.title};
  if (occasion) {
    card.occasion = true;
  }
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
  const ask = askText(item);
  if (ask !== undefined) {
    card.ask = ask;
  }
  const unanswered = unansweredText(review);
  if (unanswered !== undefined) {
    card.unanswered = unanswered;
  }
  const doors = stationDoors(item, column, checkout, parts, markedStations(review?.threads));
  if (doors) {
    card.doors = doors;
  }
  const gateOff = gateOffOf(item.labels);
  if (gateOff) {
    card.gateOff = gateOff;
  }
  return {card, occasion};
}

/** A pool card copies the checkout, queue, and choices. A break or two pull requests keeps the column reason. */
function poolCard(
  item: WindowTicket,
  checkout: CardState,
  phase: Phase | null,
  reading: readonly WindowTicket[],
  block: {emptyModel: boolean; rejected: boolean},
  live: boolean,
  hideIcon: boolean,
  review: WindowReview | undefined,
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
  const station = phase ? columnOf(phase, item) : null;
  if (station) {
    card.station = station;
  }
  if (broken || several) {
    card.takeDisabled = true;
    card.alarm = true;
    const placed = buildCycle(
      item,
      phase ?? 'implementing',
      station ?? 'implementing',
      checkout.checkout,
      checkout.reason,
      reading,
      hideIcon,
      review,
    );
    if (placed.card.icon) {
      card.icon = true;
    }
    if (placed.card.reason !== undefined) {
      card.reason = placed.card.reason;
    }
    if (station && placed.card.phaseRow !== undefined) {
      card.phaseRow = placed.card.phaseRow;
    }
    if (station && placed.card.layers) {
      card.layers = placed.card.layers;
    }
    if (station && placed.card.ask) {
      card.ask = placed.card.ask;
    }
    if (station && placed.card.unanswered) {
      card.unanswered = placed.card.unanswered;
    }
    if (station && placed.card.doors) {
      card.doors = placed.card.doors;
    }
    if (station && placed.card.gateOff) {
      card.gateOff = placed.card.gateOff;
    }
    return withGates(card, item.labels);
  }
  if (station && phase) {
    const placed = buildCycle(
      item,
      phase,
      station,
      checkout.checkout,
      '',
      reading,
      hideIcon,
      review,
    );
    if (placed.card.phaseRow !== undefined) {
      card.phaseRow = placed.card.phaseRow;
    }
    if (placed.card.reason !== undefined) {
      card.reason = placed.card.reason;
    }
    if (placed.card.layers) {
      card.layers = placed.card.layers;
    }
    if (placed.card.ask) {
      card.ask = placed.card.ask;
    }
    if (placed.card.unanswered) {
      card.unanswered = placed.card.unanswered;
    }
    if (placed.card.doors) {
      card.doors = placed.card.doors;
    }
    if (placed.card.gateOff) {
      card.gateOff = placed.card.gateOff;
    }
  }
  if (!live || block.rejected || (phase === null && block.emptyModel)) {
    card.takeDisabled = true;
  }
  return withGates(card, item.labels);
}

export function lay(input: {
  reading: readonly WindowTicket[];
  watch: readonly string[];
  manager: string | undefined;
  live: boolean;
  onWatch: (item: WindowTicket, names: readonly string[]) => boolean;
  gathered: (item: WindowTicket) => string | undefined;
  serviceBroken: (checkout: string) => boolean;
  cardOf: (item: WindowTicket) => CardState;
  leading: (key: string) => boolean;
  takeBlock: (checkout: string | undefined) => {emptyModel: boolean; rejected: boolean};
  review?: (key: string) => WindowReview | undefined;
}): {
  taken: Set<string>;
  pool: PoolCard[];
  columns: {name: ColumnName; cards: CycleCard[]}[];
} {
  const reading = input.reading;
  const manager = input.manager;
  const live = input.live;
  const taken = new Set<string>();
  const pool: PoolCard[] = [];
  const buckets = new Map<ColumnName, Placed[]>();
  for (const item of reading) {
    if (!input.onWatch(item, input.watch)) {
      continue;
    }
    const home = input.gathered(item);
    if (home && input.serviceBroken(home)) {
      taken.add(item.key);
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
    const checkout = input.cardOf(item);
    const hideIcon = input.leading(item.key) || item.checks === 'pending';
    const review = input.review?.(item.key);
    if (!phase) {
      taken.add(item.key);
      pool.push(
        poolCard(
          item,
          checkout,
          null,
          reading,
          input.takeBlock(checkout.checkout),
          live,
          hideIcon,
          review,
        ),
      );
      continue;
    }
    taken.add(item.key);
    const column = where === 'pool' ? columnOf(phase, item) : where;
    if (!column) {
      continue;
    }
    if (where === 'pool') {
      pool.push(
        poolCard(
          item,
          checkout,
          phase,
          reading,
          input.takeBlock(checkout.checkout),
          live,
          hideIcon,
          review,
        ),
      );
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
      review,
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
