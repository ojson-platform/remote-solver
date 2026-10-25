export type LineDraft = {line: string; text: string; question: string};

export function draftsAfterClick(
  open: readonly {line: string; text: string}[],
  target: string,
): {line: string; text: string}[] {
  const current = open.find(item => item.line === target);
  if (current?.text.trim() === '') {
    return open.filter(item => item.line !== target && item.text.trim() !== '');
  }
  const kept = open.filter(item => item.line === target || item.text.trim() !== '');
  if (current) {
    return kept;
  }
  return [...open.filter(item => item.text.trim() !== ''), {line: target, text: ''}];
}

export function lineFieldClosesOnEscape(key: string, insideField: boolean): boolean {
  return key === 'Escape' && insideField;
}

/** A row-head click toggles the row when it misses the name and the gate or acceptance control. */
export function headClickToggles(target: {closest: (selector: string) => unknown} | null): boolean {
  if (!target?.closest) {
    return false;
  }
  return !target.closest('.acts') && !target.closest('label');
}

/** Keys the settings sheet uses to put the caret back after a redraw. */
export const SHEET_SCROLL_KEY = 'ai-factory-sheet-scroll';
export const SHEET_FIELD_KEY = 'ai-factory-sheet-field';

/** A pool card dropped on a station is Take. A drop on the card itself is not. */
export function gesture(type: string, value: string, kind: string): '' | 'take' {
  if (type === 'pool' && value !== '' && kind === 'station') {
    return 'take';
  }
  return '';
}

/** Prefer the board's own drag type, then text/plain. */
export function payload(event: {
  dataTransfer: {getData: (type: string) => string} | null;
}): [string, string] {
  const transfer = event.dataTransfer;
  if (!transfer) {
    return ['', ''];
  }
  const custom = transfer.getData('application/x-ai-factory');
  const raw = custom !== '' ? custom : transfer.getData('text/plain');
  const split = raw.indexOf('\n');
  if (split === -1) {
    return ['', ''];
  }
  return [raw.slice(0, split), raw.slice(split + 1)];
}

/** A pair form submits when focus leaves it, including when focus leaves the document. */
export function focusStaysInForm(form: {contains: (node: Node) => boolean}, next: Node | null): boolean {
  return next !== null && form.contains(next);
}
