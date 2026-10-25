import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';

import {plaqueLines} from './board.ts';
import {crossButton, fieldClose, hairline, pill, rootCss, sendMark} from './face.ts';
import {FACTORY_AGENTS} from './factory.ts';
import {
  buildSpine,
  layerForStation,
  reviewGateForLayer,
  type Spine,
  type SpineLayer,
} from './spine.ts';
import {
  COLUMN_NAMES,
  type BoardState,
  type ColumnName,
  type OverlayGroup,
  type PhaseRow,
  type PoolCard,
  type RoleOutcome,
  type RoleRecord,
  type ServiceConfigGroup,
  type SettingsState,
  type SidebarBlock,
  type SkillMode,
  type StationDoor,
  type GateStation,
  isGateStation,
  ROLE_OUTCOMES,
} from './types.ts';

/** The window this page draws and drives. */
type Surface = {
  board: () => BoardState;
  take: (key?: string) => boolean | void;
  spy: () => void;
  sidebar: () => SidebarBlock[];
  spine: () => Spine | undefined;
  answer: (key: string, question: string, reply: string, line?: string) => string | undefined;
  acceptReview: (key: string) => string | undefined;
  shelf: () => {name: string; outcome: RoleOutcome}[];
  settings: () => SettingsState;
  overlay: () => OverlayGroup;
  serviceConfig: () => ServiceConfigGroup;
  openCard: (key: string) => boolean | void;
  openSettings: () => void;
  closeSettings: () => void;
  chooseAgent: (agentId: string) => void;
  leaveModel: (mode: SkillMode, value: string) => void;
  leaveEffort: (mode: SkillMode, value: string) => void;
  leaveSpeed: (mode: SkillMode, value: string) => void;
  leaveWatch: (names: readonly string[]) => void;
  leaveRoots: (next: {arcadia?: string; github?: string}) => void;
  addRole: (role: RoleRecord) => void;
  renameRole: (name: string, next: string) => void;
  chooseRoleOutcome: (name: string, outcome: RoleOutcome) => void;
  setRoleText: (name: string, text: string) => void;
  setRoleLabels: (name: string, labels: readonly string[]) => void;
  removeRole: (name: string) => void;
  drag: (name: string, key: string) => {popup?: string; status?: string} | undefined;
  closeCard: () => void;
  checkouts: () => string[];
  spyNote: () => string;
  openReviewPlace: (file: string, line: number) => string | undefined;
  doorPlace: (file: string) => string | undefined;
  gateMark: (key: string, station: string, side?: boolean) => void;
  lastGate: (key: string, station: string, side?: boolean) => boolean;
  plantQueue: (key: string, name: string) => boolean;
  chooseCheckout: (next: string) => void;
  chooseOverlayAgent: (agentId: string) => void;
  clearOverlayAgent: () => void;
  leaveOverlayModel: (mode: SkillMode, value: string) => void;
  leaveOverlayEffort: (mode: SkillMode, value: string) => void;
  leaveOverlaySpeed: (mode: SkillMode, value: string) => void;
  leaveOverlayWatch: (names: readonly string[]) => void;
  setServiceBase: (value: string) => void;
  setServiceBranchScope: (value: string) => void;
  addServiceQueue: () => void;
  setServiceQueue: (index: number, name: string, description: string) => void;
  removeServiceQueue: (index: number) => void;
  moveServiceQueue: (from: number, to: number) => void;
  addServiceIgnore: (value: string) => void;
  setServiceIgnore: (index: number, value: string) => void;
  removeServiceIgnore: (index: number) => void;
  chooseServiceHook: (action: string, point: string, first: string) => void;
  setServiceHook: (action: string, point: string, values: readonly string[]) => void;
  saveServiceConfig: () => void;
  chooseService: (key: string, service: string) => void;
};

type PageView = {
  popup?: string;
  repair?: string;
  ask?: {key: string; station: string; side: boolean};
  opened: string;
  service: Record<string, string>;
  status?: string;
  show?: string;
  serviceDirty: boolean;
};

const BODY_LIMIT = 262144;

type ActResult = 'see' | 'unknown' | 'conflict';

const FIELD_LABELS = ['sdd:auto-plan', 'sdd:auto-spec', 'sdd:auto-design'] as const;

function escape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function namesOf(value: string | null): string[] {
  return (value ?? '')
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(item => item !== '');
}

function modeOf(value: string | null): SkillMode | undefined {
  if (value === 'mechanical' || value === 'judgment') {
    return value;
  }
  return undefined;
}

function outcomeOf(value: string | null): RoleOutcome | undefined {
  if (value !== null && (ROLE_OUTCOMES as readonly string[]).includes(value)) {
    return value as RoleOutcome;
  }
  return undefined;
}

function intOf(value: string | null): number | undefined {
  if (value === null || !/^\d+$/.test(value)) {
    return undefined;
  }
  return Number(value);
}

function hidden(name: string, value: string): string {
  return `<input type="hidden" name="${escape(name)}" value="${escape(value)}">`;
}

function serviceOptions(choices: readonly string[], current: string | undefined): string {
  const values = [...choices];
  if (current !== undefined && !values.includes(current)) {
    values.push(current);
  }
  const pending = current === undefined;
  const head = `<option disabled${pending ? ' selected' : ''}>—</option>`;
  const body = values
    .map(item => {
      const selected = current === item ? ' selected' : '';
      const label = item === '' ? '' : item;
      return `<option value="${escape(item)}"${selected}>${escape(label)}</option>`;
    })
    .join('');
  return head + body;
}

function chosenService(view: PageView, key: string): string | undefined {
  if (!Object.prototype.hasOwnProperty.call(view.service, key)) {
    return undefined;
  }
  return view.service[key];
}

function options(values: readonly string[], current: string, blank = false): string {
  const items = blank ? ['', ...values] : [...values];
  if (current !== '' && !items.includes(current)) {
    items.push(current);
  }
  return items
    .map(item => {
      const selected = item === current ? ' selected' : '';
      const label = item === '' ? '—' : item;
      return `<option value="${escape(item)}"${selected}>${escape(label)}</option>`;
    })
    .join('');
}

function phaseRow(row: PhaseRow): string {
  if (typeof row === 'number') {
    return `<div class="stat">${row}</div>`;
  }
  if (typeof row === 'string') {
    return `<div class="stat ${escape(row)}">${escape(row)}</div>`;
  }
  return `<div class="stat">${row.done} сделано · ${row.open} открыто</div>`;
}

const DOOR_PATHS: Record<StationDoor['kind'], string> = {
  plan: '<path d="M4.8 2.6h4.1L12.2 5.8V13.4H4.8V2.6z" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8.8 2.8v3.2h3.1" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  spec: '<path d="M3.5 4.5h9M3.5 8h9M3.5 11.5h5.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  design:
    '<path d="M9.2 3.1l3.7 3.7-6.4 6.4H2.8V9.5l6.4-6.4z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
  tasks:
    '<path d="M3.2 4.8l1.2 1.2 2.2-2.3M3.2 9l1.2 1.2 2.2-2.3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.5 4.8h4.3M8.5 9h4.3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  code: '<path d="M6.2 4.8L3.4 8l2.8 3.2M9.8 4.8L12.6 8 9.8 11.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
  check:
    '<path d="M3.5 8.2l3 3.1 6-6.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
};

const WIZARD =
  '<path fill="currentColor" d="M8 0.4 5.05 4.55 5.7 5.35 0.7 3.15 0.15 4.35 5.45 6.85 3.15 15.7 12.5 15.7 10.35 6.95 15.55 4.15 14.85 2.95 10.15 5.45 10.85 4.55Z"/><path fill="currentColor" d="M14.35 1.35h1.05V15.7h-1.05z"/><circle cx="14.87" cy="1.15" r="0.75" fill="currentColor"/>';

function glyph(name: 'play' | 'bang' | StationDoor['kind']): string {
  const body =
    name === 'play'
      ? '<path d="M6.2 4.4v7.2L12 8 6.2 4.4z" fill="currentColor"/>'
      : name === 'bang'
        ? '<circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 4.6v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="8" cy="11.15" r="0.8" fill="currentColor"/>'
        : DOOR_PATHS[name];
  return `<svg viewBox="0 0 16 16" aria-hidden="true">${body}</svg>`;
}

function wizard(): string {
  return `<svg viewBox="0 0 16 16" aria-hidden="true">${WIZARD}</svg>`;
}

function openForm(key: string, body: string): string {
  return `<form class="open" method="post" action="/act">${hidden('act', 'open')}${hidden('key', key)}<button class="face" type="submit">${body}</button></form>`;
}

type Drawn = {
  key: string;
  title: string;
  pool: boolean;
  station?: ColumnName;
  phaseRow?: PhaseRow;
  reason?: string;
  layers?: string;
  ask?: string;
  unanswered?: string;
  takeDisabled?: true;
  alarm?: true;
  choices: string[];
  occasion?: true;
  doors?: Partial<Record<ColumnName, StationDoor>>;
  gateOff?: Partial<Record<GateStation, true>>;
};

function byOccasionThenKey(left: Drawn, right: Drawn): number {
  const occasion = Number(right.occasion === true) - Number(left.occasion === true);
  if (occasion !== 0) {
    return occasion;
  }
  return left.key.localeCompare(right.key, undefined, {numeric: true});
}

function drawnRows(board: BoardState): Drawn[] {
  const taken = board.columns.flatMap(column =>
    column.cards.map(card => ({
      key: card.key,
      title: card.title,
      pool: false as const,
      station: column.name,
      phaseRow: card.phaseRow,
      reason: card.reason,
      layers: card.layers,
      ask: card.ask,
      unanswered: card.unanswered,
      choices: [] as string[],
      occasion: card.occasion,
      doors: card.doors,
      gateOff: card.gateOff,
    })),
  );
  taken.sort(byOccasionThenKey);
  const pool = board.pool.map(card => ({
    key: card.key,
    title: card.title,
    pool: true as const,
    station: card.station,
    phaseRow: card.phaseRow,
    reason: card.reason,
    layers: card.layers,
    ask: card.ask,
    unanswered: card.unanswered,
    takeDisabled: card.takeDisabled,
    alarm: card.alarm,
    choices: card.choices,
    doors: card.doors,
    gateOff: card.gateOff,
  }));
  return [...taken, ...pool];
}

