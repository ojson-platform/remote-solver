import type {
  BoardState,
  ColumnName,
  GateStation,
  OverlayGroup,
  PhaseRow,
  RoleOutcome,
  ServiceConfigGroup,
  SettingsState,
  SidebarBlock,
  StationDoor,
} from './types.ts';

import {specsReady} from '../machine/change.ts';

import {plaqueLines} from './board.ts';
import {
  buildSpine,
  layerForStation,
  reviewGateForLayer,
  SPINE_LAYERS,
  type Spine,
  type SpineLayer,
} from './spine.ts';
import {COLUMN_NAMES} from './types.ts';

/** A spine row offers acceptance, keeps its gate, or leaves that place empty. */
export type LayerAct = 'accept' | 'gate' | 'none';

export type SnapshotDoor = {
  kind: StationDoor['kind'];
  bad?: true;
  dot?: true;
  /** Several specs: the door opens the cycle instead of one file. */
  many?: true;
  href?: string;
};

export type SnapshotRow = {
  key: string;
  title: string;
  issue?: string;
  pull?: {id: string; href: string};
  project?: {name: string; href: string};
  /** Issue page when the ticket names a repository. */
  issueHref?: string;
  pool: boolean;
  station?: ColumnName;
  /** Action token while a worker is on a turn for this cycle. */
  action?: string;
  plaque: {top?: string; bottom?: string};
  phaseRow?: PhaseRow;
  reason?: string;
  takeDisabled?: true;
  alarm?: true;
  choices: string[];
  occasion?: true;
  doors?: Partial<Record<ColumnName, SnapshotDoor>>;
  gateOff?: Partial<Record<GateStation, true>>;
};

export type WindowSnapshot = {
  /** Grows when a turn changes, a tracker read commits, or a gesture is written. */
  generation: number;
  /** True while the factory config can start a step. */
  lamp: boolean;
  /** Header line for the running turns. Empty when none are. */
  spy: string;
  /** Error the page shows once between the header and the board. */
  status?: string;
  /** Row the last gesture should bring into view. */
  show?: string;
  settings: SettingsState;
  overlay: OverlayGroup;
  serviceConfig: ServiceConfigGroup;
  checkouts: string[];
  serviceDirty: boolean;
  /** Chosen service per cycle, for the repair field. */
  service: Record<string, string>;
  banners: {text: string}[];
  roles: {name: string; outcome: RoleOutcome}[];
  /** `file:line` review URLs for focus and Code lines. */
  reviewPlaces: Record<string, string>;
  popup?: string;
  repair?: string;
  ask?: {key: string; station: string; side: boolean};
  rows: SnapshotRow[];
  opened?: {
    key: string;
    title: string;
    spineReady: boolean;
    /** Set once a spine is stored. The client keeps its painted spine while this stays the same. */
    revision?: string;
    spine: Spine;
    layers: {layer: SpineLayer; act: LayerAct}[];
    blocks: SidebarBlock[];
  };
};

type SnapshotSurface = {
  board(): BoardState;
  settings(): SettingsState;
  overlay(): OverlayGroup;
  serviceConfig(): ServiceConfigGroup;
  checkouts(): string[];
  shelf(): {name: string; outcome: RoleOutcome}[];
  spyNote(): string;
  turn(key: string): string | undefined;
  sidebar(): SidebarBlock[];
  spine(): Spine | undefined;
  heldSpine?: () => {spine?: Spine; ready: boolean; revision?: string};
  doorPlace(file: string): string | undefined;
  openReviewPlace(file: string, line: number): string | undefined;
};

type SnapshotView = {
  generation: number;
  opened: string;
  status?: string;
  show?: string;
  popup?: string;
  repair?: string;
  ask?: {key: string; station: string; side: boolean};
  service: Record<string, string>;
  serviceDirty: boolean;
};

type Fact = {
  key: string;
  title: string;
  issueHref?: string;
  pool: boolean;
  station?: ColumnName;
  phaseRow?: PhaseRow;
  reason?: string;
  layers?: string;
  ask?: string;
  unanswered?: string;
  gateOff?: Partial<Record<GateStation, true>>;
  occasion?: true;
  doors?: Partial<Record<ColumnName, StationDoor>>;
  takeDisabled?: true;
  alarm?: true;
  choices: string[];
  repo?: string;
  service?: string;
  pull?: string;
};

export function ticketLinks(input: {key: string; repo?: string; service?: string; pull?: string}): {
  issue?: string;
  pull?: {id: string; href: string};
  project?: {name: string; href: string};
} {
  const repo = input.repo?.trim() ?? '';
  if (repo === '' || !repo.includes('/')) {
    return {};
  }
  const issue = `https://github.com/${repo}/issues/${input.key}`;
  const pull =
    input.pull && input.pull.trim() !== ''
      ? {id: input.pull.trim(), href: `https://github.com/${repo}/pull/${input.pull.trim()}`}
      : undefined;
  if (input.service === undefined) {
    return {issue, ...(pull ? {pull} : {})};
  }
  const service = input.service.trim();
  if (service === '') {
    const name = repo.slice(repo.lastIndexOf('/') + 1);
    return {issue, ...(pull ? {pull} : {}), project: {name, href: `https://github.com/${repo}`}};
  }
  const name = service.slice(service.lastIndexOf('/') + 1);
  return {
    issue,
    ...(pull ? {pull} : {}),
    project: {name, href: `https://github.com/${repo}/tree/HEAD/${service}`},
  };
}

