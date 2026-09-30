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
  if (layer) {
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

/** Any marker token, well-formed or not, or the robot mark. Text a reviewer remark must not carry. */
export function mentionsGrammar(body: string): boolean {
  return body.includes('🤖') || TOKENS.some(token => body.includes(token));
}