function corner(card: Pick<PoolCard, 'key' | 'takeDisabled' | 'alarm'>): string {
  if (card.alarm) {
    return `<div class="corner"><form method="post" action="/act">${hidden('act', 'repair')}${hidden('key', card.key)}<button class="round bang" type="submit" aria-label="Поломка">${glyph('bang')}</button></form></div>`;
  }
  const off = card.takeDisabled ? ' off' : '';
  const disabled = card.takeDisabled ? ' disabled' : '';
  return `<div class="corner"><form class="take" method="post" action="/take">${hidden('key', card.key)}<button class="round play${off}" type="submit"${disabled} aria-label="Взять">${glyph('play')}</button></form></div>`;
}

function plaque(row: Drawn): string {
  const lines = plaqueLines({
    ask: row.ask,
    gaps: row.layers,
    unanswered: row.unanswered,
    station: row.station,
    phaseRow: row.phaseRow,
    reason: row.reason,
  });
  const top =
    lines.top === undefined
      ? ''
      : `<span class="kicker${lines.top === 'red' ? ' red' : ''}">${escape(lines.top)}</span>`;
  const bottomIsPhase =
    lines.bottom !== undefined &&
    row.phaseRow !== undefined &&
    lines.bottom ===
      (typeof row.phaseRow === 'number'
        ? String(row.phaseRow)
        : typeof row.phaseRow === 'string'
          ? row.phaseRow
          : `${row.phaseRow.done} сделано · ${row.phaseRow.open} открыто`);
  const bottom =
    lines.bottom === undefined
      ? ''
      : bottomIsPhase
        ? phaseRow(row.phaseRow as PhaseRow)
        : `<span class="reason">${escape(lines.bottom)}</span>`;
  const body = `${top}${bottom}` || '<span class="reason">&nbsp;</span>';
  return `<form class="open" method="post" action="/act">${hidden('act', 'open')}${hidden('key', row.key)}<button class="plaque" type="submit">${body}</button></form>`;
}

function doorControl(
  row: Drawn,
  door: StationDoor,
  place: (file: string) => string | undefined,
): string {
  const bad = door.bad ? ' bad' : '';
  const pip = door.dot ? '<span class="pip" aria-hidden="true"></span>' : '';
  const body = `${glyph(door.kind)}${pip}`;
  const label = door.kind;
  if (door.specs && door.specs.length > 1) {
    return `<form class="open" method="post" action="/act">${hidden('act', 'open')}${hidden('key', row.key)}<button class="big${bad}" type="submit" aria-label="${label}">${body}</button></form>`;
  }
  const url = door.file ? place(door.file) : undefined;
  if (!url) {
    return `<button class="big${bad}" type="button" aria-label="${label}">${body}</button>`;
  }
  return `<a class="big${bad}" href="${escape(url)}" aria-label="${label}">${body}</a>`;
}

function aheadOfPlaque(row: Drawn, name: ColumnName): boolean {
  if (!row.station) {
    return false;
  }
  return COLUMN_NAMES.indexOf(name) > COLUMN_NAMES.indexOf(row.station);
}

/** Drafts left open after a click on `target`. Text stays. An empty draft closes, including a second click on its own line. */
export function draftsAfterClick(
  open: readonly {line: string; text: string}[],
  target: string,
): {line: string; text: string}[] {
  const current = open.find(item => item.line === target);
  if (current?.text.trim() === '') {
    return open.filter(item => item.line !== target && item.text.trim() !== '');
  }
  const kept = open.filter(item => item.line === target || item.text.trim() !== '');
  if (current) {
    return kept;
  }
  return [...open.filter(item => item.text.trim() !== ''), {line: target, text: ''}];
}

function dismiss(act: string, label: string): string {
  return `<form method="post" action="/act">${hidden('act', act)}${crossButton(escape(label))}</form>`;
}

function gateControl(row: Drawn, name: GateStation, side: boolean): string {
  const off = row.gateOff?.[name] === true;
  const label = `${off ? 'Поставить' : 'Снять'} гейт ${name}`;
  const mark = off ? '' : wizard();
  const where = side ? hidden('where', 'side') : '';
  return `<form class="gate" data-gate="${name}" method="post" action="/act">${hidden('act', 'gate')}${hidden('key', row.key)}${hidden('station', name)}${where}<button class="${off ? 'tick' : 'stop'}" type="submit" aria-label="${label}">${mark}</button></form>`;
}

function stationsOf(row: Drawn, place: (file: string) => string | undefined): string {
  return COLUMN_NAMES.map(name => {
    if (row.station === name) {
      return `<div class="station" data-station="${name}">${plaque(row)}</div>`;
    }
    const door = row.doors?.[name];
    if (door) {
      return `<div class="station" data-station="${name}">${doorControl(row, door, place)}</div>`;
    }
    if (isGateStation(name) && (!row.station || aheadOfPlaque(row, name))) {
      return `<div class="station" data-station="${name}">${gateControl(row, name, false)}</div>`;
    }
    return `<div class="station" data-station="${name}"><span class="dot" aria-hidden="true"></span></div>`;
  }).join('');
}

function spineSentence(
  model: Spine,
  layer: Exclude<SpineLayer, 'Accept'>,
  place: (file: string, line: number) => string | undefined,
): string {
  const own = model.lines.filter(line => line.layer === layer);
  if (own.length === 0) {
    return '';
  }
  return own
    .map(line => (line.layer === 'Code' ? linkFocusLine(line.raw, place) : escape(line.text)))
    .join('<br>');
}

function reviewReady(model: Spine, gate: NonNullable<Spine['reviewGate']>): boolean {
  if (gate === 'proposed') {
    return model.proposal.present && !model.proposal.questions.some(question => question.open);
  }
  if (gate === 'designed') {
    return (
      model.design.present &&
      !model.design.decisions.split('\n').some(line => line.trimStart().startsWith('- [ ]'))
    );
  }
  return true;
}

/** Escape closes the line field when the caret is inside it. */
export function lineFieldClosesOnEscape(key: string, insideField: boolean): boolean {
  return key === 'Escape' && insideField;
}

/** A row-head click toggles the row when it misses the name and the gate or acceptance control. */
export function headClickToggles(target: {closest: (selector: string) => unknown} | null): boolean {
  if (!target?.closest) {
    return false;
  }
  return !target.closest('.acts') && !target.closest('label');
}

/** The current writing phase offers acceptance where its gate stood. Other rows keep the gate. */
function rowControl(layer: SpineLayer, model: Spine, gate: string, key: string): string {
  const review = reviewGateForLayer(layer);
  const here = model.station !== undefined && layerForStation(model.station) === layer;
  if (here && review) {
    if (model.pull && model.reviewGate === review && reviewReady(model, review)) {
      return acceptForm(key, layer);
    }
    return '';
  }
  return gate;
}

function spineHead(
  layer: SpineLayer,
  model: Spine,
  sentence: string,
  gate: string,
  key: string,
  excerpt = '',
): string {
  const checked = model.open === layer ? ' checked' : '';
  const here =
    model.station && layerForStation(model.station) === layer
      ? ` <span class="here">${escape(model.station)}</span>`
      : '';
  const text = sentence === '' ? '' : `<span class="sentence">${sentence}</span>`;
  const preview = excerpt === '' ? '' : `<span class="excerpt">${escape(excerpt)}</span>`;
  const rest =
    text === '' && preview === ''
      ? ''
      : `<label class="rest" for="spine-${layer}">${text}${preview}</label>`;
  const control = rowControl(layer, model, gate, key);
  const acts = control === '' ? '' : `<div class="acts">${control}</div>`;
  return `<section><input class="spine-pick" type="checkbox" id="spine-${layer}" value="${layer}"${checked}><div class="row"><div class="lead"><label class="layer" for="spine-${layer}"><span class="name">${layer}${here}</span></label>${acts}</div>${rest}</div>`;
}

function spineTail(inner: string): string {
  return `<div class="fold">${inner}</div></section>`;
}

function remarkForm(key: string): string {
  return `<form class="note" method="post" action="/act">${hidden('act', 'answer')}${hidden('key', key)}<label class="draft">Комментарий<textarea name="reply" rows="2" placeholder="Замечание ко всему документу"></textarea>${sendMark()}</label></form>`;
}

function acceptForm(key: string, name: string): string {
  return `<form class="accept" method="post" action="/act">${hidden('act', 'accept-review')}${hidden('key', key)}${pill('Принять', ` aria-label="Принять ${name}"`)}</form>`;
}

function reviewFold(
  key: string,
  model: Spine,
  gate: NonNullable<Spine['reviewGate']>,
  shown: boolean,
): string {
  if (!model.pull) {
    return '';
  }
  const comment = shown || model.reviewGate === gate ? remarkForm(key) : '';
  if (comment === '') {
    return '';
  }
  return `<div class="plan-foot">${comment}</div>`;
}

function lineTemplate(key: string): string {
  return `<template class="line-note-template"><form class="line-note" method="post" action="/act">${hidden('act', 'answer')}${hidden('key', key)}${hidden('line', '')}${hidden('question', '')}<div class="draft"><textarea name="reply" rows="2" placeholder="Комментарий к этой строке" aria-label="Комментарий к строке"></textarea>${sendMark()}</div>${fieldClose()}</form></template>`;
}

function planLine(line: string, pull: boolean, questions: Spine['proposal']['questions']): string {
  const trimmed = line.trim();
  const text = escape(line.trimEnd());
  if (!pull) {
    return `<p class="line">${text}</p>`;
  }
  const question = questions.find(item => item.open && trimmed === `- [ ] ${item.text}`);
  const asked = question ? ` data-question="${escape(question.text)}"` : '';
  return `<button type="button" class="line" data-line="${escape(line.trimEnd())}"${asked}>${text}</button>`;
}

function planLines(
  lines: readonly string[],
  pull: boolean,
  questions: Spine['proposal']['questions'],
): string {
  let gap = false;
  const out: string[] = [];
  for (const line of lines) {
    if (line.trim() === '') {
      if (!gap) {
        out.push('<span class="gap"></span>');
      }
      gap = true;
      continue;
    }
    gap = false;
    out.push(planLine(line, pull, questions));
  }
  return out.join('');
}

function filled(lines: readonly string[]): boolean {
  return lines.some(line => line.trim() !== '');
}

function partsOf(lines: readonly string[]): {heading: string; lines: string[]}[] {
  const parts: {heading: string; lines: string[]}[] = [{heading: '', lines: []}];
  for (const line of lines) {
    const sub = /^###\s+(.+)$/.exec(line.trim());
    if (sub?.[1]) {
      parts.push({heading: sub[1], lines: []});
      continue;
    }
    parts.at(-1)?.lines.push(line);
  }
  return parts.filter(part => filled(part.lines));
}

