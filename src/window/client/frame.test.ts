import assert from 'node:assert/strict';
import {test} from 'vitest';

import {
  emptyHold,
  holdGesture,
  paintFrame,
  releaseHold,
  settingsAct,
  type FrameHold,
} from './frame.ts';
import {openedShot, shot, withGate} from './frame.fixture.ts';

const SETTINGS_ACTS = [
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
] as const;

test('settingsAct is exactly the sheet gestures', () => {
  for (const act of SETTINGS_ACTS) {
    assert.equal(settingsAct(act), true, act);
  }
  assert.equal(settingsAct('open'), false);
  assert.equal(settingsAct('close-card'), false);
  assert.equal(settingsAct('gate'), false);
});

test('releaseHold drops every entry of that seq', () => {
  const hold: FrameHold = {
    open: {seq: 4, key: '7'},
    settings: {seq: 4, open: true},
    gates: [
      {seq: 4, key: '7', station: 'specifying', off: true},
      {seq: 5, key: '7', station: 'designing', off: false},
    ],
  };
  assert.deepEqual(releaseHold(hold, 4), {
    gates: [{seq: 5, key: '7', station: 'designing', off: false}],
  });
  assert.equal(hold.gates.length, 2);
});

test('opening without a key leaves the frame', () => {
  const base = shot();
  const hold = holdGesture(emptyHold(), 1, 'open', new URLSearchParams(), base);
  assert.equal(paintFrame(base, hold).opened, undefined);
  assert.deepEqual(hold, {gates: []});
});

test('opening the ticket that is already open clears the drawer', () => {
  const open = openedShot();
  const hold = holdGesture(emptyHold(), 2, 'open', new URLSearchParams('key=7'), open);
  assert.equal(paintFrame(open, hold).opened, undefined);
});

test('close-settings paints the sheet shut', () => {
  const base = shot();
  const open = holdGesture(emptyHold(), 1, 'open-settings', new URLSearchParams(), base);
  const shown = paintFrame(base, open);
  const shut = holdGesture(open, 2, 'close-settings', new URLSearchParams(), shown);
  assert.equal(paintFrame(shown, shut).settings.open, false);
  assert.equal(open.settings?.open, true);
});

test('opening without a key does not close the drawer', () => {
  const open = openedShot();
  const hold = holdGesture(emptyHold(), 2, 'open', new URLSearchParams(), open);
  assert.equal(paintFrame(open, hold).opened?.key, '7');
});

test('an open hold keeps the server drawer for that key', () => {
  const open = openedShot();
  const drawer = open.opened;
  assert.ok(drawer);
  const server = {...open, opened: {...drawer, title: 'С сервера', blocks: []}};
  const hold: FrameHold = {open: {seq: 3, key: '7'}, gates: []};
  const painted = paintFrame(server, hold);
  assert.equal(painted.opened?.title, 'С сервера');
  assert.deepEqual(painted.opened?.blocks, []);
});

test('a missing row leaves the drawer that was already open', () => {
  const open = openedShot();
  const hold: FrameHold = {open: {seq: 3, key: '8'}, gates: []};
  assert.equal(paintFrame({...open, rows: []}, hold).opened?.key, '7');
});

test('a later gate click replaces the earlier flip of that station', () => {
  const base = withGate({proposing: true});
  const params = new URLSearchParams('key=7&station=specifying');
  const first = holdGesture(emptyHold(), 1, 'gate', params, base);
  const flipped = paintFrame(base, first);
  const second = holdGesture(first, 2, 'gate', params, flipped);
  assert.deepEqual(
    second.gates.map(gate => gate.seq),
    [2],
  );
  assert.equal(second.gates[0]?.off, false);
  assert.equal(paintFrame(flipped, second).rows[0]?.gateOff?.proposing, true);
  assert.equal(paintFrame(flipped, second).rows[0]?.gateOff?.specifying, undefined);
});

