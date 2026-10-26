import type {WindowSnapshot} from '../snapshot.ts';

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {test} from 'vitest';

import {App} from './app.tsx';
import {emptyHold, holdGesture, paintFrame} from './frame.ts';

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

/** Task 1 fixture, sheet open, drawer from an open hold. */
function openShot(): WindowSnapshot {
  const base = shot();
  const painted = paintFrame(
    base,
    holdGesture(emptyHold(), 1, 'open', new URLSearchParams('key=7'), base),
  );
  assert.ok(painted.opened);
  assert.equal(typeof painted.opened.spineReady, 'boolean');
  return {...painted, settings: {...painted.settings, open: true}};
}

test('draws a strip on the window, the drawer, and the sheet', () => {
  const snapshot = openShot();
  const on = renderToStaticMarkup(
    <App snapshot={snapshot} busy={{window: true, drawer: true, settings: true}} />,
  );
  assert.equal(on.match(/class="busy"/g)?.length, 3);

  const off = renderToStaticMarkup(<App snapshot={snapshot} />);
  assert.equal(off.includes('class="busy"'), false);
});

test('the sheet strip sticks to the visible top of the scroller', () => {
  const css = readFileSync(new URL('../face.css', import.meta.url), 'utf8');
  const busy = css.match(/\.busy \{[^}]*\}/);
  assert.ok(busy);
  assert.match(busy[0], /position:\s*absolute/);
  const sheetBusy = css.match(/\.sheet > \.busy \{[^}]*\}/);
  assert.ok(sheetBusy);
  assert.match(sheetBusy[0], /position:\s*sticky/);
  assert.match(sheetBusy[0], /top:\s*0/);
  assert.match(sheetBusy[0], /z-index:\s*3/);
  assert.match(sheetBusy[0], /margin-bottom:\s*-2px/);
  const sharedAt = css.indexOf('.sheet, .popup {');
  const unpaddedAt = css.indexOf('.sheet { padding: 0; }');
  assert.ok(sharedAt !== -1 && unpaddedAt > sharedAt);
  assert.match(css.slice(sharedAt, unpaddedAt), /overflow:\s*auto/);
  assert.match(css.slice(sharedAt, unpaddedAt), /padding:\s*18px/);
  assert.match(css, /\.sheet-body \{[^}]*padding:\s*18px/);
  assert.doesNotMatch(css, /\.popup > \.busy/);

  const on = renderToStaticMarkup(
    <App snapshot={openShot()} busy={{window: true, drawer: true, settings: true}} />,
  );
  assert.match(
    on,
    /<div class="sheet" role="dialog" aria-label="Настройки"><div class="busy" aria-hidden="true"><\/div><div class="sheet-body">/,
  );
});