function proseBlock(section: Spine['proposal']['sections'][number], model: Spine): string {
  const parts = partsOf(section.lines);
  if (parts.length === 0) {
    return '';
  }
  const inner = parts
    .map(part => {
      const head = part.heading === '' ? '' : `<h4>${escape(part.heading)}</h4>`;
      return `${head}${planLines(part.lines, model.pull, model.proposal.questions)}`;
    })
    .join('');
  return `<section class="plan-section"><h3>${escape(section.heading)}</h3>${inner}</section>`;
}

function questionsBlock(section: Spine['proposal']['sections'][number], model: Spine): string {
  if (!filled(section.lines)) {
    return '';
  }
  const open = model.proposal.questions.some(question => question.open);
  const hold = open
    ? '<p class="hold">План принимается, когда открытых вопросов не останется.</p>'
    : '';
  return `<section class="plan-section questions"><h3>${escape(section.heading)}</h3>${hold}${planLines(section.lines, model.pull, model.proposal.questions)}</section>`;
}

function planDocument(key: string, model: Spine): string {
  const body = model.proposal.sections
    .map(section =>
      section.heading === 'Open questions'
        ? questionsBlock(section, model)
        : proseBlock(section, model),
    )
    .join('');
  const template = model.pull ? lineTemplate(key) : '';
  return `<div class="doc">${body}</div>${template}`;
}

function capabilityHtml(item: Spine['capabilities'][number], open: boolean): string {
  const reqs = item.requirements
    .map(req => {
      const added = req.added
        .map(sentence => `<p class="mark"><b>добавлено</b> ${escape(sentence)}</p>`)
        .join('');
      const scenes = req.scenarios
        .map(scene => {
          const when =
            scene.when === '' ? '' : `<p class="scene"><b>WHEN</b> ${escape(scene.when)}</p>`;
          const then =
            scene.then === '' ? '' : `<p class="scene"><b>THEN</b> ${escape(scene.then)}</p>`;
          return `<p class="scene-name">${escape(scene.name)}</p>${when}${then}`;
        })
        .join('');
      const prose = req.prose === '' ? '' : `<p>${escape(req.prose)}</p>`;
      return `<p class="crumb">${escape(req.kind)}</p><h3>${escape(req.title)}</h3>${prose}${added}${scenes}`;
    })
    .join('');
  return `<details class="cap" id="cap-${escape(item.id)}"${open ? ' open' : ''}><summary>${escape(item.id)}</summary>${reqs}</details>`;
}

function taskHtml(task: Spine['tasks'][number]): string {
  const jumps = task.scenarios
    .map(scene => {
      const cap = scene.capability === '' ? '' : ` data-cap="${escape(scene.capability)}"`;
      return `<button type="button" class="jump"${cap}>${escape(scene.name)}</button>`;
    })
    .join('');
  return `<details class="task"><summary>${escape(task.id)} <span class="quiet">${task.done ? 'готово' : 'открыто'}</span></summary>${jumps}</details>`;
}

function spineHtml(
  model: Spine,
  row: Drawn,
  place: (file: string, line: number) => string | undefined,
  codeExtra: string,
  unanswered: boolean,
): string {
  const gate = (layer: SpineLayer, station: GateStation) =>
    layer === 'Plan' || layer === 'Specify' || layer === 'Design' || layer === 'Accept'
      ? gateControl(row, station, true)
      : '';
  const change = `${spineHead('Change', model, spineSentence(model, 'Change', place), '', row.key)}${spineTail(`<p>Двери читают ${escape(model.readPath)}.</p>`)}`;
  const planBody = model.proposal.present ? planDocument(row.key, model) : '';
  const planInner = `${planBody}${reviewFold(row.key, model, 'proposed', model.proposal.present)}`;
  const planSentence = model.proposal.excerpt === '' ? spineSentence(model, 'Plan', place) : '';
  const plan = `${spineHead('Plan', model, planSentence, gate('Plan', 'proposing'), row.key, model.proposal.excerpt)}${spineTail(planInner)}`;
  const specifyInner = `${model.capabilities
    .map((item, index) => capabilityHtml(item, index === 0))
    .join('')}${reviewFold(row.key, model, 'specified', model.capabilities.length > 0)}`;
  const specify = `${spineHead('Specify', model, spineSentence(model, 'Specify', place), gate('Specify', 'specifying'), row.key)}${spineTail(specifyInner)}`;
  const designBody = model.design.present
    ? `${model.design.boundary === '' ? '' : `<h3>Verification boundary</h3><p>${escape(model.design.boundary)}</p>`}${model.design.approach === '' ? '' : `<h3>Approach</h3><p>${escape(model.design.approach)}</p>`}${model.design.rejected.map(line => `<p>${escape(line)}</p>`).join('')}${model.design.decisions === '' ? '' : `<h3>Open decisions</h3><p>${escape(model.design.decisions)}</p>`}`
    : '';
  const designInner = `${designBody}${reviewFold(row.key, model, 'designed', model.design.present)}`;
  const design = `${spineHead('Design', model, spineSentence(model, 'Design', place), gate('Design', 'designing'), row.key)}${spineTail(designInner)}`;
  const tasks = `${spineHead('Tasks', model, spineSentence(model, 'Tasks', place), '', row.key)}${spineTail(model.tasks.map(task => taskHtml(task)).join(''))}`;
  const tone =
    model.checks === 'проверки красные'
      ? ' class="wait"'
      : model.checks === 'обязательные проверки зелёные'
        ? ' class="ok"'
        : '';
  const codeBits = [
    model.checks === undefined ? '' : `<p${tone}>${escape(model.checks)}</p>`,
    model.diff ? '<p>Diff есть</p>' : '',
    model.rest.map(line => `<p>${linkFocusLine(line, place)}</p>`).join(''),
    model.pull && !unanswered ? '<p>Открытых тредов нет.</p>' : '',
    codeExtra,
  ].join('');
  const code = `${spineHead('Code', model, spineSentence(model, 'Code', place), '', row.key)}${spineTail(codeBits)}`;
  const acceptNote = model.accept.startsWith('На приёмке машина')
    ? 'Метка sdd:auto-merge стоит. Машина мержит сама, когда проверки зелёные.'
    : 'Метки sdd:auto-merge нет. Машина мержит только с этой меткой.';
  const accept = `${spineHead('Accept', model, escape(model.accept), gate('Accept', 'accepting'), row.key)}${spineTail(`<p>${escape(acceptNote)}</p>`)}`;
  return `<div class="spine">${change}${plan}${specify}${design}${tasks}${code}${accept}</div>`;
}

function verbs(row: Drawn, roles: readonly {name: string; outcome: RoleOutcome}[]): string {
  if (roles.length === 0) {
    return '';
  }
  const buttons = roles
    .map(
      role =>
        `<form method="post" action="/act">${hidden('act', 'drag')}${hidden('name', role.name)}${hidden('key', row.key)}<button class="verb" type="submit"><span>${escape(role.name)}</span><small>${escape(role.outcome)}</small></button></form>`,
    )
    .join('');
  return `<div class="verbs">${buttons}</div>`;
}

function ticketRow(row: Drawn, open: boolean, place: (file: string) => string | undefined): string {
  const openClass = open ? ' is-open' : '';
  const poolClass = row.pool ? ' pool' : '';
  const drag = row.pool && !row.takeDisabled ? ' draggable="true"' : '';
  const play = row.pool ? corner(row) : '';
  return [
    `<article class="ticket${poolClass}${openClass}"${drag} data-key="${escape(row.key)}">`,
    '<div class="stations">',
    `<div class="gutter${poolClass}">`,
    openForm(
      row.key,
      `<span class="ident"><span class="key">${escape(row.key)}</span><h2 class="title">${escape(row.title)}</h2></span>`,
    ),
    play,
    '</div>',
    stationsOf(row, place),
    '</div>',
    '</article>',
  ].join('');
}

function head(): string {
  const names = COLUMN_NAMES.map(name => `<span class="phase">${escape(name)}</span>`).join('');
  return `<div class="head"><span></span>${names}</div>`;
}

function findCard(board: BoardState, key: string): {key: string; title: string} | undefined {
  return (
    board.pool.find(card => card.key === key) ??
    board.columns.flatMap(column => column.cards).find(card => card.key === key)
  );
}

function linkFocusLine(
  line: string,
  place: (file: string, line: number) => string | undefined,
): string {
  const matched = /^(\s*)Code(\s+)(\S.*)$/.exec(line);
  if (!matched) {
    return escape(line);
  }
  const rest = matched[3] ?? '';
  if (rest.trim() === 'solid') {
    return escape(line);
  }
  const gaps = rest.split(';');
  const rendered = gaps
    .map((gap, index) => {
      const bits = /^(\s*)(.*?)(\s*)$/.exec(gap);
      const lead = bits?.[1] ?? '';
      const core = bits?.[2] ?? '';
      const trail = bits?.[3] ?? '';
      const found = /^(\S+):(\d+)$/.exec(core);
      const prefix = index === 0 ? '' : ';';
      if (!found?.[1] || found[2] === undefined) {
        return prefix + escape(gap);
      }
      const url = place(found[1], Number(found[2]));
      const token =
        url === undefined || url === ''
          ? escape(core)
          : `<a href="${escape(url)}">${escape(core)}</a>`;
      return prefix + escape(lead) + token + escape(trail);
    })
    .join('');
  return `${escape(matched[1] ?? '')}Code${escape(matched[2] ?? ' ')}${rendered}`;
}

function linkFocus(
  body: string,
  place: (file: string, line: number) => string | undefined,
): string {
  return body
    .split('\n')
    .map(line => linkFocusLine(line, place))
    .join('\n');
}

function sidebarBlock(
  block: SidebarBlock,
  place: (file: string, line: number) => string | undefined,
): string {
  if (block.kind === 'reason') {
    return `<section class="block"><h3>повод</h3><p>${escape(block.line)}</p></section>`;
  }
  if (block.kind === 'ask') {
    return `<section class="block"><h3>ask</h3><pre>${escape(block.body)}</pre></section>`;
  }
  if (block.kind === 'focus') {
    return `<section class="block"><h3>фокус</h3><pre>${linkFocus(block.body, place)}</pre></section>`;
  }
  if (block.kind === 'unanswered') {
    const threads = (block.threads ?? [])
      .map(thread => `<pre>${thread.lines.map(line => escape(line)).join('\n')}</pre>`)
      .join('');
    const comment = block.comment === undefined ? '' : `<pre>${escape(block.comment)}</pre>`;
    return `<section class="block"><h3>ревью</h3>${threads}${comment}</section>`;
  }
  if ('line' in block) {
    return `<section class="block"><h3>хук</h3><p>${escape(block.line)}</p></section>`;
  }
  const points = block.points
    .map(
      point =>
        `<li><span class="pair">${escape(point.action)} · ${escape(point.point)}</span><pre>${escape(point.paragraph)}</pre></li>`,
    )
    .join('');
  return `<section class="block"><h3>хук</h3><ol>${points}</ol></section>`;
}

