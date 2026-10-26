import type {SpecEntry} from '../spec-diff.ts';
import type {SpineLayer} from '../spine.ts';

export type LineDraft = {line: string; text: string; question: string};

/** Open fold indexes for one capability. The row list itself stays in client memory. */
export type OpenFold = {id: string; open: readonly number[]};

const SCENARIO_PREFIX = '#### Scenario: ';

const SPINE_LAYERS = [
  'Change',
  'Plan',
  'Specify',
  'Design',
  'Tasks',
  'Code',
  'Accept',
] as const satisfies readonly SpineLayer[];

function isSpineLayer(value: string): value is SpineLayer {
  return (SPINE_LAYERS as readonly string[]).includes(value);
}

/**
 * The layer a head click leaves open. The same row closes, so the spine can
 * have no open row. The caller cancels the label click so the checkbox stays
 * with this choice.
 */
export function toggledSpineLayer(
  current: SpineLayer | '',
  picked: string,
): SpineLayer | '' | undefined {
  if (!isSpineLayer(picked)) {
    return undefined;
  }
  return current === picked ? '' : picked;
}

/** An empty remembered layer stays closed. A new cycle or station opens the plaque row. */
export function keptSpineLayer(
  memory: {key?: string; station?: string; layer?: SpineLayer | ''},
  opened: {key: string; station: string | undefined; open: SpineLayer} | undefined,
): SpineLayer | '' | undefined {
  if (!opened) {
    return undefined;
  }
  if (memory.key !== opened.key || memory.station !== opened.station) {
    return opened.open;
  }
  if (memory.layer === undefined) {
    return opened.open;
  }
  return memory.layer;
}

/** A fold index toggles. Indexes that were not clicked stay in their order. */
export function toggleFold(open: readonly number[], index: number): number[] {
  if (open.includes(index)) {
    return open.filter(item => item !== index);
  }
  return [...open, index];
}

function scenarioLine(text: string, name: string): boolean {
  return text.trim() === `${SCENARIO_PREFIX}${name}`;
}

/** The first matching row wins. A hidden row names its fold; a visible row does not. */
export function scenarioTarget(
  rows: readonly SpecEntry[],
  capability: string,
  name: string,
): {capability: string; gap?: number; name: string} | undefined {
  for (let index = 0; index < rows.length; index += 1) {
    const entry = rows[index];
    if (entry === undefined) {
      continue;
    }
    if (entry.kind === 'gap') {
      const hidden = entry.hidden.some(row => scenarioLine(row.text, name));
      if (hidden) {
        return {capability, gap: index, name};
      }
      continue;
    }
    if (scenarioLine(entry.text, name)) {
      return {capability, name};
    }
  }
  return undefined;
}

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
export function focusStaysInForm(
  form: {contains: (node: Node) => boolean},
  next: Node | null,
): boolean {
  return next !== null && form.contains(next);
}