/** Spec turns hide Specify acceptance until this cycle's turn ends. */
const SPEC_TURNS = new Set(['restore-baseline', 'create-initial-specs', 'improve-specs']);

/** Whether the current review gate's artifact is ready to accept. */
export function reviewReady(
  model: Spine,
  gate: NonNullable<Spine['reviewGate']>,
  action?: string,
): boolean {
  if (gate === 'proposed') {
    return model.proposal.present && !model.proposal.questions.some(question => question.open);
  }
  if (gate === 'designed') {
    const decisions = model.design.sections.find(section => section.heading === 'Open decisions');
    const open = decisions?.lines.some(line => line.text.trimStart().startsWith('- [ ]')) ?? false;
    return model.design.present && !open;
  }
  if (action !== undefined && SPEC_TURNS.has(action)) {
    return false;
  }
  if (model.missingBaseline.length > 0) {
    return false;
  }
  return specsReady({
    proposal: model.proposal.present,
    delta: model.capabilities.length > 0,
    capabilities: model.named,
  });
}

function layerAct(layer: SpineLayer, model: Spine, action?: string): LayerAct {
  const review = reviewGateForLayer(layer);
  const here = model.station !== undefined && layerForStation(model.station) === layer;
  if (here && review !== undefined) {
    if (model.pull && model.reviewGate === review && reviewReady(model, review, action)) {
      return 'accept';
    }
    return 'none';
  }
  if (layer === 'Plan' || layer === 'Specify' || layer === 'Design' || layer === 'Accept') {
    return 'gate';
  }
  return 'none';
}

/** Same card fields `drawnRows` copies, in the same order. */
function facts(board: BoardState): Fact[] {
  const taken = board.columns.flatMap(column =>
    column.cards.map(card => ({
      key: card.key,
      title: card.title,
      ...(card.issueHref !== undefined ? {issueHref: card.issueHref} : {}),
      pool: false,
      station: column.name,
      phaseRow: card.phaseRow,
      reason: card.reason,
      layers: card.layers,
      ask: card.ask,
      unanswered: card.unanswered,
      gateOff: card.gateOff,
      occasion: card.occasion,
      doors: card.doors,
      choices: [],
      ...(card.repo !== undefined ? {repo: card.repo} : {}),
      ...(card.service !== undefined ? {service: card.service} : {}),
      ...(card.pull !== undefined ? {pull: card.pull} : {}),
    })),
  );
  taken.sort((left, right) => {
    const occasion = Number(right.occasion === true) - Number(left.occasion === true);
    if (occasion !== 0) {
      return occasion;
    }
    return left.key.localeCompare(right.key, undefined, {numeric: true});
  });
  const pool = board.pool.map(card => ({
    key: card.key,
    title: card.title,
    ...(card.issueHref !== undefined ? {issueHref: card.issueHref} : {}),
    pool: true,
    station: card.station,
    phaseRow: card.phaseRow,
    reason: card.reason,
    layers: card.layers,
    ask: card.ask,
    unanswered: card.unanswered,
    gateOff: card.gateOff,
    doors: card.doors,
    takeDisabled: card.takeDisabled,
    alarm: card.alarm,
    choices: card.choices,
    ...(card.repo !== undefined ? {repo: card.repo} : {}),
    ...(card.service !== undefined ? {service: card.service} : {}),
    ...(card.pull !== undefined ? {pull: card.pull} : {}),
  }));
  return [...taken, ...pool];
}

function publishedDoors(
  doors: Fact['doors'],
  place: (file: string) => string | undefined,
): SnapshotRow['doors'] {
  if (!doors) {
    return undefined;
  }
  const out: NonNullable<SnapshotRow['doors']> = {};
  for (const name of COLUMN_NAMES) {
    const door = doors[name];
    if (!door) {
      continue;
    }
    const href = door.file === undefined ? undefined : place(door.file);
    out[name] = {
      kind: door.kind,
      ...(door.bad === true ? {bad: true} : {}),
      ...(door.dot === true ? {dot: true} : {}),
      ...(door.specs !== undefined && door.specs.length > 1 ? {many: true} : {}),
      ...(href !== undefined && href !== '' ? {href} : {}),
    };
  }
  return out;
}

