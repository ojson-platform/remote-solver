import type {IssueKey, IssueLinkKind, IssueRecord, ThreadTarget, Tracker} from '../../machine.ts';

export type ArcanumHttp = {
  get(path: string): Promise<unknown>;
  post(path: string, body: unknown): Promise<void>;
};

export type ArcanumLinkPayload = {
  parent?: string | null;
  blocked_by?: string[];
  depends_on?: string[];
  blocks?: string[];
};

export function arcanumLinksPath(key: IssueKey): string {
  return `/v2/public/issue/${key}/links`;
}

export function arcanumLinkWritePath(key: IssueKey): string {
  return `/v2/public/issue/${key}/link`;
}

function linkKeys(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

export function arcanumLinksFromPayload(payload: ArcanumLinkPayload): Pick<
  IssueRecord,
  'parent' | 'dependsOn' | 'blockedBy' | 'blocks'
> {
  return {
    parent: payload.parent ?? undefined,
    dependsOn: linkKeys(payload.depends_on),
    blockedBy: linkKeys(payload.blocked_by),
    blocks: linkKeys(payload.blocks),
  };
}

export async function arcanumReadLinks(http: ArcanumHttp, key: IssueKey) {
  const payload = (await http.get(arcanumLinksPath(key))) as ArcanumLinkPayload;
  return arcanumLinksFromPayload(payload ?? {});
}

export async function arcanumWriteLink(
  http: ArcanumHttp,
  key: IssueKey,
  kind: IssueLinkKind,
  other: IssueKey,
): Promise<void> {
  await http.post(arcanumLinkWritePath(key), {kind, other});
}

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
  if (target.line === undefined || target.subject_type === 'file') {
    throw new Error('arcanum inline comment needs a line');
  }
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

export type ArcanumIssueSeed = {
  key: IssueKey;
  title: string;
  body: string;
  state: string;
  labels: string[];
  parent?: IssueKey;
  dependsOn?: IssueKey[];
  blockedBy?: IssueKey[];
  blocks?: IssueKey[];
};

/** Tracker port for Arcanum issue links and pull-request comments in tests. */
export function arcanumTracker(http: ArcanumHttp, seed: ArcanumIssueSeed[] = []): Tracker {
  const issues = seed.map(issue => ({
    ...issue,
    labels: [...issue.labels],
    dependsOn: issue.dependsOn ? [...issue.dependsOn] : [],
    blockedBy: issue.blockedBy ? [...issue.blockedBy] : [],
    blocks: issue.blocks ? [...issue.blocks] : [],
  }));
  const find = (key: IssueKey) => {
    const issue = issues.find(item => item.key === key);
    if (!issue) {
      throw new Error(`no arcanum issue ${key}`);
    }
    return issue;
  };
  const record = (issue: ArcanumIssueSeed): IssueRecord => ({
    key: issue.key,
    title: issue.title,
    body: issue.body,
    state: issue.state,
    labels: [...issue.labels],
    assignee: '',
    service: '',
    parent: issue.parent,
    dependsOn: [...(issue.dependsOn ?? [])],
    blockedBy: [...(issue.blockedBy ?? [])],
    blocks: [...(issue.blocks ?? [])],
  });
  return {
    login: async () => 'arcanum',
    listOpen: async () => {
      const open = issues.filter(issue => issue.state === 'OPEN');
      return Promise.all(
        open.map(async issue => {
          const remote = await arcanumReadLinks(http, issue.key);
          return {...record(issue), ...remote};
        }),
      );
    },
    issue: async key => {
      const remote = await arcanumReadLinks(http, key);
      return {...record(find(key)), ...remote};
    },
    assign: async () => {},
    labels: async key => [...find(key).labels],
    editLabels: async () => {},
    updateBody: async (key, body) => {
      find(key).body = body;
    },
    comment: async () => {},
    comments: async () => [],
    close: async (key, _comment) => {
      find(key).state = 'CLOSED';
    },
    link: async (key, kind, other) => {
      await arcanumWriteLink(http, key, kind, other);
    },
    phaseHint: () => '',
  };
}
