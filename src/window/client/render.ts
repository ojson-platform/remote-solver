import type {WindowSnapshot} from '../snapshot.ts';
import type {SpineLayer} from '../spine.ts';

import {readFileSync} from 'node:fs';

import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';


import {WindowView} from './app.tsx';

const css = readFileSync(new URL('../face.css', import.meta.url), 'utf8');

/** The window as the open client draws it, plus the face rules tests match in the page. */
export function renderWindow(snapshot: WindowSnapshot, layer?: SpineLayer): string {
  return renderToStaticMarkup(createElement(WindowView, {snapshot, css, layer}));
}