function drawer(
  row: Drawn,
  blocks: readonly SidebarBlock[],
  roles: readonly {name: string; outcome: RoleOutcome}[],
  place: (file: string, line: number) => string | undefined,
  model: Spine,
): string {
  const top = blocks
    .filter(block => block.kind === 'reason' || block.kind === 'ask')
    .map(block => sidebarBlock(block, place))
    .join('');
  const codeExtra = blocks
    .filter(block => block.kind === 'unanswered' || block.kind === 'hook')
    .map(block => sidebarBlock(block, place))
    .join('');
  const spine = spineHtml(
    model,
    row,
    place,
    codeExtra,
    blocks.some(block => block.kind === 'unanswered'),
  );
  return `<aside class="sidebar" data-key="${escape(row.key)}"><header><div><p class="kicker">${escape(row.key)}</p><p class="full">${escape(row.title)}</p></div>${dismiss('close-card', 'Закрыть')}</header><div class="side-scroll">${top}${verbs(row, roles)}${spine}</div></aside>`;
}

function askDialog(ask: {key: string; station: string; side: boolean}): string {
  const where = ask.side ? hidden('where', 'side') : '';
  const yes = `<form method="post" action="/act">${hidden('act', 'gate')}${hidden('key', ask.key)}${hidden('station', ask.station)}${hidden('sure', '1')}${where}${pill('Снять')}</form>`;
  return `<div class="veil popup-veil"><div class="popup ask" role="dialog" aria-label="Без контроля"><header><h2>Без контроля</h2>${dismiss('close-ask', 'Закрыть')}</header><p>Снять последний гейт? Тикет останется без контроля.</p>${yes}</div></div>`;
}

function repairField(row: Drawn, service: string | undefined): string {
  if (row.reason === 'не назван сервис' && row.choices.length >= 2) {
    return `<form class="choice" method="post" action="/act">${hidden('act', 'choose-service')}${hidden('key', row.key)}<label>сервис</label><select name="service" onchange="this.form.submit()">${serviceOptions(row.choices, service)}</select></form>`;
  }
  if (row.reason === 'конфига сервиса нет') {
    return `<form method="post" action="/act">${hidden('act', 'plant-queue')}${hidden('key', row.key)}<label>очередь</label><input name="name">${pill('Создать')}</form>`;
  }
  return '';
}

function repairPopup(row: Drawn, service: string | undefined): string {
  const reason = row.reason ?? '';
  return `<div class="veil popup-veil"><div class="popup repair" role="dialog" aria-label="Поломка"><header><h2>${escape(reason)}</h2>${dismiss('close-repair', 'Закрыть')}</header>${repairField(row, service)}</div></div>`;
}

function modeFields(
  modelAct: string,
  effortAct: string,
  speedAct: string,
  models: {
    mechanical: {value: string; needsValue: boolean};
    judgment: {value: string; needsValue: boolean};
  },
  effort: {mechanical: string; judgment: string} | undefined,
  effortWords: readonly string[] | undefined,
  speed: {mechanical: string; judgment: string} | undefined,
  speedWords: readonly string[] | undefined,
): string {
  const model = (mode: SkillMode, field: {value: string; needsValue: boolean}) => {
    const warn = field.needsValue ? ' class="warn"' : '';
    const note = field.needsValue ? '<span class="note">нужна модель</span>' : '';
    return `<form method="post" action="/act"><label${warn}>${mode}${note}</label>${hidden('act', modelAct)}${hidden('mode', mode)}<input name="value" value="${escape(field.value)}" onchange="this.form.submit()"></form>`;
  };
  const word = (fieldAct: string, mode: SkillMode, current: string, words: readonly string[]) =>
    `<form method="post" action="/act"><label>${fieldAct.endsWith('speed') ? 'скорость' : 'усилие'} ${mode}</label>${hidden('act', fieldAct)}${hidden('mode', mode)}<select name="value" onchange="this.form.submit()">${options(words, current, true)}</select></form>`;
  const efforts =
    effort && effortWords
      ? word(effortAct, 'mechanical', effort.mechanical, effortWords) +
        word(effortAct, 'judgment', effort.judgment, effortWords)
      : '';
  const speeds =
    speed && speedWords
      ? word(speedAct, 'mechanical', speed.mechanical, speedWords) +
        word(speedAct, 'judgment', speed.judgment, speedWords)
      : '';
  return (
    model('mechanical', models.mechanical) + model('judgment', models.judgment) + efforts + speeds
  );
}

function roleEditor(settings: SettingsState): string {
  const roles = settings.roles;
  const rows = roles
    .map(role => {
      const labels =
        role.outcome === 'ticket-fields'
          ? `<form method="post" action="/act">${hidden('act', 'set-role-labels')}${hidden('name', role.name)}<fieldset><legend>метки</legend>${FIELD_LABELS.map(
              label =>
                `<label class="check"><input type="checkbox" name="labels" value="${escape(label)}"${role.labels?.includes(label) ? ' checked' : ''} onchange="this.form.submit()">${escape(label)}</label>`,
            ).join('')}</fieldset></form>`
          : '';
      return `<div class="role">${[
        `<form method="post" action="/act">${hidden('act', 'rename-role')}${hidden('name', role.name)}<label>имя</label><input name="next" value="${escape(role.name)}" onchange="this.form.submit()"></form>`,
        `<form method="post" action="/act">${hidden('act', 'choose-role-outcome')}${hidden('name', role.name)}<label>исход</label><select name="outcome" onchange="this.form.submit()">${options(ROLE_OUTCOMES, role.outcome)}</select></form>`,
        `<form method="post" action="/act">${hidden('act', 'set-role-text')}${hidden('name', role.name)}<label>текст</label><textarea name="text" onchange="this.form.submit()">${escape(role.text)}</textarea></form>`,
        labels,
        `<form method="post" action="/act">${hidden('act', 'remove-role')}${hidden('name', role.name)}${hairline('Удалить')}</form>`,
      ].join('')}</div>`;
    })
    .join('');
  const add = `<form class="add" method="post" action="/act">${hidden('act', 'choose-agent')}<label>агент</label><select name="agent" onchange="this.form.submit()">${options(FACTORY_AGENTS, settings.agent)}</select><label>новая роль</label><input name="name" placeholder="имя"><select name="outcome">${options(ROLE_OUTCOMES, 'html')}</select><textarea name="text" placeholder="текст"></textarea>${pill('Добавить')}</form>`;
  return `<div class="roles"><h3>Роли</h3>${rows}${add}</div>`;
}

function userBlock(settings: SettingsState): string {
  return `<section class="group"><h3>Дом</h3>${modeFields(
    'leave-model',
    'leave-effort',
    'leave-speed',
    settings.models,
    settings.effort,
    settings.effortWords,
    settings.speed,
    settings.speedWords,
  )}<form method="post" action="/act"><label>список наблюдения</label>${hidden('act', 'leave-watch')}<textarea name="names" onchange="this.form.submit()">${escape(settings.watch.join('\n'))}</textarea></form><form class="pair" method="post" action="/act"><label>arcadia</label>${hidden('act', 'leave-roots')}<input name="arcadia" value="${escape(settings.roots.arcadia)}"><label>github</label><input name="github" value="${escape(settings.roots.github)}"></form>${roleEditor(settings)}</section>`;
}

function overlayBlock(group: OverlayGroup, checkouts: readonly string[]): string {
  if (group.checkout === '') {
    const picks = checkouts
      .map(
        checkout =>
          `<form method="post" action="/act">${hidden('act', 'choose-checkout')}${hidden('checkout', checkout)}${hairline(escape(checkout))}</form>`,
      )
      .join('');
    return `<section class="group"><h3>${escape(group.file)}</h3><p class="empty">Чекаут ещё не выбран.</p>${picks}</section>`;
  }
  const agent = `<form method="post" action="/act"><label>агент слоя</label>${hidden('act', 'choose-overlay-agent')}<select name="agent" onchange="this.form.submit()">${options(FACTORY_AGENTS, group.agent, true)}</select></form>`;
  return `<section class="group"><h3>${escape(group.file)}</h3><p class="path">${escape(group.checkout)}</p>${agent}${modeFields(
    'leave-overlay-model',
    'leave-overlay-effort',
    'leave-overlay-speed',
    group.models,
    group.effort,
    group.effortWords,
    group.speed,
    group.speedWords,
  )}<form method="post" action="/act"><label>watch слоя</label>${hidden('act', 'leave-overlay-watch')}<textarea name="names" onchange="this.form.submit()">${escape(group.watch.join('\n'))}</textarea></form></section>`;
}

function serviceUnwritable(group: ServiceConfigGroup): boolean {
  if (group.queues?.warning === true) {
    return true;
  }
  if (group.queues?.items.some(item => item.warning === true) === true) {
    return true;
  }
  return group.ignoreComments?.some(item => item.warning === true) === true;
}

function serviceNotes(group: ServiceConfigGroup, dirty: boolean): string {
  const dirtyLine = dirty ? '<p>сервис не записан</p>' : '';
  const blocked = serviceUnwritable(group) ? '<p>правку нельзя записать</p>' : '';
  return dirtyLine + blocked;
}

