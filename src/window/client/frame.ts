import type {LayerAct, SnapshotRow, WindowSnapshot} from '../snapshot.ts';
import type {Spine, SpineLayer} from '../spine.ts';
import type {GateStation, SidebarBlock} from '../types.ts';

import {GATE_STATIONS, isGateStation} from '../types.ts';

export type FrameHold = {
  open?: {seq: number; key: string | null};
  settings?: {seq: number; open: boolean};
  gates: {seq: number; key: string; station: string; off: boolean}[];
};

const SETTINGS_ACTS = new Set<string>([
  'open-settings',
  'close-settings',
  'choose-agent',
  'leave-model',
  'leave-effort',
  'leave-speed',
  'leave-watch',
  'leave-roots',
  'rename-role',
  'choose-role-outcome',
  'set-role-text',
  'set-role-labels',
  'remove-role',
  'choose-checkout',
  'choose-overlay-agent',
  'leave-overlay-model',
  'leave-overlay-effort',
  'leave-overlay-speed',
  'leave-overlay-watch',
  'set-service-base',
  'set-service-branch',
  'add-service-queue',
  'set-service-queue',
  'remove-service-queue',
  'move-service-queue',
  'add-service-ignore',
  'set-service-ignore',
  'remove-service-ignore',
  'set-service-hook',
  'save-service',
]);

const SHELL_LAYERS = [
  'Change',
  'Plan',
  'Specify',
  'Design',
  'Tasks',
  'Code',
  'Accept',
] as const satisfies readonly SpineLayer[];

type ShellDrawer = NonNullable<WindowSnapshot['opened']> & {spineReady: false};

/** True when the gesture belongs on the settings sheet. */
export function settingsAct(act: string): boolean {
  return SETTINGS_ACTS.has(act);
}

/** No ticket, no sheet, and no gate flips. */
export function emptyHold(): FrameHold {
  return {gates: []};
}

function copyHold(hold: FrameHold): FrameHold {
  return {
    ...(hold.open ? {open: {...hold.open}} : {}),
    ...(hold.settings ? {settings: {...hold.settings}} : {}),
    gates: hold.gates.map(gate => ({...gate})),
  };
}

/** This station is still on, and every other gate is already off. That click asks first. */
function lastGateClick(row: SnapshotRow, station: string): boolean {
  if (!isGateStation(station) || row.gateOff?.[station] === true) {
    return false;
  }
  return GATE_STATIONS.every(name => name === station || row.gateOff?.[name] === true);
}

function gateIsOff(row: SnapshotRow, station: string): boolean {
  return isGateStation(station) && row.gateOff?.[station] === true;
}

function rememberGate(
  hold: FrameHold,
  seq: number,
  params: URLSearchParams,
  shot: WindowSnapshot,
): FrameHold {
  const key = params.get('key');
  const station = params.get('station');
  if (key === null || key === '' || station === null || station === '') {
    return hold;
  }
  const row = shot.rows.find(item => item.key === key);
  if (!row || lastGateClick(row, station)) {
    return hold;
  }
  return {
    ...hold,
    gates: [
      ...hold.gates.filter(gate => gate.key !== key || gate.station !== station),
      {seq, key, station, off: !gateIsOff(row, station)},
    ],
  };
}

/** Remember a frame the window already has until this response seq returns. */
export function holdGesture(
  hold: FrameHold,
  seq: number,
  act: string,
  params: URLSearchParams,
  shot: WindowSnapshot,
): FrameHold {
  const next = copyHold(hold);
  if (act === 'open') {
    const key = params.get('key');
    if (shot.opened?.key === key) {
      next.open = {seq, key: null};
    } else if (typeof key === 'string' && key !== '') {
      next.open = {seq, key};
    }
    return next;
  }
  if (act === 'close-card') {
    next.open = {seq, key: null};
    return next;
  }
  if (act === 'open-settings') {
    next.settings = {seq, open: true};
    return next;
  }
  if (act === 'close-settings') {
    next.settings = {seq, open: false};
    return next;
  }
  if (act === 'gate') {
    return rememberGate(next, seq, params, shot);
  }
  return next;
}

/** Drop what this seq wrote. The caller paints the honest snapshot next. */
export function releaseHold(hold: FrameHold, seq: number): FrameHold {
  return {
    ...(hold.open && hold.open.seq !== seq ? {open: {...hold.open}} : {}),
    ...(hold.settings && hold.settings.seq !== seq ? {settings: {...hold.settings}} : {}),
    gates: hold.gates.filter(gate => gate.seq !== seq),
  };
}

