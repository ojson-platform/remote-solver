import type {SnapshotRow, WindowSnapshot} from '../snapshot.ts';

import assert from 'node:assert/strict';
import {requirement, scenario, spec} from '@ojson/spec-coverage';
import {test} from 'vitest';

import {
  busyEdges,
  emptyHold,
  holdGesture,
  paintFrame,
  releaseHold,
  settingsAct,
  type FrameHold,
} from './frame.ts';

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

function shot(): WindowSnapshot {
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
        plaque: {},
        choices: [],
        reason: 'вопросы 2',
        gateOff: {proposing: true, designing: true, accepting: true},
      },
    ],
  };
}

function rowOf(base: WindowSnapshot): SnapshotRow {
  const row = base.rows[0];
  if (!row) {
    throw new Error('fixture row');
  }
  return row;
}

function withGate(gateOff: NonNullable<SnapshotRow['gateOff']>): WindowSnapshot {
  const base = shot();
  return {...base, rows: [{...rowOf(base), gateOff}]};
}

function openedShot(): WindowSnapshot {
  const base = shot();
  const opened = paintFrame(
    base,
    holdGesture(emptyHold(), 1, 'open', new URLSearchParams('key=7'), base),
  ).opened;
  assert.ok(opened);
  return {...base, opened};
}

function spineReady(opened: object): boolean | undefined {
  if (!('spineReady' in opened)) {
    return undefined;
  }
  const value: unknown = opened.spineReady;
  return typeof value === 'boolean' ? value : undefined;
}

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

spec('live-frame', () => {
  requirement('Opening paints the ticket before the spine is read', () => {
    scenario('Opening shows the ticket title before the spine is read', () => {
      const base = shot();
      const hold = holdGesture(emptyHold(), 1, 'open', new URLSearchParams('key=7'), base);
      const opened = paintFrame(base, hold).opened;
      assert.ok(opened);
      assert.equal(opened.key, '7');
      assert.equal(opened.title, 'Заголовок');
      assert.deepEqual(opened.blocks, [{kind: 'reason', line: 'вопросы 2'}]);
      assert.equal(spineReady(opened), false);
      assert.equal(opened.spine.open, 'Specify');
      assert.equal(opened.spine.accept, 'На приёмке мерж ждёт человека.');
      assert.equal(opened.spine.station, 'specifying');
      assert.deepEqual(
        opened.layers.map(item => [item.layer, item.act]),
        [
          ['Change', 'none'],
          ['Plan', 'gate'],
          ['Specify', 'gate'],
          ['Design', 'gate'],
          ['Tasks', 'none'],
          ['Code', 'none'],
          ['Accept', 'gate'],
        ],
      );
      assert.equal(base.opened, undefined);
    });
  });

  requirement('A hold outranks a snapshot that has not caught up', () => {
    scenario('Closing hides the drawer before the response', () => {
      const open = openedShot();
      const hold = holdGesture(emptyHold(), 2, 'close-card', new URLSearchParams(), open);
      assert.equal(paintFrame(open, hold).opened, undefined);
    });

    scenario('A snapshot during close leaves the drawer closed', () => {
      const open = openedShot();
      const hold = holdGesture(emptyHold(), 2, 'close-card', new URLSearchParams(), open);
      const arrived = {
        ...open,
        spy: 'опрос',
        rows: open.rows.map(row => ({...row, title: 'Новый'})),
      };
      const painted = paintFrame(arrived, hold);
      assert.equal(painted.opened, undefined);
      assert.equal(painted.spy, 'опрос');
      assert.equal(painted.lamp, true);
      assert.equal(painted.rows[0]?.title, 'Новый');
    });

    scenario('Settings open before the response', () => {
      const base = shot();
      const hold = holdGesture(emptyHold(), 1, 'open-settings', new URLSearchParams(), base);
      const painted = paintFrame(base, hold);
      assert.equal(painted.settings.open, true);
      assert.equal(painted.settings.agent, 'cursor');
      assert.equal(base.settings.open, false);
    });

    scenario('A gate click flips the sign before the response', () => {
      const base = withGate({proposing: true});
      const params = new URLSearchParams('key=7&station=specifying');
      const prior = emptyHold();
      const hold = holdGesture(prior, 1, 'gate', params, base);
      const painted = paintFrame(base, hold);
      assert.equal(painted.rows[0]?.gateOff?.specifying, true);
      assert.equal(painted.rows[0]?.gateOff?.proposing, true);
      assert.equal(base.rows[0]?.gateOff?.specifying, undefined);
      assert.equal(prior.gates.length, 0);

      const asking = shot();
      const asked = holdGesture(emptyHold(), 1, 'gate', params, asking);
      assert.equal(paintFrame(asking, asked).rows[0]?.gateOff?.specifying, undefined);
      assert.deepEqual(asked.gates, []);

      const marked = withGate({specifying: true});
      const cleared = holdGesture(
        emptyHold(),
        1,
        'gate',
        new URLSearchParams('key=7&station=specifying'),
        marked,
      );
      assert.equal(paintFrame(marked, cleared).rows[0]?.gateOff, undefined);
    });
  });

  requirement('The strip shows work that has not caught up', () => {
    scenario(
      'The window strip shows while an update is due and goes when the frame is caught up',
      () => {
        const due = {
          gestures: 1,
          reading: false,
          drawer: true,
          spineReady: true,
          settingsOpen: false,
          settingsGesture: false,
        };
        assert.equal(busyEdges(due).window, true);
        assert.equal(busyEdges({...due, gestures: 0, reading: true}).window, true);
        assert.equal(busyEdges({...due, gestures: 0}).window, false);
        assert.equal(
          busyEdges({...due, gestures: 0, settingsOpen: true, settingsGesture: true}).settings,
          true,
        );
        assert.equal(
          busyEdges({...due, gestures: 0, settingsOpen: false, settingsGesture: true}).settings,
          false,
        );
      },
    );

    scenario("The drawer strip shows until that ticket's spine is ready", () => {
      const waiting = {
        gestures: 0,
        reading: false,
        drawer: true,
        spineReady: false,
        settingsOpen: false,
        settingsGesture: false,
      };
      assert.deepEqual(busyEdges(waiting), {window: true, drawer: true, settings: false});
      assert.deepEqual(busyEdges({...waiting, spineReady: true}), {
        window: false,
        drawer: false,
        settings: false,
      });
    });
  });
});