function serviceBlock(group: ServiceConfigGroup, dirty: boolean): string {
  const head = `<h3>${escape(group.file)}</h3>${group.checkout === '' ? '' : `<p class="path">${escape(group.checkout)}</p>`}`;
  if (group.line) {
    return `<section class="group">${head}<p class="warn">${escape(group.line)}</p></section>`;
  }
  if (group.queues === undefined || group.checkout === '') {
    return `<section class="group">${head}<p class="empty">Группа пуста, пока не выбран чекаут.</p></section>`;
  }
  const queues = queueEditor(group.queues.items);
  const ignore = (group.ignoreComments ?? [])
    .map((item, index) => {
      const locked = item.removeOnly ? ' readonly' : '';
      const warn = item.warning ? ' warn' : '';
      return `<div class="row${warn}"><form method="post" action="/act">${hidden('act', 'set-service-ignore')}${hidden('index', String(index))}<input name="value" value="${escape(item.value)}"${locked} onchange="this.form.submit()"></form><form method="post" action="/act">${hidden('act', 'remove-service-ignore')}${hidden('index', String(index))}${hairline('×')}</form></div>`;
    })
    .join('');
  const hooks = (group.hooks ?? [])
    .map(hook => {
      const areas = hook.values
        .map(
          value =>
            `<textarea name="values" onchange="this.form.submit()">${escape(value)}</textarea>`,
        )
        .join('');
      return `<form method="post" action="/act">${hidden('act', 'set-service-hook')}${hidden('hook-action', hook.action)}${hidden('point', hook.point)}<label>${escape(hook.action)} · ${escape(hook.point)}</label>${areas}</form>`;
    })
    .join('');
  const choices = (group.hookChoices ?? [])
    .map(
      choice =>
        `<option value="${escape(`${choice.action}\t${choice.point}`)}">${escape(`${choice.action} · ${choice.point}`)}</option>`,
    )
    .join('');
  const addHook =
    choices === ''
      ? ''
      : `<select name="choice">${choices}</select><input name="first" placeholder="первый абзац" onchange="this.form.submit()">${hairline('Добавить хук')}`;
  const canSave = dirty && group.save && !serviceUnwritable(group);
  return `<section class="group">${head}<h4>очереди</h4>${queues(addHook)}<form method="post" action="/act">${hidden('act', 'add-service-queue')}${hairline('Очередь')}</form><form method="post" action="/act">${hidden('act', 'set-service-base')}<label>base</label><input name="value" value="${escape(group.base ?? '')}" onchange="this.form.submit()"></form><form method="post" action="/act">${hidden('act', 'set-service-branch')}<label>branch scope</label><input name="value" value="${escape(group.branchScope ?? '')}" onchange="this.form.submit()"></form><h4>ignore-comments</h4>${ignore}<form method="post" action="/act">${hidden('act', 'add-service-ignore')}<input name="value" placeholder="строка">${hairline('Добавить')}</form><h4>хуки</h4>${hooks}${serviceNotes(group, dirty)}<form method="post" action="/act">${hidden('act', 'save-service')}${pill('Записать сервис', canSave ? '' : ' disabled')}</form></section>`;
}

function queueEditor(
  items: readonly {name: string; description: string; warning?: true}[],
): (addHook: string) => string {
  return addHook => {
    const shells = items
      .map((_, index) =>
        [
          `<form class="shell" id="up-${index}" method="post" action="/act">${hidden('act', 'move-service-queue')}${hidden('from', String(index))}${hidden('to', String(index - 1))}</form>`,
          `<form class="shell" id="down-${index}" method="post" action="/act">${hidden('act', 'move-service-queue')}${hidden('from', String(index))}${hidden('to', String(index + 1))}</form>`,
          `<form class="shell" id="remove-${index}" method="post" action="/act">${hidden('act', 'remove-service-queue')}${hidden('index', String(index))}</form>`,
        ].join(''),
      )
      .join('');
    const rows = items
      .map((item, index) => {
        const warn = item.warning ? ' warn' : '';
        const last = index === items.length - 1;
        return `<div class="row${warn}"><input name="name" value="${escape(item.name)}"><input name="description" value="${escape(item.description)}">${hairline('↑', ` form="up-${index}"${index === 0 ? ' disabled' : ''}`)}${hairline('↓', ` form="down-${index}"${last ? ' disabled' : ''}`)}${hairline('×', ` form="remove-${index}"`)}</div>`;
      })
      .join('');
    return `${shells}<form class="queue-edit pair" method="post" action="/act">${hidden('act', 'set-service-queue')}${rows}${addHook}</form>`;
  };
}

function closeName(dirty: boolean): string {
  return dirty ? 'Закрыть без записи' : 'Закрыть';
}

function settingsSheet(
  settings: SettingsState,
  overlay: OverlayGroup,
  service: ServiceConfigGroup,
  paths: readonly string[],
  dirty: boolean,
): string {
  return `<div class="veil"><div class="sheet" role="dialog" aria-label="Настройки"><header><h2>Настройки</h2>${dismiss('close-settings', closeName(dirty))}</header><div class="blocks">${userBlock(settings)}<div class="stack">${overlayBlock(overlay, paths)}${serviceBlock(service, dirty)}</div></div></div></div>`;
}

function popupOf(text: string): string {
  const body = text.trimStart().startsWith('<')
    ? `<iframe sandbox srcdoc="${escape(text)}" title="popup"></iframe>`
    : `<pre>${escape(text)}</pre>`;
  return `<div class="veil popup-veil"><div class="popup" role="dialog" aria-label="Роль"><header><h2>Роль</h2>${dismiss('close-popup', 'Закрыть')}</header>${body}</div></div>`;
}

function banners(rows: readonly {text: string}[]): string {
  if (rows.length === 0) {
    return '';
  }
  return `<div class="banners">${rows.map(row => `<p>${escape(row.text)}</p>`).join('')}</div>`;
}

