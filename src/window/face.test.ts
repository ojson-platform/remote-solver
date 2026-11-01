import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'vitest';

import {FACE, crossButton, fieldClose, hairline, pill, rootCss, sendMark} from './face.ts';

test('the face emits the named controls', () => {
  assert.equal(pill('Настройки'), '<button class="cmd" type="submit">Настройки</button>');
  assert.equal(
    pill('Записать сервис', ' disabled'),
    '<button class="cmd" type="submit" disabled>Записать сервис</button>',
  );
  assert.equal(hairline('Удалить'), '<button class="quiet" type="submit">Удалить</button>');
  assert.match(crossButton('Закрыть'), /class="x"[^>]*aria-label="Закрыть"/);
  assert.match(sendMark(), /class="send"[^>]*aria-label="Записать"/);
  assert.match(fieldClose(), /class="shut"[^>]*aria-label="Закрыть"/);
  assert.match(rootCss, /--bg: #0e0d0b/);
  assert.match(rootCss, /--brass: #e6b35a/);
  assert.match(rootCss, /--line: rgba\(244, 240, 230, 0\.1\)/);
});

test('the stylesheet repeats the face values', () => {
  const css = readFileSync(new URL('./face.css', import.meta.url), 'utf8');
  for (const value of Object.values(FACE)) {
    assert.ok(css.includes(value), value);
  }
});

test('the drawer is a haze sheet', () => {
  const css = readFileSync(new URL('./face.css', import.meta.url), 'utf8');
  assert.match(
    css,
    /\.sidebar\s*\{[^}]*top:\s*calc\(var\(--bar\) \+ 12px\)[^}]*right:\s*12px[^}]*bottom:\s*12px[^}]*border-radius:\s*14px[^}]*rgba\(23, 21, 18, 0\.5\)[^}]*backdrop-filter:\s*blur\(12px\)/,
  );
  assert.match(
    css,
    /\.spine > section:has\(\.spine-pick:checked\) \.row\s*\{[^}]*rgba\(81, 61, 29, 0\.9\)/,
  );
  assert.match(
    css,
    /\.spine \.shut\s*\{[^}]*rgba\(230, 179, 90, 0\.12\)[^}]*rgba\(230, 179, 90, 0\.45\)/,
  );
  assert.match(css, /\.spine \.shut:hover\s*\{[^}]*inset 0 0 0 1px var\(--brass\)[^}]*scale\(1\.06\)/);
  assert.match(css, /\.round\.bang:hover\s*\{[^}]*scale\(1\.06\)/);
  assert.match(css, /\.tick:hover\s*\{\s*transform:\s*scale\(1\.06\)/);
  assert.match(css, /\.stop:hover\s*\{\s*transform:\s*scale\(1\.06\)/);
  assert.doesNotMatch(css, /\.stop:hover\s*\{[^}]*inset/);
  assert.match(
    css,
    /\.spine > section:not\(\.is-quiet\):not\(:has\(\.spine-pick:checked\)\):hover \.row\s*\{[^}]*margin:\s*-8px -16px[^}]*rgba\(230, 179, 90, 0\.2\)/,
  );
  assert.match(css, /\.gutter:hover\s*\{[^}]*rgba\(230, 179, 90, 0\.45\)/);
  assert.doesNotMatch(css, /\.round\.off:hover\s*\{[^}]*scale/);
});

test('the ground is a fixed slant', () => {
  const css = readFileSync(new URL('./face.css', import.meta.url), 'utf8');
  assert.match(css, /background-attachment:\s*fixed/);
  assert.match(css, /linear-gradient\(118deg,\s*#0c0b09[\s\S]*#6a5640/);
  assert.match(css, /body::before\s*\{[^}]*opacity:\s*0\.38/);
});