function shellOpen(station: string | undefined): SpineLayer {
  switch (station) {
    case 'proposing':
    case 'proposed':
      return 'Plan';
    case 'specifying':
    case 'specified':
      return 'Specify';
    case 'designing':
    case 'designed':
      return 'Design';
    case 'tasking':
      return 'Tasks';
    case 'implementing':
    case 'verifying':
      return 'Code';
    case 'accepting':
    case 'accepted':
      return 'Accept';
    default:
      return 'Change';
  }
}

function shellAct(layer: SpineLayer): LayerAct {
  if (layer === 'Plan' || layer === 'Specify' || layer === 'Design' || layer === 'Accept') {
    return 'gate';
  }
  return 'none';
}

function shellBlocks(row: SnapshotRow): SidebarBlock[] {
  if (row.reason !== undefined && row.reason !== '') {
    return [{kind: 'reason', line: row.reason}];
  }
  return [];
}

function shellSpine(row: SnapshotRow): Spine {
  return {
    open: shellOpen(row.station),
    station: row.station,
    lines: [],
    rest: [],
    proposal: {present: false, excerpt: '', sections: [], questions: []},
    capabilities: [],
    named: [],
    missingBaseline: [],
    design: {present: false, sections: [], questions: []},
    tasks: [],
    diff: false,
    pull: false,
    readPath: '',
    accept: 'На приёмке мерж ждёт человека.',
  };
}

/** Drawer from the row already on the board. The spine is not read yet. */
function shellDrawer(row: SnapshotRow): ShellDrawer {
  return {
    key: row.key,
    title: row.title,
    spineReady: false,
    spine: shellSpine(row),
    layers: SHELL_LAYERS.map(layer => ({layer, act: shellAct(layer)})),
    blocks: shellBlocks(row),
  };
}

function paintRow(row: SnapshotRow, gates: readonly FrameHold['gates'][number][]): SnapshotRow {
  if (gates.length === 0) {
    return row;
  }
  const gateOff: Partial<Record<GateStation, true>> = {...row.gateOff};
  for (const gate of gates) {
    if (!isGateStation(gate.station)) {
      continue;
    }
    if (gate.off) {
      gateOff[gate.station] = true;
    } else {
      delete gateOff[gate.station];
    }
  }
  const next: SnapshotRow = {...row};
  if (Object.keys(gateOff).length === 0) {
    delete next.gateOff;
    return next;
  }
  next.gateOff = gateOff;
  return next;
}

function paintRows(rows: readonly SnapshotRow[], gates: FrameHold['gates']): SnapshotRow[] {
  return rows.map(row =>
    paintRow(
      row,
      gates.filter(gate => gate.key === row.key),
    ),
  );
}

/** Paint the hold over a snapshot. A later snapshot does not undo the hold. */
export function paintFrame(
  shot: WindowSnapshot,
  hold: FrameHold,
  kept?: WindowSnapshot['opened'],
): WindowSnapshot {
  const next: WindowSnapshot = {...shot, rows: paintRows(shot.rows, hold.gates)};
  if (hold.settings) {
    next.settings = {...shot.settings, open: hold.settings.open};
  }
  const key = hold.open?.key;
  if (key === null) {
    delete next.opened;
  } else if (key !== undefined && shot.opened?.key !== key) {
    const row = shot.rows.find(item => item.key === key);
    if (row) {
      next.opened = kept?.key === key ? {...kept, title: row.title} : shellDrawer(row);
    }
  }
  return next;
}

/** One snapshot read, plus a single follow-up when another change arrives while it flies. */
export type ReadSlot = {flying: boolean; again: boolean};

/** Start a read, or remember that one more is needed when one is already flying. */
export function beginRead(slot: ReadSlot): {slot: ReadSlot; start: boolean} {
  if (slot.flying) {
    return {slot: {flying: true, again: true}, start: false};
  }
  return {slot: {flying: true, again: false}, start: true};
}

/** Finish a read. A change that arrived during it starts exactly one follow-up. */
export function endRead(slot: ReadSlot): {slot: ReadSlot; start: boolean} {
  if (slot.again) {
    return {slot: {flying: true, again: false}, start: true};
  }
  return {slot: {flying: false, again: false}, start: false};
}

export type BusyEdges = {window: boolean; drawer: boolean; settings: boolean};

/** Strips for a response, a read, a spine, or a settings gesture that has not returned. */
export function busyEdges(input: {
  gestures: number;
  reading: boolean;
  drawer: boolean;
  spineReady: boolean;
  settingsOpen: boolean;
  settingsGesture: boolean;
}): BusyEdges {
  const drawerBusy = input.drawer && !input.spineReady;
  return {
    window: input.gestures > 0 || input.reading || drawerBusy,
    drawer: drawerBusy,
    settings: input.settingsOpen && input.settingsGesture,
  };
}
