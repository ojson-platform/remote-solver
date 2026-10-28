import type {SpecEntry} from '../spec-diff.ts';
import type {ReviewGate, Spine, SpineLayer, SpineSection, SpineSourceLine} from '../spine.ts';

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

/** Open capability rows. Closing one drops its expanded gaps. */
export type SpecOpen = {id: string; open: boolean};

/** A gap opens and stays open. A second click does not hide its lines. */
export function revealFold(open: readonly number[], index: number): number[] {
  if (open.includes(index)) {
    return [...open];
  }
  return [...open, index];
}

/** The first capability starts open. A scenario jump forces its capability open. */
export function capIsOpen(
  id: string,
  index: number,
  remembered: readonly SpecOpen[],
  forced: readonly string[],
): boolean {
  if (forced.includes(id)) {
    return true;
  }
  const found = remembered.find(item => item.id === id);
  if (found) {
    return found.open;
  }
  return index === 0;
}

export function rememberedSpec(
  remembered: readonly SpecOpen[],
  id: string,
  open: boolean,
): SpecOpen[] {
  return [...remembered.filter(item => item.id !== id), {id, open}];
}

/** A jump keeps the capability open. Closing it removes that force. */
export function forcedAfterSpec(forced: readonly string[], id: string, open: boolean): string[] {
  if (!open) {
    return forced.filter(item => item !== id);
  }
  if (forced.includes(id)) {
    return [...forced];
  }
  return [...forced, id];
}

/** Closing a capability hides the lines that were expanded inside it. */
export function foldsAfterSpec<T extends {id: string}>(
  folds: readonly T[],
  id: string,
  open: boolean,
): T[] {
  if (open) {
    return [...folds];
  }
  return folds.filter(item => item.id !== id);
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

/** An empty spine row does not open. Any other row head does. */
export function rowHeadOpens(
  section: {getAttribute: (name: string) => string | null} | null,
): boolean {
  if (!section) {
    return false;
  }
  const className = section.getAttribute('class') ?? '';
  return !className.split(/\s+/).includes('is-quiet');
}

function lineHasBody(line: SpineSourceLine): boolean {
  const text = line.text.trim();
  return text !== '' && !/^###\s+\S/.test(text);
}

/** A document section the drawer can show. A heading with no body does not count. */
export function documentHasText(sections: readonly SpineSection[]): boolean {
  return sections.some(section => {
    if (section.heading === 'Open questions') {
      return section.lines.some(line => line.text.trim() !== '');
    }
    return section.lines.some(lineHasBody);
  });
}

function remarkShown(model: Spine, gate: ReviewGate, present: boolean): boolean {
  return model.pull && (present || model.reviewGate === gate);
}

/** The row has something to reveal. An empty row stays closed. */
export function layerHasFold(
  layer: SpineLayer,
  model: Spine,
  code: {unanswered: boolean; hook: boolean},
): boolean {
  switch (layer) {
    case 'Change':
      return false;
    case 'Plan':
      return (
        documentHasText(model.proposal.sections) ||
        remarkShown(model, 'proposed', model.proposal.present)
      );
    case 'Specify':
      return (
        model.capabilities.length > 0 ||
        remarkShown(model, 'specified', model.capabilities.length > 0)
      );
    case 'Design':
      return (
        documentHasText(model.design.sections) ||
        remarkShown(model, 'designed', model.design.present)
      );
    case 'Tasks':
      return model.tasks.length > 0;
    case 'Code':
      return (
        model.checks !== undefined ||
        model.diff ||
        model.rest.length > 0 ||
        model.pull ||
        code.unanswered ||
        code.hook
      );
    case 'Accept':
      return true;
  }
}

/** Empty plaque space opens the drawer. The issue link, Take, and the title button already do. */
export function plaqueClickOpens(target: {closest: (selector: string) => unknown} | null): boolean {
  if (!target?.closest || !target.closest('.gutter')) {
    return false;
  }
  return !target.closest('a') && !target.closest('.corner') && !target.closest('button');
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
