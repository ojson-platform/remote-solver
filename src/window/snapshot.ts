import type {
  BoardState,
  ColumnName,
  GateStation,
  PhaseRow,
  SettingsState,
  SidebarBlock,
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

/** A spine row offers acceptance, keeps its gate, or leaves that place empty. */
export type LayerAct = 'accept' | 'gate' | 'none';

export type SnapshotRow = {
  key: string;
  title: string;
  pool: boolean;
  station?: ColumnName;
  /** Action token while a worker is on a turn for this cycle. */
  action?: string;
  plaque: {top?: string; bottom?: string};
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
  settings: SettingsState;
  rows: SnapshotRow[];
  opened?: {
    key: string;
    title: string;
    spine: Spine;
    layers: {layer: SpineLayer; act: LayerAct}[];
  };
};

type SnapshotSurface = {
  board(): BoardState;
  settings(): SettingsState;
  spyNote(): string;
  turn(key: string): string | undefined;
  sidebar(): SidebarBlock[];
  spine(): Spine | undefined;
};

type SnapshotView = {
  generation: number;
  opened: string;
  status?: string;
};

type Fact = {
  key: string;
  title: string;
  pool: boolean;
  station?: ColumnName;
  phaseRow?: PhaseRow;
  reason?: string;
  layers?: string;
  ask?: string;
  unanswered?: string;
  gateOff?: Partial<Record<GateStation, true>>;
  occasion?: true;
};

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
    return (
      model.design.present &&
      !model.design.decisions.split('\n').some(line => line.trimStart().startsWith('- [ ]'))
    );
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
      pool: false,
      station: column.name,
      phaseRow: card.phaseRow,
      reason: card.reason,
      layers: card.layers,
      ask: card.ask,
      unanswered: card.unanswered,
      gateOff: card.gateOff,
      occasion: card.occasion,
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
    pool: true,
    station: card.station,
    phaseRow: card.phaseRow,
    reason: card.reason,
    layers: card.layers,
    ask: card.ask,
    unanswered: card.unanswered,
    gateOff: card.gateOff,
  }));
  return [...taken, ...pool];
}

function publish(row: Fact, action: string | undefined): SnapshotRow {
  const shown = action === '' ? undefined : action;
  return {
    key: row.key,
    title: row.title,
    pool: row.pool,
    ...(row.station !== undefined ? {station: row.station} : {}),
    ...(shown !== undefined ? {action: shown} : {}),
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
  const model =
    surface.spine() ??
    buildSpine({
      key: row.key,
      station: row.station,
      focusBody: focus?.kind === 'focus' ? focus.body : undefined,
      gateOff: row.gateOff,
    });
  const action = surface.turn(row.key);
  return {
    key: row.key,
    title: row.title,
    spine: model,
    layers: SPINE_LAYERS.map(layer => ({layer, act: layerAct(layer, model, action)})),
  };
}

/** Header, rows, and the open spine. No HTML. */
export function snapshot(surface: SnapshotSurface, view: SnapshotView): WindowSnapshot {
  const board = surface.board();
  const drawn = facts(board);
  const opened = openCycle(surface, view, drawn);
  return {
    generation: view.generation,
    lamp: board.stepsStart,
    spy: surface.spyNote(),
    settings: surface.settings(),
    rows: drawn.map(row => publish(row, surface.turn(row.key))),
    ...(view.status !== undefined ? {status: view.status} : {}),
    ...(opened !== undefined ? {opened} : {}),
  };
}
