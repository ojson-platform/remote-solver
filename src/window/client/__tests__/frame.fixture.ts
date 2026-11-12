import type {SnapshotRow, WindowSnapshot} from '../../snapshot.ts';

import assert from 'node:assert/strict';

import {emptyHold, holdGesture, paintFrame} from '../frame.ts';

export function shot(): WindowSnapshot {
  return {
    generation: 1,
    lamp: true,
    spy: 'тихо',
    settings: {
      open: false,
      agent: 'cursor',
      models: {
        mechanical: {value: '', needsValue: false},
        judgment: {value: '', needsValue: false},
      },
      watch: [],
      roots: {arcadia: '', github: ''},
      roles: [],
    },
    overlay: {
      file: '.aifactory/config.yaml',
      checkout: '',
      agent: '',
      models: {
        mechanical: {value: '', needsValue: false},
        judgment: {value: '', needsValue: false},
      },
      watch: [],
    },
    serviceConfig: {file: 'openspec/config.yaml', checkout: '', save: false},
    checkouts: [],
    serviceDirty: false,
    service: {},
    banners: [],
    roles: [],
    reviewPlaces: {},
    rows: [
      {
        key: '7',
        title: 'Заголовок',
        pool: false,
        station: 'specifying',
        plaque: {lines: []},
        choices: [],
        reason: 'вопросы 2',
        gateOff: {proposing: true, designing: true, accepting: true},
      },
    ],
  };
}

export function rowOf(base: WindowSnapshot): SnapshotRow {
  const row = base.rows[0];
  if (!row) {
    throw new Error('fixture row');
  }
  return row;
}

export function withGate(gateOff: NonNullable<SnapshotRow['gateOff']>): WindowSnapshot {
  const base = shot();
  return {...base, rows: [{...rowOf(base), gateOff}]};
}

export function openedShot(): WindowSnapshot {
  const base = shot();
  const opened = paintFrame(
    base,
    holdGesture(emptyHold(), 1, 'open', new URLSearchParams('key=7'), base),
  ).opened;
  assert.ok(opened);
  return {...base, opened};
}

export function spineReady(opened: object): boolean | undefined {
  if (!('spineReady' in opened)) {
    return undefined;
  }
  const value: unknown = opened.spineReady;
  return typeof value === 'boolean' ? value : undefined;
}