const style = `
${rootCss}
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--ink);
    font: 13px/1.35 ui-sans-serif, system-ui, sans-serif;
  }
  button, input, select, textarea { font: inherit; color: inherit; }
  a { color: var(--brass); }
  button { cursor: pointer; }
  button:disabled { cursor: not-allowed; }
  button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
    outline: 2px solid var(--brass);
    outline-offset: 2px;
  }
  .app { height: 100vh; width: 100%; overflow: hidden; display: flex; flex-direction: column; }
  .top {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 18px;
    border-bottom: 1px solid var(--line);
    background: rgba(14, 13, 11, 0.92);
  }
  .word {
    margin: 0;
    font: 600 16px/1 ui-sans-serif, system-ui, sans-serif;
  }
  .lamp { margin: 0; color: var(--muted); font-size: 12px; }
  .lamp.on { color: var(--green); }
  .spy {
    margin: 0;
    flex: 1;
    min-width: 0;
    color: var(--muted);
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .top form { margin-left: auto; }
  .cmd, .quiet {
    border: 0;
    border-radius: 999px;
    padding: 8px 14px;
  }
  .cmd { background: var(--brass); color: var(--ink-brass); font-weight: 650; }
  .spine form.accept .cmd {
    border-radius: 8px;
    padding: 4px 10px;
    font-size: 12px;
  }
  .cmd:hover { background: #f0cb86; }
  .quiet { background: transparent; color: var(--ink); border: 1px solid var(--line); }
  .banners { display: flex; flex-direction: column; gap: 6px; padding: 10px 18px 0; }
  .banners p {
    margin: 0;
    padding: 8px 12px;
    border-radius: 8px;
    background: rgba(230, 179, 90, 0.12);
    color: #f0cb86;
  }
  .stage { flex: 1; min-height: 0; min-width: 0; display: flex; }
  .board {
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
  }
  .head, .stations {
    display: grid;
    grid-template-columns: 252px repeat(7, minmax(0, 1fr));
    gap: 8px;
    align-items: center;
  }
  .phase {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: center;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .gutter, .station { min-width: 0; position: relative; }
  .gutter {
    background: rgba(255, 255, 255, 0.035);
    border-radius: 8px;
    box-shadow: inset 0 0 0 1px var(--line);
    padding: 8px 10px;
    min-height: 52px;
  }
  .ticket.is-open .gutter { box-shadow: inset 0 0 0 1px rgba(230, 179, 90, 0.45); }
  .station.over { box-shadow: inset 0 0 0 1px var(--brass); border-radius: 8px; }
  .ident { padding-right: 28px; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .key {
    font: 600 12px/1.2 ui-monospace, "SF Mono", Menlo, monospace;
    color: var(--brass);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .gutter.pool .key { color: var(--muted); }
  .title {
    margin: 0;
    font-size: 13px;
    font-weight: 560;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .face {
    all: unset;
    display: block;
    width: 100%;
    min-width: 0;
    cursor: pointer;
    text-align: left;
  }
  .corner { position: absolute; top: 8px; right: 8px; }
  .round {
    width: 22px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: rgba(230, 179, 90, 0.12);
    box-shadow: inset 0 0 0 1px rgba(230, 179, 90, 0.45);
    color: var(--brass);
  }
  .round.off {
    background: transparent;
    color: var(--muted);
    box-shadow: inset 0 0 0 1px rgba(244, 240, 230, 0.16);
  }
  .round svg { width: 14px; height: 14px; display: block; }
  .station { display: flex; align-items: center; justify-content: center; min-height: 36px; }
  .dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: rgba(244, 240, 230, 0.55);
  }
  .tick, .stop {
    border: 0;
    padding: 0;
    background: transparent;
    color: var(--brass);
    cursor: pointer;
  }
  .tick {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1.5px rgba(244, 240, 230, 0.42);
  }
  .stop { width: 18px; height: 18px; display: grid; place-items: center; }
  .stop svg { width: 18px; height: 18px; display: block; }
  .big {
    width: 32px;
    height: 32px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    display: grid;
    place-items: center;
    position: relative;
    text-decoration: none;
    color: var(--brass);
    background: rgba(255, 255, 255, 0.035);
    box-shadow: inset 0 0 0 1px var(--line);
  }
  .big.bad { color: var(--red); box-shadow: inset 0 0 0 1px rgba(239, 122, 104, 0.55); }
  .big svg { width: 14px; height: 14px; display: block; }
  .big .pip {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--brass);
  }
  .station > form:has(.plaque) { min-width: 0; width: 100%; }
  .plaque {
    display: block;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    border: 0;
    border-radius: 8px;
    text-align: left;
    background: rgba(230, 179, 90, 0.1);
    box-shadow: inset 0 0 0 1px rgba(230, 179, 90, 0.45);
    padding: 5px 8px 6px;
    cursor: pointer;
  }
  .plaque .reason, .plaque .stat, .plaque .kicker {
    display: block;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .side-title { margin: 0; font: 600 12px/1.2 ui-monospace, "SF Mono", Menlo, monospace; }
  .kicker { font-size: 10px; letter-spacing: 0.08em; color: var(--muted); }
  .kicker.red { color: var(--red); }
  .stat { font-size: 12px; }
  .stat.red { color: var(--red); }
  .reason { color: var(--muted); font-size: 12px; }
  .sidebar {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 4;
    width: min(560px, 92vw);
    overflow: hidden;
    padding: 0;
    background: #171512;
    box-shadow: -20px 0 48px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    animation: drawer 160ms ease;
  }
  @keyframes drawer {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
  .sidebar header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    flex: none;
    padding: 16px 16px 12px;
  }
  .side-scroll {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 0 16px 28px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .sidebar .block { margin-top: 0; }
  .x {
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--muted);
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .x svg { width: 14px; height: 14px; display: block; }
  .ask p { margin: 0 0 14px; }
  .full { margin: 0; }
  .verbs { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .verb small {
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .verb {
    border: 0;
    border-radius: 8px;
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.035);
    box-shadow: inset 0 0 0 1px var(--line);
    color: var(--ink);
    cursor: pointer;
    text-align: left;
  }
  .verb span, .verb small { display: block; }
  .spine { display: flex; flex-direction: column; }
  .spine > section { padding: 8px 0; border-bottom: 1px solid var(--line); }
  .spine > section:last-child { border-bottom: 0; }
  .spine-pick {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }
  .spine .row {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    cursor: pointer;
  }
  .spine .lead {
    display: flex;
    align-items: stretch;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
  }
  .spine .layer {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    cursor: pointer;
  }
  .spine .rest {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
    width: 100%;
    min-width: 0;
    cursor: pointer;
  }
  .spine .acts { flex: 0 0 auto; display: flex; align-items: center; }
  .spine .acts form { margin: 0; }
  .spine > section:has(.spine-pick:checked) { padding-top: 0; }
  .spine > section:has(.spine-pick:checked) .row {
    position: sticky;
    top: 0;
    z-index: 2;
    width: auto;
    max-width: none;
    margin: 0 -16px;
    padding: 8px 16px;
    background: var(--bg-2);
    border-bottom: 1px solid var(--line);
  }
  .spine .name { font-weight: 500; }
  .spine .sentence { white-space: pre-wrap; overflow-wrap: break-word; }
  .spine .excerpt {
    min-width: 0;
    max-width: 100%;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .spine > section:has(.spine-pick:checked) .excerpt { display: none; }
  .spine .here, .spine .ok { color: var(--green); }
  .spine .wait { color: var(--red); }
  .spine .fold { display: none; flex-direction: column; gap: 8px; padding-top: 8px; }
  .spine > section:has(.spine-pick:checked) .fold { display: flex; }
  .spine .quiet, .spine .crumb { color: var(--muted); }
  .spine h3 { margin: 0 0 4px; font-size: 13px; font-weight: 500; }
  .spine h4 { margin: 10px 0 2px; font-size: 12px; font-weight: 600; letter-spacing: 0.02em; }
  .spine .hold { margin: 0 0 6px; color: var(--brass); font-size: 12px; }
  .spine .cap, .spine .task { border-top: 1px solid var(--line); padding-top: 8px; }
  .spine summary { cursor: pointer; font: 600 12px/1.2 ui-monospace, "SF Mono", Menlo, monospace; }
  .spine .jump {
    display: block;
    width: 100%;
    margin-top: 6px;
    padding: 6px 8px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }
  .spine .mark { background: rgba(230, 179, 90, 0.16); border-radius: 6px; padding: 6px 8px; }
  .spine .scene { white-space: pre-wrap; }
  .spine .mark b, .spine .scene b { font-weight: 500; margin-right: 6px; }
  .spine .doc { display: flex; flex-direction: column; gap: 18px; }
  .spine .plan-section { display: flex; flex-direction: column; }
  .spine .line {
    display: block;
    width: 100%;
    margin: 0;
    padding: 1px 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    line-height: 1.45;
  }
  .spine button.line {
    width: calc(100% + 16px);
    margin: -4px -8px;
    padding: 4px 8px;
    border-radius: 8px;
    cursor: pointer;
  }
  .spine button.line:hover,
  .spine button.line.is-on { background: rgba(230, 179, 90, 0.1); }
  .spine .gap { display: block; height: 6px; }
  .spine form.line-note { position: relative; margin: 18px 10px 8px; }
  .spine .draft { position: relative; display: block; }
  .spine form.line-note textarea,
  .spine .plan-foot textarea {
    display: block;
    width: 100%;
    min-height: 68px;
    margin: 0;
    padding: 8px 8px 28px;
    border: 0;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.035);
    box-shadow: inset 0 0 0 1px var(--line);
    resize: vertical;
    font-size: 13px;
  }
  .spine form.line-note textarea:focus,
  .spine .plan-foot textarea:focus {
    outline: none;
    box-shadow: inset 0 0 0 1px rgba(230, 179, 90, 0.45);
  }
  .spine .shut {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: var(--bg-2);
    color: var(--ink);
    box-shadow: inset 0 0 0 1px rgba(244, 240, 230, 0.42);
    display: grid;
    place-items: center;
  }
  .spine .shut svg { width: 12px; height: 12px; display: block; }
  .spine .send {
    position: absolute;
    right: 6px;
    bottom: 6px;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--brass);
    display: grid;
    place-items: center;
  }
  .spine .send svg { width: 14px; height: 14px; display: block; }
  .spine .plan-foot { margin: 10px 10px 8px; }
  .spine .plan-foot form { margin: 0; }
  .spine .plan-foot .draft { margin: 0; font-size: 0; }
  .spine .fileline { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px; }
  .status { margin: 0; padding: 8px 18px 0; color: var(--brass); font-size: 12px; }
  .kicker, .hint, .empty, .path, .note { color: var(--muted); }
  .hint, .empty, .path { font-size: 12px; }
  .sheet h2 { font-family: "Iowan Old Style", Palatino, Georgia, serif; }
  .block { margin-top: 16px; }
  .block h3, .group h3, .roles h3 { margin: 0 0 8px; font-size: 13px; }
  .block pre, .popup pre {
    margin: 0;
    white-space: pre-wrap;
    font: 13px/1.45 ui-monospace, monospace;
  }
  .outcome { color: var(--brass); font-size: 11px; letter-spacing: 0.04em; }
  .veil {
    position: fixed;
    inset: 0;
    z-index: 5;
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgba(8, 7, 6, 0.72);
  }
  .popup-veil { z-index: 6; }
  .sheet, .popup {
    width: min(1080px, 100%);
    max-height: 100%;
    overflow: auto;
    background: #171512;
    border: 1px solid var(--line);
    border-radius: 16px;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
    padding: 18px;
  }
  .popup { width: min(640px, 100%); }
  .sheet header, .popup header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .sheet header h2, .popup header h2 { margin: 0; }
  .blocks { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 12px; }
  .stack, .group, .role, .roles { display: flex; flex-direction: column; gap: 10px; }
  .group {
    padding: 12px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: #120f0c;
  }
  .group form, .role form, .add { display: flex; flex-direction: column; gap: 6px; }
  label, legend { color: var(--muted); font-size: 12px; }
  input, select, textarea {
    width: 100%;
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 8px 10px;
    background: #0e0d0b;
  }
  textarea { min-height: 72px; resize: vertical; }
  .warn, label.warn { color: var(--red); }
  .note { margin-left: 6px; }
  .check { display: flex; gap: 8px; align-items: center; color: var(--ink); }
  .check input { width: auto; }
  fieldset { border: 1px solid var(--line); border-radius: 8px; }
  .row { display: flex; gap: 6px; align-items: center; }
  form.shell { display: none; }
  .row form { flex: 1; }
  .row .quiet { flex: 0 0 auto; }
  iframe { width: 100%; height: 360px; border: 0; border-radius: 8px; background: white; }
  h4 { margin: 8px 0 0; font-size: 12px; color: var(--muted); font-weight: 600; }
  @media (max-width: 900px) {
    .blocks { grid-template-columns: 1fr; }
  }
`;

