import type {IssueLinkKind} from '../machine/port.ts';

import {arcanumLinkWritePath, arcanumLinksPath, type ArcanumLinkPayload} from './arcanum.ts';

export const specPath = 'openspec/changes/issue-1/specs/case-read/spec.md';
export const activeDiff = '/v1/pull-requests/42/active-diff?fields=id';
export const changelist = '/v2/public/diff/7/changelist?fields=path,entry_id';

type Posted = {path: string; body: unknown};

export function fakeHttp(active: unknown = {id: 7}, links: Record<string, ArcanumLinkPayload> = {}) {
  const gets: string[] = [];
  const posts: Posted[] = [];
  const store = {...links};
  const get = async (path: string): Promise<unknown> => {
    gets.push(path);
    if (path === activeDiff) {
      return active;
    }
    if (path === changelist) {
      return [{path: specPath, entry_id: 'e1'}];
    }
    if (path.startsWith('/v2/public/issue/') && path.endsWith('/links')) {
      const key = path.slice('/v2/public/issue/'.length, -'/links'.length);
      return store[key] ?? {parent: null, blocked_by: [], depends_on: [], blocks: []};
    }
    throw new Error(`unexpected get ${path}`);
  };
  const post = async (path: string, body: unknown): Promise<void> => {
    posts.push({path, body});
    if (path.startsWith('/v2/public/issue/') && path.endsWith('/link') && body && typeof body === 'object') {
      const key = path.slice('/v2/public/issue/'.length, -'/link'.length);
      const row = store[key] ?? {parent: null, blocked_by: [], depends_on: [], blocks: []};
      const kind = (body as {kind?: IssueLinkKind}).kind;
      const other = (body as {other?: string}).other;
      if (kind && other) {
        if (kind === 'parent') {
          row.parent = other;
        } else if (kind === 'blocked-by') {
          row.blocked_by = [...(row.blocked_by ?? []), other];
        } else if (kind === 'depends-on') {
          row.depends_on = [...(row.depends_on ?? []), other];
        } else if (kind === 'blocks') {
          row.blocks = [...(row.blocks ?? []), other];
        }
        store[key] = row;
      }
    }
  };
  return {get, post, gets, posts, store, linksPath: arcanumLinksPath, linkWritePath: arcanumLinkWritePath};
}
