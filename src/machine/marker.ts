/**
 * The marker grammar. Every reader of a reply body goes through `parseMarker`;
 * no other module matches `sdd:` tokens.
 */

export const ROBOT_MARK = '🤖 ';

export type Marker =
  | {kind: 'layer'; layer: string}
  | {kind: 'note'}
  | {kind: 'fixed'; commit: string | null}
  | {kind: 'begin'};

const TOKENS = ['sdd:fixed', 'sdd:note', 'sdd:layer=', 'sdd:begin'];

/** Layers a review thread may carry. Change is the directory, not a layer marker. */
export const THREAD_LAYER_MARKERS = [
  'proposal',
  'spec',
  'design',
  'tasks',
  'code',
  'out',
] as const;

/**
 * The one marker a body carries. `fixed` wins over everything else in the same
 * body, then `note`, then a layer, then the issue-mirror `begin`.
 */
export function parseMarker(body: string): Marker | null {
  if (body.includes('sdd:fixed')) {
    return {kind: 'fixed', commit: body.match(/sdd:fixed[ \t]+(\S+)/)?.[1] ?? null};
  }
  if (body.includes('sdd:note')) {
    return {kind: 'note'};
  }
  const layer = body.match(/sdd:layer=([a-z]+)/)?.[1];
  if (layer && (THREAD_LAYER_MARKERS as readonly string[]).includes(layer)) {
    return {kind: 'layer', layer};
  }
  return body.includes('sdd:begin') ? {kind: 'begin'} : null;
}

/** What `threads` prints: the layer, or the kind of the other markers. */
export function markerName(marker: Marker | null): string | null {
  if (!marker) {
    return null;
  }
  return marker.kind === 'layer' ? marker.layer : marker.kind;
}

export function markRobot(body: string): string {
  return body.startsWith('🤖') ? body : `${ROBOT_MARK}${body}`;
}

/** First line of an issue comment, without the robot mark. */
export function unmarkedLine(body: string): string {
  const first = (body.split('\n', 1)[0] ?? '').trim();
  return first.startsWith(ROBOT_MARK) ? first.slice(ROBOT_MARK.length).trim() : first;
}

/** Recognized focus markers on the first line. A focus marker is not a layer marker. */
export const FOCUS_MARKER_LINES = [
  'sdd:focus',
  'sdd:focus:plan',
  'sdd:focus:spec',
  'sdd:focus:design',
  'sdd:focus:tasks',
  'sdd:focus:code',
  'sdd:focus:accept',
] as const;

export type FocusMarkerLine = (typeof FOCUS_MARKER_LINES)[number];

const FOCUS_MIRROR: Record<Exclude<FocusMarkerLine, 'sdd:focus'>, string> = {
  'sdd:focus:plan': 'Plan',
  'sdd:focus:spec': 'Specify',
  'sdd:focus:design': 'Design',
  'sdd:focus:tasks': 'Tasks',
  'sdd:focus:code': 'Code',
  'sdd:focus:accept': 'Accept',
};

/** Mirror row name for a phase focus marker. Whole-pull-request `sdd:focus` maps to none. */
export function focusMirrorName(marker: FocusMarkerLine): string | null {
  return marker === 'sdd:focus' ? null : (FOCUS_MIRROR[marker] ?? null);
}

/** The focus marker on the first line, if any. Patterns such as `sdd:focus:other` are not markers. */
export function focusMarkerLine(body: string): FocusMarkerLine | null {
  const line = unmarkedLine(body);
  return (FOCUS_MARKER_LINES as readonly string[]).includes(line)
    ? (line as FocusMarkerLine)
    : null;
}

/** A focus record. The robot mark on the first line does not change that. */
export function isFocusRecord(body: string): boolean {
  return focusMarkerLine(body) !== null;
}

/** Any marker token, well-formed or not, or the robot mark. Text a reviewer remark must not carry. */
export function mentionsGrammar(body: string): boolean {
  return body.includes('🤖') || TOKENS.some(token => body.includes(token));
}