const client = `
  function field(form, name, value) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.append(input);
  }
  function payload(event) {
    const transfer = event.dataTransfer;
    if (!transfer) return ['', ''];
    const custom = transfer.getData('application/x-ai-factory');
    const raw = custom ? custom : transfer.getData('text/plain');
    const split = raw.indexOf('\\n');
    if (split === -1) return ['', ''];
    return [raw.slice(0, split), raw.slice(split + 1)];
  }
  function gesture(type, value, kind) {
    if (type === 'pool' && value && kind === 'station') return 'take';
    return '';
  }
  document.querySelectorAll('article.ticket.pool[draggable="true"]').forEach(el => {
    el.addEventListener('dragstart', event => {
      if (!event.dataTransfer) return;
      const text = 'pool\\n' + el.getAttribute('data-key');
      event.dataTransfer.setData('application/x-ai-factory', text);
      event.dataTransfer.setData('text/plain', text);
    });
  });
  function bind(el, kind) {
    el.addEventListener('dragover', event => {
      event.preventDefault();
      if (kind === 'station') event.stopPropagation();
      el.classList.add('over');
    });
    el.addEventListener('dragleave', () => el.classList.remove('over'));
    el.addEventListener('drop', event => {
      el.classList.remove('over');
      const [type, value] = payload(event);
      const which = gesture(type, value, kind);
      if (which === '') return;
      event.preventDefault();
      event.stopPropagation();
      const form = document.createElement('form');
      form.method = 'post';
      if (which === 'take') {
        form.action = '/take';
        field(form, 'key', value);
        form.submit();
      }
    });
  }
  document.querySelectorAll('article.ticket').forEach(el => bind(el, 'card'));
  document.querySelectorAll('.station').forEach(el => bind(el, 'station'));
  document.querySelectorAll('form.pair').forEach(form => {
    form.addEventListener('focusout', event => {
      const next = event.relatedTarget;
      if (next && form.contains(next)) return;
      form.submit();
    });
  });
  const sheet = document.querySelector('.sheet');
  if (sheet) {
    const scrollKey = 'ai-factory-sheet-scroll';
    const fieldKey = 'ai-factory-sheet-field';
    const savedScroll = sessionStorage.getItem(scrollKey);
    const fieldName = sessionStorage.getItem(fieldKey);
    if (fieldName) {
      const field = sheet.querySelector('[name="' + CSS.escape(fieldName) + '"]');
      if (field && field.focus) field.focus({preventScroll: true});
    }
    if (savedScroll !== null) sheet.scrollTop = Number(savedScroll);
    sheet.addEventListener('scroll', () => {
      sessionStorage.setItem(scrollKey, String(sheet.scrollTop));
    });
    sheet.addEventListener('focusin', event => {
      const target = event.target;
      if (target && target.getAttribute && target.getAttribute('name')) {
        sessionStorage.setItem(fieldKey, target.getAttribute('name'));
      }
    });
  }
  const showKey = document.body.getAttribute('data-show');
  if (showKey) {
    const card = document.querySelector('article[data-key="' + CSS.escape(showKey) + '"]');
    const board = document.querySelector('.board');
    if (card && board) {
      const cardRect = card.getBoundingClientRect();
      const boxRect = board.getBoundingClientRect();
      if (cardRect.top < boxRect.top) board.scrollTop -= boxRect.top - cardRect.top;
      else if (cardRect.bottom > boxRect.bottom) board.scrollTop += cardRect.bottom - boxRect.bottom;
    }
  }
  document.querySelectorAll('.spine-pick').forEach(pick => {
    pick.addEventListener('click', () => {
      if (!pick.checked) return;
      document.querySelectorAll('.spine-pick').forEach(item => {
        if (item !== pick) item.checked = false;
      });
    });
  });
  ${headClickToggles.toString()}
  document.querySelectorAll('.spine .row').forEach(row => {
    row.addEventListener('click', event => {
      if (!headClickToggles(event.target)) return;
      const pick = row.parentElement && row.parentElement.querySelector('.spine-pick');
      if (pick) pick.click();
    });
  });
  document.querySelectorAll('button.jump').forEach(button => {
    button.addEventListener('click', () => {
      const cap = button.getAttribute('data-cap');
      const pick = document.getElementById('spine-Specify');
      document.querySelectorAll('.spine-pick').forEach(item => {
        item.checked = item === pick;
      });
      document.querySelectorAll('details.cap').forEach(item => { item.open = false; });
      const details = cap ? document.getElementById('cap-' + cap) : null;
      if (details) details.open = true;
    });
  });
  const noteTemplate = document.querySelector('.line-note-template');
  const planDoc = document.querySelector('.doc');
  function draftText(form) {
    const field = form.querySelector('textarea');
    return field ? field.value : '';
  }
  function closeDraft(form) {
    const line = form.previousElementSibling;
    form.remove();
    if (line && line.classList) line.classList.remove('is-on');
  }
  ${draftsAfterClick.toString()}
  function openDrafts() {
    return [...planDoc.querySelectorAll('form.line-note')].map(form => {
      const line = form.previousElementSibling;
      return {
        line: line && line.getAttribute ? line.getAttribute('data-line') || '' : '',
        text: draftText(form),
      };
    });
  }
  function openLine(button) {
    const source = noteTemplate.content.querySelector('form.line-note');
    if (!source) return;
    const form = source.cloneNode(true);
    const line = form.querySelector('[name="line"]');
    const question = form.querySelector('[name="question"]');
    if (line) line.value = button.getAttribute('data-line') || '';
    if (question) question.value = button.getAttribute('data-question') || '';
    const field = form.querySelector('textarea');
    if (field && button.getAttribute('data-question')) field.placeholder = 'Ответ';
    button.classList.add('is-on');
    button.after(form);
    if (field) field.focus();
  }
  if (noteTemplate && planDoc) {
    planDoc.addEventListener('click', event => {
      const target = event.target;
      if (!target || !target.closest) return;
      const dismiss = target.closest('[data-dismiss-line]');
      if (dismiss) {
        const form = dismiss.closest('form.line-note');
        if (form) closeDraft(form);
        return;
      }
      const button = target.closest('button.line');
      if (!button || !planDoc.contains(button)) return;
      const targetLine = button.getAttribute('data-line') || '';
      const next = draftsAfterClick(openDrafts(), targetLine);
      const stay = next.some(item => item.line === targetLine && item.text.trim() !== '');
      planDoc.querySelectorAll('form.line-note').forEach(form => {
        const line = form.previousElementSibling;
        const name = line && line.getAttribute ? line.getAttribute('data-line') || '' : '';
        if (!next.some(item => item.line === name)) closeDraft(form);
      });
      if (stay) {
        const sitting = button.nextElementSibling;
        const field = sitting && sitting.querySelector ? sitting.querySelector('textarea') : null;
        if (field) field.focus();
        return;
      }
      if (next.some(item => item.line === targetLine)) openLine(button);
    });
  }
  ${lineFieldClosesOnEscape.toString()}
  document.addEventListener('keydown', event => {
    if (!planDoc) return;
    const active = document.activeElement;
    const form = active && active.closest ? active.closest('form.line-note') : null;
    if (lineFieldClosesOnEscape(event.key, Boolean(form))) closeDraft(form);
  });
`;

function boardDocument(surface: Surface, view: PageView): string {
  const board = surface.board();
  const settings = surface.settings();
  const card = view.opened === '' ? undefined : findCard(board, view.opened);
  if (view.opened !== '' && !card) {
    view.opened = '';
  }
  const doorAt = (file: string) => surface.doorPlace(file);
  const place = (file: string, line: number) => surface.openReviewPlace(file, line);
  const blocks = card ? surface.sidebar() : [];
  const roles = surface.shelf();
  const drawn = drawnRows(board);
  const rows = drawn.map(row => ticketRow(row, row.key === view.opened, doorAt)).join('');
  const openRow = drawn.find(row => row.key === view.opened);
  const focus = blocks.find(block => block.kind === 'focus');
  const model =
    surface.spine() ??
    buildSpine({
      key: openRow?.key ?? '',
      station: openRow?.station,
      focusBody: focus && focus.kind === 'focus' ? focus.body : undefined,
      gateOff: openRow?.gateOff,
    });
  const drawerHtml = openRow ? drawer(openRow, blocks, roles, place, model) : '';
  const ask = view.ask ? askDialog(view.ask) : '';
  const repairRow =
    view.repair === undefined ? undefined : drawn.find(row => row.key === view.repair);
  const repair =
    repairRow?.alarm === true ? repairPopup(repairRow, chosenService(view, repairRow.key)) : '';
  const paths = surface.checkouts();
  const sheet = settings.open
    ? settingsSheet(settings, surface.overlay(), surface.serviceConfig(), paths, view.serviceDirty)
    : '';
  const popup = view.popup === undefined ? '' : popupOf(view.popup);
  const lamp = board.stepsStart
    ? '<p class="lamp on">шаги идут</p>'
    : '<p class="lamp">шаги стоят</p>';
  const note = surface.spyNote();
  const spy = note === '' ? '' : `<p class="spy">${escape(note)}</p>`;
  const gear = `${hidden('act', 'open-settings')}${pill('Настройки')}`;
  const status =
    view.status === undefined ? '' : `<p class="status" role="status">${escape(view.status)}</p>`;
  const show = view.show ? ` data-show="${escape(view.show)}"` : '';
  return `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>ai-factory</title><style>${style}</style><body${show}><div class="app"><header class="top"><p class="word">ai-factory</p>${lamp}${spy}<form method="post" action="/act">${gear}</form></header>${banners(board.rows)}${status}<div class="stage"><main class="board">${head()}${rows}</main></div></div>${drawerHtml}${sheet}${popup}${repair}${ask}<script>${client}</script></body></html>`;
}

function roleDraft(surface: Surface, params: URLSearchParams, act: string | null): void {
  if (act === 'add-role') {
    return;
  }
  if (!params.has('name') || !params.has('outcome') || !params.has('text')) {
    return;
  }
  const name = params.get('name') ?? '';
  const outcome = outcomeOf(params.get('outcome'));
  if (name === '' || !outcome) {
    return;
  }
  const role: RoleRecord = {name, outcome, text: params.get('text') ?? ''};
  if (outcome === 'ticket-fields') {
    role.labels = params.getAll('labels');
  }
  surface.addRole(role);
}

function hookDraft(surface: Surface, params: URLSearchParams, act: string | null): boolean {
  if (act === 'choose-service-hook') {
    return false;
  }
  const first = params.get('first');
  if (first === null || first.trim() === '') {
    return false;
  }
  const posted = params.get('choice') ?? '';
  const split = posted.indexOf('\t');
  if (split !== -1) {
    surface.chooseServiceHook(posted.slice(0, split), posted.slice(split + 1), first);
    return true;
  }
  const free = surface.serviceConfig().hookChoices?.[0];
  if (!free) {
    return false;
  }
  surface.chooseServiceHook(free.action, free.point, first);
  return true;
}

function finish(
  surface: Surface,
  params: URLSearchParams,
  act: string | null,
  view: PageView,
): ActResult {
  roleDraft(surface, params, act);
  if (hookDraft(surface, params, act)) {
    view.serviceDirty = true;
  }
  return 'see';
}

