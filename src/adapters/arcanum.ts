import type {ThreadTarget} from '../machine/port.ts';

export type ArcanumHttp = {
  get(path: string): Promise<unknown>;
  post(path: string, body: unknown): Promise<unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function activeDiffId(value: unknown): number | undefined {
  if (!isRecord(value) || typeof value.id !== 'number') {
    return undefined;
  }
  return value.id;
}

function changelistEntry(value: unknown, path: string): string | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }
    if (item.path === path && typeof item.entry_id === 'string') {
      return item.entry_id;
    }
  }
  return undefined;
}

/** Inline comment on the active diff. The target body is posted unchanged. */
export async function arcanumOpenThread(
  http: ArcanumHttp,
  pull: string,
  target: ThreadTarget,
): Promise<void> {
  const active = await http.get(`/v1/pull-requests/${pull}/active-diff?fields=id`);
  const id = activeDiffId(active);
  if (id === undefined) {
    throw new Error('arcanum active diff has no id');
  }
  const listed = await http.get(`/v2/public/diff/${id}/changelist?fields=path,entry_id`);
  const entryId = changelistEntry(listed, target.path);
  if (entryId === undefined) {
    throw new Error(`arcanum changelist has no entry for ${target.path}`);
  }
  let side: 'new' | 'old' = 'new';
  if (target.side === 'left') {
    side = 'old';
  }
  await http.post(`/v2/public/diff/${id}/comment`, {
    entry_id: entryId,
    is_draft: false,
    side,
    line: target.line,
    size: 1,
    content: target.body,
  });
}

/** Pull-request comment. The body is posted unchanged. */
export async function arcanumSpeak(http: ArcanumHttp, pull: string, body: string): Promise<void> {
  await http.post(`/v2/public/pull-request/${pull}/comment`, {
    is_draft: false,
    content: body,
  });
}