function publish(
  row: Fact,
  action: string | undefined,
  place: (file: string) => string | undefined,
): SnapshotRow {
  const shown = action === '' ? undefined : action;
  return {
    key: row.key,
    title: row.title,
    pool: row.pool,
    choices: row.choices,
    ...ticketLinks({key: row.key, repo: row.repo, service: row.service, pull: row.pull}),
    ...(row.issueHref !== undefined ? {issueHref: row.issueHref} : {}),
    ...(row.station !== undefined ? {station: row.station} : {}),
    ...(shown !== undefined ? {action: shown} : {}),
    ...(row.phaseRow !== undefined ? {phaseRow: row.phaseRow} : {}),
    ...(row.reason !== undefined ? {reason: row.reason} : {}),
    ...(row.takeDisabled === true ? {takeDisabled: true} : {}),
    ...(row.alarm === true ? {alarm: true} : {}),
    ...(row.occasion === true ? {occasion: true} : {}),
    ...(row.gateOff !== undefined ? {gateOff: row.gateOff} : {}),
    ...(row.doors !== undefined ? {doors: publishedDoors(row.doors, place)} : {}),
    plaque: plaqueLines({
      ask: row.ask,
      gaps: row.layers,
      unanswered: row.unanswered,
      station: row.station,
      phaseRow: row.phaseRow,
      reason: row.reason,
      action: shown,
    }),
  };
}

function rememberPlaces(text: string, place: (file: string, line: number) => string | undefined, into: Record<string, string>): void {
  for (const line of text.split('\n')) {
    const matched = /^(\s*)Code(\s+)(\S.*)$/.exec(line);
    const rest = matched?.[3];
    if (rest === undefined || rest.trim() === 'solid') {
      continue;
    }
    for (const gap of rest.split(';')) {
      const core = gap.trim();
      const found = /^(\S+):(\d+)$/.exec(core);
      if (!found?.[1] || found[2] === undefined) {
        continue;
      }
      const key = `${found[1]}:${found[2]}`;
      if (Object.hasOwn(into, key)) {
        continue;
      }
      const url = place(found[1], Number(found[2]));
      into[key] = url ?? '';
    }
  }
}

function openCycle(
  surface: SnapshotSurface,
  view: SnapshotView,
  rows: readonly Fact[],
): WindowSnapshot['opened'] {
  if (view.opened === '') {
    return undefined;
  }
  const row = rows.find(item => item.key === view.opened);
  if (!row) {
    return undefined;
  }
  const focus = surface.sidebar().find(block => block.kind === 'focus');
  const focusBody = focus?.kind === 'focus' ? focus.body : undefined;
  const unread = (): Spine =>
    buildSpine({
      key: row.key,
      station: row.station,
      focusBody,
      gateOff: row.gateOff,
    });
  let model: Spine;
  let spineReady: boolean;
  let revision: string | undefined;
  if (surface.heldSpine) {
    const held = surface.heldSpine();
    model = held.spine ?? unread();
    spineReady = held.ready;
    revision = held.revision;
  } else {
    model = surface.spine() ?? unread();
    spineReady = true;
  }
  const action = surface.turn(row.key);
  return {
    key: row.key,
    title: row.title,
    spineReady,
    ...(revision !== undefined ? {revision} : {}),
    spine: model,
    layers: SPINE_LAYERS.map(layer => ({layer, act: layerAct(layer, model, action)})),
    blocks: surface.sidebar(),
  };
}

/** Drop the spine when the caller already holds this revision. JSON omits the undefined spine. */
export function omitHeldSpine(body: WindowSnapshot, have: string | null): WindowSnapshot {
  const opened = body.opened;
  if (!have || opened?.revision !== have) {
    return body;
  }
  return {...body, opened: {...opened, spine: undefined as unknown as Spine}};
}

export function snapshot(surface: SnapshotSurface, view: SnapshotView): WindowSnapshot {
  const board = surface.board();
  const drawn = facts(board);
  const opened = openCycle(surface, view, drawn);
  const reviewPlaces: Record<string, string> = {};
  if (opened) {
    rememberPlaces(opened.spine.rest.join('\n'), surface.openReviewPlace, reviewPlaces);
    for (const line of opened.spine.lines) {
      rememberPlaces(line.raw, surface.openReviewPlace, reviewPlaces);
    }
  }
  return {
    generation: view.generation,
    lamp: board.stepsStart,
    spy: surface.spyNote(),
    settings: surface.settings(),
    overlay: surface.overlay(),
    serviceConfig: surface.serviceConfig(),
    checkouts: surface.checkouts(),
    serviceDirty: view.serviceDirty,
    service: view.service,
    banners: board.rows,
    roles: surface.shelf(),
    reviewPlaces,
    rows: drawn.map(row => publish(row, surface.turn(row.key), file => surface.doorPlace(file))),
    ...(view.status !== undefined ? {status: view.status} : {}),
    ...(view.show !== undefined && view.show !== '' ? {show: view.show} : {}),
    ...(view.popup !== undefined ? {popup: view.popup} : {}),
    ...(view.repair !== undefined ? {repair: view.repair} : {}),
    ...(view.ask !== undefined ? {ask: view.ask} : {}),
    ...(opened !== undefined ? {opened} : {}),
  };
}