function apply(surface: Surface, params: URLSearchParams, view: PageView): ActResult {
  const act = params.get('act');
  if (act === 'repair') {
    const key = params.get('key');
    if (key) {
      view.repair = key;
    }
    return finish(surface, params, act, view);
  }
  if (act === 'close-repair') {
    view.repair = undefined;
    return finish(surface, params, act, view);
  }
  if (act === 'plant-queue') {
    const key = params.get('key') ?? '';
    if (!surface.plantQueue(key, params.get('name') ?? '')) {
      return 'conflict';
    }
    view.repair = undefined;
    return finish(surface, params, act, view);
  }
  if (act === 'close-ask') {
    view.ask = undefined;
    return finish(surface, params, act, view);
  }
  if (act === 'gate') {
    const key = params.get('key');
    const station = params.get('station');
    const side = params.get('where') === 'side';
    if (key && station) {
      if (params.get('sure') !== '1' && surface.lastGate(key, station, side)) {
        view.ask = {key, station, side};
      } else {
        view.ask = undefined;
        surface.gateMark(key, station, side);
      }
    }
    return finish(surface, params, act, view);
  }
  if (act === 'open') {
    const key = params.get('key');
    if (key && view.opened === key) {
      view.opened = '';
      surface.closeCard();
      return finish(surface, params, act, view);
    }
    if (key && surface.openCard(key)) {
      view.opened = key;
      view.show = key;
    }
    return finish(surface, params, act, view);
  }
  if (act === 'close-card') {
    view.opened = '';
    surface.closeCard();
    return finish(surface, params, act, view);
  }
  if (act === 'open-settings') {
    surface.openSettings();
    return finish(surface, params, act, view);
  }
  if (act === 'close-settings') {
    surface.closeSettings();
    view.serviceDirty = false;
    return finish(surface, params, act, view);
  }
  if (act === 'close-popup') {
    view.popup = undefined;
    return finish(surface, params, act, view);
  }
  if (act === 'choose-agent') {
    const agent = params.get('agent');
    if (agent) {
      surface.chooseAgent(agent);
    }
    return finish(surface, params, act, view);
  }
  if (act === 'leave-model') {
    const mode = modeOf(params.get('mode'));
    if (mode) {
      surface.leaveModel(mode, params.get('value') ?? '');
    }
    return finish(surface, params, act, view);
  }
  if (act === 'leave-effort') {
    const mode = modeOf(params.get('mode'));
    if (mode) {
      surface.leaveEffort(mode, params.get('value') ?? '');
    }
    return finish(surface, params, act, view);
  }
  if (act === 'leave-speed') {
    const mode = modeOf(params.get('mode'));
    if (mode) {
      surface.leaveSpeed(mode, params.get('value') ?? '');
    }
    return finish(surface, params, act, view);
  }
  if (act === 'leave-watch') {
    surface.leaveWatch(namesOf(params.get('names')));
    return finish(surface, params, act, view);
  }
  if (act === 'leave-roots') {
    surface.leaveRoots({
      arcadia: params.get('arcadia') ?? '',
      github: params.get('github') ?? '',
    });
    return finish(surface, params, act, view);
  }
  if (act === 'add-role') {
    const outcome = outcomeOf(params.get('outcome'));
    const name = params.get('name') ?? '';
    if (outcome && name !== '') {
      const role: RoleRecord = {name, outcome, text: params.get('text') ?? ''};
      if (outcome === 'ticket-fields') {
        role.labels = params.getAll('labels');
      }
      surface.addRole(role);
    }
    return finish(surface, params, act, view);
  }
  if (act === 'rename-role') {
    const name = params.get('name');
    const next = params.get('next');
    if (name && next) {
      surface.renameRole(name, next);
    }
    return finish(surface, params, act, view);
  }
  if (act === 'choose-role-outcome') {
    const name = params.get('name');
    const outcome = outcomeOf(params.get('outcome'));
    if (name && outcome) {
      surface.chooseRoleOutcome(name, outcome);
    }
    return finish(surface, params, act, view);
  }
  if (act === 'set-role-text') {
    const name = params.get('name');
    if (name) {
      surface.setRoleText(name, params.get('text') ?? '');
    }
    return finish(surface, params, act, view);
  }
  if (act === 'set-role-labels') {
    const name = params.get('name');
    if (name) {
      surface.setRoleLabels(name, params.getAll('labels'));
    }
    return finish(surface, params, act, view);
  }
  if (act === 'remove-role') {
    const name = params.get('name');
    if (name) {
      surface.removeRole(name);
    }
    return finish(surface, params, act, view);
  }
  if (act === 'answer') {
    const key = params.get('key') ?? '';
    const reply = (params.get('reply') ?? '').trim();
    if (reply === '') {
      const question = (params.get('question') ?? '').trim();
      view.status =
        question === ''
          ? 'Комментарий пустой. Напишите его в поле.'
          : 'Ответ пустой. Напишите его в поле.';
    } else if (key) {
      view.show = key;
      const status = surface.answer(
        key,
        params.get('question') ?? '',
        reply,
        params.get('line') ?? '',
      );
      if (status !== undefined) {
        view.status = status;
      }
    }
    return finish(surface, params, act, view);
  }
  if (act === 'accept-review') {
    const key = params.get('key') ?? '';
    if (key) {
      view.show = key;
      const status = surface.acceptReview(key);
      if (status !== undefined) {
        view.status = status;
      }
    }
    return finish(surface, params, act, view);
  }
  if (act === 'drag') {
    const name = params.get('name');
    const key = params.get('key');
    if (name && key) {
      view.show = key;
      const result = surface.drag(name, key);
      if (result?.popup !== undefined) {
        view.popup = result.popup;
      }
      if (result?.status !== undefined) {
        view.status = result.status;
      }
    }
    return finish(surface, params, act, view);
  }
  if (act === 'choose-checkout') {
    const checkout = params.get('checkout');
    if (checkout) {
      surface.chooseCheckout(checkout);
      view.serviceDirty = false;
    }
    return finish(surface, params, act, view);
  }
  if (act === 'choose-overlay-agent') {
    const agent = params.get('agent');
    if (agent) {
      surface.chooseOverlayAgent(agent);
    } else {
      surface.clearOverlayAgent();
    }
    return finish(surface, params, act, view);
  }
  if (act === 'leave-overlay-model') {
    const mode = modeOf(params.get('mode'));
    if (mode) {
      surface.leaveOverlayModel(mode, params.get('value') ?? '');
    }
    return finish(surface, params, act, view);
  }
  if (act === 'leave-overlay-effort') {
    const mode = modeOf(params.get('mode'));
    if (mode) {
      surface.leaveOverlayEffort(mode, params.get('value') ?? '');
    }
    return finish(surface, params, act, view);
  }
  if (act === 'leave-overlay-speed') {
    const mode = modeOf(params.get('mode'));
    if (mode) {
      surface.leaveOverlaySpeed(mode, params.get('value') ?? '');
    }
    return finish(surface, params, act, view);
  }
  if (act === 'leave-overlay-watch') {
    surface.leaveOverlayWatch(namesOf(params.get('names')));
    return finish(surface, params, act, view);
  }
  if (act === 'set-service-base') {
    surface.setServiceBase(params.get('value') ?? '');
    view.serviceDirty = true;
    return finish(surface, params, act, view);
  }
  if (act === 'set-service-branch') {
    surface.setServiceBranchScope(params.get('value') ?? '');
    view.serviceDirty = true;
    return finish(surface, params, act, view);
  }
  if (act === 'add-service-queue') {
    surface.addServiceQueue();
    view.serviceDirty = true;
    return finish(surface, params, act, view);
  }
  if (act === 'set-service-queue') {
    const names = params.getAll('name');
    const descriptions = params.getAll('description');
    const index = intOf(params.get('index'));
    if (index !== undefined && names.length <= 1) {
      surface.setServiceQueue(index, names[0] ?? '', descriptions[0] ?? '');
    } else {
      names.forEach((name, at) => {
        surface.setServiceQueue(at, name, descriptions[at] ?? '');
      });
    }
    view.serviceDirty = true;
    return finish(surface, params, act, view);
  }
  if (act === 'remove-service-queue') {
    const index = intOf(params.get('index'));
    if (index !== undefined) {
      surface.removeServiceQueue(index);
      view.serviceDirty = true;
    }
    return finish(surface, params, act, view);
  }
  if (act === 'move-service-queue') {
    const from = intOf(params.get('from'));
    const to = intOf(params.get('to'));
    if (from !== undefined && to !== undefined) {
      const length = surface.serviceConfig().queues?.items.length ?? 0;
      if (from >= length || to >= length) {
        return 'conflict';
      }
      surface.moveServiceQueue(from, to);
      view.serviceDirty = true;
    }
    return finish(surface, params, act, view);
  }
  if (act === 'add-service-ignore') {
    const value = params.get('value');
    if (value) {
      surface.addServiceIgnore(value);
      view.serviceDirty = true;
    }
    return finish(surface, params, act, view);
  }
  if (act === 'set-service-ignore') {
    const index = intOf(params.get('index'));
    if (index !== undefined) {
      surface.setServiceIgnore(index, params.get('value') ?? '');
      view.serviceDirty = true;
    }
    return finish(surface, params, act, view);
  }
  if (act === 'remove-service-ignore') {
    const index = intOf(params.get('index'));
    if (index !== undefined) {
      surface.removeServiceIgnore(index);
      view.serviceDirty = true;
    }
    return finish(surface, params, act, view);
  }
  if (act === 'choose-service-hook') {
    const choice = params.get('choice') ?? '';
    const split = choice.indexOf('\t');
    if (split !== -1) {
      surface.chooseServiceHook(
        choice.slice(0, split),
        choice.slice(split + 1),
        params.get('first') ?? '',
      );
      view.serviceDirty = true;
    }
    return finish(surface, params, act, view);
  }
  if (act === 'set-service-hook') {
    const action = params.get('hook-action');
    const point = params.get('point');
    if (action && point) {
      surface.setServiceHook(action, point, params.getAll('values'));
      view.serviceDirty = true;
    }
    return finish(surface, params, act, view);
  }
  if (act === 'save-service') {
    const writable = surface.serviceConfig().save;
    surface.saveServiceConfig();
    if (writable) {
      view.serviceDirty = false;
    }
    return finish(surface, params, act, view);
  }
  if (act === 'choose-service') {
    if (!params.has('service')) {
      return 'conflict';
    }
    const key = params.get('key');
    const service = params.get('service') ?? '';
    if (key) {
      surface.chooseService(key, service);
      view.service[key] = service;
      view.repair = undefined;
    }
    return finish(surface, params, act, view);
  }
  return 'unknown';
}

type ReadBody = {kind: 'text'; text: string} | {kind: 'too-big'};

function readBody(req: IncomingMessage): Promise<ReadBody> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let tooBig = false;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        tooBig = true;
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooBig) {
        resolve({kind: 'too-big'});
        return;
      }
      resolve({kind: 'text', text: Buffer.concat(chunks).toString('utf8')});
    });
    req.on('error', reject);
  });
}

function text(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, {'content-type': 'text/plain; charset=utf-8'});
  res.end(body);
}

function redirect(res: ServerResponse): void {
  res.writeHead(303, {location: '/'});
  res.end();
}

function failure(error: unknown): string {
  if (error instanceof Error && error.message !== '') {
    return error.message;
  }
  return 'ошибка';
}

async function handle(
  surface: Surface,
  req: IncomingMessage,
  res: ServerResponse,
  view: PageView,
  epoch: {n: number},
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  if (req.method === 'POST' && (url.pathname === '/take' || url.pathname === '/act')) {
    const mine = ++epoch.n;
    const body = await readBody(req);
    if (mine !== epoch.n) {
      text(res, 409, 'устарело');
      return;
    }
    if (body.kind === 'too-big') {
      text(res, 413, 'тело слишком большое');
      return;
    }
    const params = new URLSearchParams(body.text);
    if (url.pathname === '/take') {
      const taken = params.get('key');
      if (!surface.take(taken ?? undefined)) {
        text(res, 409, 'не записано');
        return;
      }
      if (taken) {
        view.show = taken;
      }
      surface.spy();
      redirect(res);
      return;
    }
    const result = apply(surface, params, view);
    if (result === 'unknown') {
      text(res, 400, 'неизвестное действие');
      return;
    }
    if (result === 'conflict') {
      text(res, 409, 'не записано');
      return;
    }
    redirect(res);
    return;
  }
  if (req.method === 'GET' && url.pathname === '/') {
    surface.spy();
    const html = boardDocument(surface, view);
    res.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    res.end(html);
    return;
  }
  res.writeHead(404);
  res.end();
}

/** One process serves the window page. */
export function serveBoard(surface: Surface): Promise<{url: string; close(): Promise<void>}> {
  const view: PageView = {opened: '', service: {}, serviceDirty: false};
  const epoch = {n: 0};
  const server = createServer((req, res) => {
    handle(surface, req, res, view, epoch).catch(error => {
      if (!res.headersSent) {
        text(res, 500, failure(error));
        return;
      }
      res.end();
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('board page did not bind'));
        return;
      }
      resolve({
        url: `http://127.0.0.1:${address.port}/`,
        close: () =>
          new Promise((done, fail) => {
            server.close(error => (error ? fail(error) : done()));
          }),
      });
    });
  });
}
