/** The window face. Shapes and names are in `CONTEXT.md`. */

export const FACE = {
  bg: '#0e0d0b',
  bg2: '#171512',
  bg3: '#221f1b',
  line: 'rgba(244, 240, 230, 0.1)',
  ink: '#f4f0e6',
  muted: '#a3988a',
  brass: '#e6b35a',
  inkBrass: '#1c1408',
  green: '#8fce7a',
  red: '#ef7a68',
} as const;

export const rootCss = `  :root {
    color-scheme: dark;
    --bg: ${FACE.bg};
    --bg-2: ${FACE.bg2};
    --bg-3: ${FACE.bg3};
    --line: ${FACE.line};
    --ink: ${FACE.ink};
    --muted: ${FACE.muted};
    --brass: ${FACE.brass};
    --ink-brass: ${FACE.inkBrass};
    --green: ${FACE.green};
    --red: ${FACE.red};
  }`;

export const CROSS =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.2 4.2 11.8 11.8 M11.8 4.2 4.2 11.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

/** The send mark that sits inside a field. */
export const SEND_MARK =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.8 8.1 14.2 2.4 9.4 13.8 7.4 8.9 1.8 8.1Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M7.4 8.9 14.2 2.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';

/** A brass pill. `attrs` is raw attribute text and must include its leading space. */
export function pill(label: string, attrs = ''): string {
  return `<button class="cmd" type="submit"${attrs}>${label}</button>`;
}

/** A hairline pill. `attrs` is raw attribute text and must include its leading space. */
export function hairline(label: string, attrs = ''): string {
  return `<button class="quiet" type="submit"${attrs}>${label}</button>`;
}

/** Closes a sheet. `aria` is already escaped. */
export function crossButton(aria: string): string {
  return `<button class="x" type="submit" aria-label="${aria}">${CROSS}</button>`;
}

/** The send mark, as the field's submit control. */
export function sendMark(): string {
  return `<button class="send" type="submit" aria-label="Записать">${SEND_MARK}</button>`;
}

/** The circle that closes a field. */
export function fieldClose(): string {
  return `<button class="shut" type="button" data-dismiss-line aria-label="Закрыть">${CROSS}</button>`;
}
