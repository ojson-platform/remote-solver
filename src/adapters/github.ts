import type {ReviewNote} from '../machine/port.ts';
import type {
  CheckState,
  Conversation,
  IssueRecord,
  Pull,
  Review,
  Thread,
  ThreadRecord,
  ThreadTarget,
  Tracker,
} from '../machine/port.ts';

import {execFileSync, spawn} from 'node:child_process';

import {authorIgnored} from '../machine/ignore.ts';
import {markRobot} from '../machine/marker.ts';
import {pullTitlePrefix} from '../machine/naming.ts';
import {spokeByRobot} from '../machine/review.ts';

export type CheckRollup = {
  state: string;
  statusCheckRollup: {name?: string; status?: string; conclusion?: string; state?: string}[] | null;
};

const FAILED = ['FAILURE', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED'];
const PENDING = ['QUEUED', 'IN_PROGRESS', 'PENDING', 'WAITING', 'REQUESTED'];

/** On GitHub the phase is an `sdd:<phase>` label. */
export function labelHint(from: string, to: string): string {
  return `replace the label \`sdd:${from}\` with \`sdd:${to}\``;
}

export type Repo = {owner: string; name: string; slug: string};

export function repo(): Repo {
  const url = execFileSync('git', ['remote', 'get-url', 'origin'], {encoding: 'utf8'}).trim();
  const match = url.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (!match) {
    throw new Error(`Cannot parse GitHub repo from origin: ${url}`);
  }
  return {owner: match[1], name: match[2], slug: `${match[1]}/${match[2]}`};
}

export type ReviewComment = {
  path: string;
  body: string;
  line?: number;
  side?: 'RIGHT';
  subject_type?: 'file';
};

/** The body GitHub publishes as one review. Inline notes are threads; the rest is the review summary. */
export function changesPayload(
  head: string,
  notes: ReviewNote[],
): {
  commit_id: string;
  event: 'REQUEST_CHANGES';
  body: string;
  comments: ReviewComment[];
} {
  const comments: ReviewComment[] = [];
  const loose: string[] = [];
  for (const note of notes) {
    if (!note.path) {
      loose.push(note.body);
      continue;
    }
    if (note.line) {
      comments.push({path: note.path, body: note.body, line: note.line, side: 'RIGHT'});
      continue;
    }
    comments.push({path: note.path, body: note.body, subject_type: 'file'});
  }
  const body = comments.length === 0 ? loose.join('\n\n') : '';
  return {commit_id: head, event: 'REQUEST_CHANGES', body, comments};
}

/** One review thread as GitHub GraphQL returns it. */
export type ThreadNode = {
  id: string;
  isResolved: boolean;
  path: string;
  line: number | null;
  comments: {nodes: {databaseId: number; author: {login: string} | null; body: string}[]};
};

/** The handles a skill answers with: the thread id resolves, the latest comment id takes the reply. */
export function threadRecord(node: ThreadNode): ThreadRecord {
  const comment = node.comments.nodes[0];
  return {
    id: node.id,
    comment: comment ? String(comment.databaseId) : '',
    path: node.path,
    line: node.line,
    resolved: node.isResolved,
    body: comment?.body ?? '',
  };
}

function command(
  file: string,
  args: string[],
  input?: string,
): Promise<{stdout: string; stderr: string}> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {stdio: ['pipe', 'pipe', 'pipe']});
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', code => {
      if (code) {
        reject(Object.assign(new Error(`${file} exited ${code}`), {stdout, stderr}));
        return;
      }
      resolve({stdout, stderr});
    });
    if (input) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

export async function gh(args: string[], input?: string): Promise<string> {
  const {stdout} = await command('gh', args, input);
  return stdout;
}

/** GitHub check vocabulary stays in this adapter. The machine sees CheckState. */
export function classifyChecks(view: CheckRollup, name?: string): CheckState {
  if (view.state === 'MERGED') {
    return 'green';
  }
  const rollup = (view.statusCheckRollup ?? []).filter(check => !name || check.name === name);
  if (rollup.length === 0) {
    return 'none';
  }
  const failed = rollup.some(check => FAILED.includes(check.conclusion ?? check.state ?? ''));
  if (failed) {
    return 'red';
  }
  const pending = rollup.some(check => {
    const status = check.status ?? check.state ?? '';
    return PENDING.includes(status) && !check.conclusion;
  });
  return pending ? 'pending' : 'green';
}

type RawIssue = {
  number: number;
  title: string;
  body: string | null;
  state: string;
  labels: {name: string}[];
  assignees?: {login: string}[];
};

/** A pull belongs to an issue when its title starts with `#<key>:` or `#<key> `. */
export function linkedTitle(key: string, title: string): boolean {
  return title.startsWith(pullTitlePrefix(key)) || title.startsWith(`#${key} `);
}

/** Parent and Depends are body lines on GitHub. Tracker will read its own link fields. */
export function linksFrom(body: string): {parent?: string; dependsOn: string[]} {
  const parent = /^Parent:\s*#(\S+)/m.exec(body)?.[1];
  const dependsOn = [...body.matchAll(/^Depends:\s*#(\S+)/gm)].map(match => match[1]);
  return {parent, dependsOn};
}

function asRecord(issue: RawIssue): IssueRecord {
  const body = issue.body ?? '';
  const links = linksFrom(body);
  return {
    key: String(issue.number),
    title: issue.title,
    body,
    state: issue.state,
    labels: issue.labels.map(label => label.name),
    assignee: issue.assignees?.[0]?.login ?? '',
    service: '',
    parent: links.parent,
    dependsOn: links.dependsOn,
  };
}

export type GitHubAdapters = {
  /** Base branch passed to `gh pr create`. */
  prBase?: string;
  ignoreComments?: RegExp[];
};

export function githubAdapters(options: GitHubAdapters = {}): {tracker: Tracker; review: Review} {
  const prBase = options.prBase ?? 'master';
  const ignored = options.ignoreComments ?? [];
  let slug: string | null = null;
  let user: string | null = null;
  const repoSlug = () => {
    if (!slug) {
      slug = repo().slug;
    }
    return slug;
  };
  const login = async () => {
    if (!user) {
      user = (await gh(['api', 'user', '--jq', '.login'])).trim();
    }
    return user;
  };
  const readIssue = async (key: string): Promise<RawIssue> =>
    JSON.parse(
      await gh([
        'issue',
        'view',
        key,
        '--repo',
        repoSlug(),
        '--json',
        'number,title,body,state,labels,assignees',
      ]),
    ) as RawIssue;

  const tracker: Tracker = {
    login,
    async listOpen() {
      const found = JSON.parse(
        await gh([
          'issue',
          'list',
          '--repo',
          repoSlug(),
          '--state',
          'open',
          '--limit',
          '100',
          '--json',
          'number,title,body,state,labels,assignees',
        ]),
      ) as RawIssue[];
      return found.map(asRecord);
    },
    issue: async key => asRecord(await readIssue(key)),
    async assign(key, login) {
      await gh(['issue', 'edit', key, '--repo', repoSlug(), '--add-assignee', login]);
    },
    labels: async key => asRecord(await readIssue(key)).labels,
    async editLabels(key, add, remove) {
      if (add.length === 0 && remove.length === 0) {
        return;
      }
      const args = ['issue', 'edit', key, '--repo', repoSlug()];
      for (const label of add) {
        args.push('--add-label', label);
      }
      if (remove.length) {
        args.push('--remove-label', remove.join(','));
      }
      await gh(args);
    },
    async updateBody(key, body) {
      await gh(['issue', 'edit', key, '--repo', repoSlug(), '--body', body]);
    },
    async comment(key, body) {
      await gh(['issue', 'comment', key, '--repo', repoSlug(), '--body', markRobot(body)]);
    },
    async close(key, comment) {
      await gh(['issue', 'close', key, '--repo', repoSlug(), '--comment', markRobot(comment)]);
    },
    phaseHint: labelHint,
  };

  const linked = async (key: string) => {
    const found = JSON.parse(
      await gh([
        'pr',
        'list',
        '--repo',
        repoSlug(),
        '--state',
        'all',
        '--search',
        `#${key} in:title`,
        '--json',
        'number,title,state',
        '--limit',
        '20',
      ]),
    ) as {number: number; title: string; state: string}[];
    return found.filter(pr => linkedTitle(key, pr.title));
  };

  const review: Review = {
    async pulls(key) {
      const found: Pull[] = [];
      for (const pr of await linked(key)) {
        const id = String(pr.number);
        if (pr.state !== 'OPEN') {
          found.push({id, title: pr.title, state: pr.state, checks: 'none'});
          continue;
        }
        const view = JSON.parse(
          await gh(['pr', 'view', id, '--repo', repoSlug(), '--json', 'statusCheckRollup,state']),
        ) as CheckRollup;
        found.push({id, title: pr.title, state: pr.state, checks: classifyChecks(view)});
      }
      return found;
    },
    async threads(pull) {
      return (await this.threadList(pull)).map(thread => ({
        resolved: thread.resolved,
        body: thread.body,
      }));
    },
    async threadList(pull) {
      const {owner, name} = repo();
      const query = `query($owner:String!,$name:String!,$number:Int!){
        repository(owner:$owner, name:$name) {
          pullRequest(number:$number) {
            reviewThreads(first:100) {
              nodes {
                id
                isResolved
                path
                line
                comments(last:1) { nodes { databaseId author { login } body } }
              }
            }
          }
        }
      }`;
      const data = JSON.parse(
        await gh([
          'api',
          'graphql',
          '-f',
          `query=${query}`,
          '-f',
          `owner=${owner}`,
          '-f',
          `name=${name}`,
          '-F',
          `number=${pull}`,
        ]),
      ) as {
        data: {
          repository: {
            pullRequest: {
              reviewThreads: {nodes: ThreadNode[]};
            } | null;
          };
        };
      };
      const nodes = data.data.repository.pullRequest?.reviewThreads.nodes ?? [];
      return nodes.flatMap(node => {
        const record = threadRecord(node);
        return authorIgnored(node.comments.nodes[0]?.author?.login ?? '', ignored) ? [] : [record];
      });
    },
    async comments(pull) {
      const comments = JSON.parse(
        await gh([
          'api',
          `repos/${repoSlug()}/issues/${pull}/comments`,
          '--jq',
          '[.[] | {login: .user.login, body}]',
        ]),
      ) as {login: string; body: string}[];
      return comments.map(comment => ({
        body: comment.body,
        robot: spokeByRobot(comment.body, comment.login, ignored),
      }));
    },
    async ensurePull(key, title, body) {
      const open = (await linked(key))
        .filter(pr => pr.state === 'OPEN')
        .map(pr => String(pr.number));
      if (open[0]) {
        return open[0];
      }
      const url = (
        await gh([
          'pr',
          'create',
          '--repo',
          repoSlug(),
          '--base',
          prBase,
          '--title',
          title,
          '--body',
          body,
        ])
      ).trim();
      const id = url.match(/\/(\d+)\s*$/)?.[1];
      if (!id) {
        throw new Error(`gh pr create returned no pull number: ${url}`);
      }
      return id;
    },
    async openThread(pull, target: ThreadTarget) {
      await gh([
        'api',
        '--method',
        'POST',
        `repos/${repoSlug()}/pulls/${pull}/comments`,
        '-f',
        `commit_id=${target.commit}`,
        '-f',
        `path=${target.path}`,
        '-F',
        `line=${target.line}`,
        '-f',
        `body=${markRobot(target.body)}`,
      ]);
    },
    async reply(pull, comment, body) {
      await gh([
        'api',
        '--method',
        'POST',
        `repos/${repoSlug()}/pulls/${pull}/comments/${comment}/replies`,
        '-f',
        `body=${markRobot(body)}`,
      ]);
    },
    async say(pull, body) {
      await gh(['issue', 'comment', pull, '--repo', repoSlug(), '--body', markRobot(body)]);
    },
    async speak(pull, body) {
      await gh(['issue', 'comment', pull, '--repo', repoSlug(), '--body', body]);
    },
    async flag(pull, head, notes) {
      const payload = changesPayload(head, notes);
      const post = () =>
        gh(
          ['api', '--method', 'POST', '--input', '-', `repos/${repoSlug()}/pulls/${pull}/reviews`],
          JSON.stringify(payload),
        );
      try {
        await post();
      } catch {
        const text = notes.map(note => note.body).join('\n\n');
        try {
          await gh(
            [
              'api',
              '--method',
              'POST',
              '--input',
              '-',
              `repos/${repoSlug()}/pulls/${pull}/reviews`,
            ],
            JSON.stringify(
              changesPayload(
                head,
                notes.map(note => ({body: note.body})),
              ),
            ),
          );
        } catch {
          await this.speak(pull, text);
          return;
        }
        await this.speak(pull, text);
        return;
      }
      if (payload.comments.length === 0 && payload.body) {
        await this.speak(pull, payload.body);
      }
      const loose = notes
        .filter(note => !note.path)
        .map(note => note.body)
        .join('\n\n');
      if (payload.comments.length > 0 && loose) {
        await this.speak(pull, loose);
      }
    },
    async range(pull) {
      const view = JSON.parse(
        await gh(['pr', 'view', pull, '--repo', repoSlug(), '--json', 'headRefOid,baseRefOid']),
      ) as {
        headRefOid?: string;
        baseRefOid?: string;
      };
      return {head: view.headRefOid ?? '', base: view.baseRefOid ?? null};
    },
    async resolveThread(thread) {
      const query =
        'mutation($id:ID!){ resolveReviewThread(input:{threadId:$id}) { thread { isResolved } } }';
      await gh(['api', 'graphql', '-f', `query=${query}`, '-f', `id=${thread}`]);
    },
    async checksText(pull) {
      try {
        const {stdout, stderr} = await command('gh', ['pr', 'checks', pull, '--repo', repoSlug()]);
        return `${stdout}${stderr}`;
      } catch (error) {
        const stdout =
          error && typeof error === 'object' && 'stdout' in error ? String(error.stdout) : '';
        const stderr =
          error && typeof error === 'object' && 'stderr' in error ? String(error.stderr) : '';
        return `${stdout}${stderr}`;
      }
    },
    async merge(pull) {
      try {
        await gh(['pr', 'merge', pull, '--repo', repoSlug(), '--rebase']);
      } catch (error) {
        const stderr =
          error && typeof error === 'object' && 'stderr' in error ? String(error.stderr) : '';
        const message = error instanceof Error ? error.message : String(error);
        if (!/already merged/i.test(`${message}\n${stderr}`)) {
          throw error;
        }
      }
      const view = JSON.parse(
        await gh(['pr', 'view', pull, '--repo', repoSlug(), '--json', 'state']),
      ) as {
        state?: string;
      };
      if (view.state !== 'MERGED') {
        throw new Error(`merge of PR #${pull} left it ${view.state ?? 'OPEN'}`);
      }
    },
  };

  return {tracker, review};
}

export type MemoryIssue = {
  key: string;
  title: string;
  body: string;
  state: string;
  labels: string[];
  parent?: string;
  dependsOn?: string[];
  /** Absent means the runner. Empty string means nobody. */
  assignee?: string;
  /** Directory of the service. Empty or absent means the chat's directory. */
  service?: string;
};

export type MemorySeed = {
  user?: string;
  issues?: MemoryIssue[];
  pulls?: Record<string, {id: string; title: string; state: string}[]>;
  threads?: Record<string, Thread[]>;
  /** Full records. When absent, `threads` are served with placeholder handles. */
  threadList?: Record<string, ThreadRecord[]>;
  comments?: Record<string, Conversation[]>;
  checks?: Record<string, {checks: CheckState}>;
  checksText?: Record<string, string>;
  ranges?: Record<string, {head: string; base: string | null}>;
};

export type MemoryPorts = {tracker: Tracker; review: Review; calls: string[]};

export function memoryPorts(seed: MemorySeed = {}): MemoryPorts {
  const issues = (seed.issues ?? []).map(issue => ({
    ...issue,
    labels: [...issue.labels],
    dependsOn: issue.dependsOn ? [...issue.dependsOn] : undefined,
  }));
  const calls: string[] = [];
  const find = (key: string) => {
    const issue = issues.find(item => item.key === key);
    if (!issue) {
      throw new Error(`no issue ${key}`);
    }
    return issue;
  };
  const record = (issue: MemoryIssue): IssueRecord => {
    const links = linksFrom(issue.body);
    return {
      key: issue.key,
      title: issue.title,
      body: issue.body,
      state: issue.state,
      labels: [...issue.labels],
      assignee: issue.assignee ?? seed.user ?? 'robot',
      service: issue.service ?? '',
      parent: issue.parent ?? links.parent,
      dependsOn: issue.dependsOn ?? links.dependsOn,
    };
  };
  const tracker: Tracker = {
    login: async () => {
      calls.push('login');
      return seed.user ?? 'robot';
    },
    listOpen: async () => {
      calls.push('listOpen');
      return issues.filter(issue => issue.state === 'OPEN').map(record);
    },
    issue: async key => {
      calls.push('issue');
      return record(find(key));
    },
    async assign(key, login) {
      calls.push('assign');
      find(key).assignee = login;
    },
    labels: async key => {
      calls.push('labels');
      return [...find(key).labels];
    },
    async editLabels(key, add, remove) {
      calls.push('editLabels');
      const issue = find(key);
      issue.labels = issue.labels.filter(name => !remove.includes(name));
      for (const label of add) {
        if (!issue.labels.includes(label)) {
          issue.labels.push(label);
        }
      }
    },
    async updateBody(key, body) {
      calls.push('updateBody');
      find(key).body = body;
    },
    async comment(_key, body) {
      calls.push('comment');
      calls.push(`body:${markRobot(body)}`);
    },
    async close(key, comment) {
      calls.push(`close:${comment}`);
      calls.push(`body:${markRobot(comment)}`);
      find(key).state = 'CLOSED';
    },
    phaseHint: labelHint,
  };
  const review: Review = {
    async pulls(key) {
      calls.push('pulls');
      return (seed.pulls?.[key] ?? []).map(pr => {
        const checks = seed.checks?.[pr.id] ?? {
          checks: 'none' as const,
        };
        return {...pr, ...checks};
      });
    },
    async threads(pull) {
      calls.push('threads');
      return seed.threads?.[pull] ?? seed.threadList?.[pull] ?? [];
    },
    async threadList(pull) {
      calls.push('threadList');
      const full = seed.threadList?.[pull];
      if (full) {
        return full;
      }
      return (seed.threads?.[pull] ?? []).map((thread, index) => ({
        ...thread,
        id: `T${index + 1}`,
        comment: `C${index + 1}`,
        path: '',
        line: null,
      }));
    },
    async comments(pull) {
      calls.push('comments');
      return seed.comments?.[pull] ?? [];
    },
    async ensurePull(key) {
      calls.push('ensurePull');
      const open = (seed.pulls?.[key] ?? []).filter(pr => pr.state === 'OPEN').map(pr => pr.id);
      return open[0] ?? 'new';
    },
    async openThread(_pull, target) {
      calls.push('openThread');
      calls.push(`body:${markRobot(target.body)}`);
    },
    async reply(_pull, _comment, body) {
      calls.push('reply');
      calls.push(`body:${markRobot(body)}`);
    },
    async say(_pull, body) {
      calls.push('say');
      calls.push(`body:${markRobot(body)}`);
    },
    async speak(_pull, body) {
      calls.push('speak');
      calls.push(`body:${body}`);
    },
    async flag(_pull, head, notes) {
      calls.push('flag');
      calls.push(`head:${head}`);
      const loose: string[] = [];
      for (const note of notes) {
        if (note.path) {
          calls.push(`at:${note.path}:${note.line ?? ''}:${note.body}`);
          continue;
        }
        loose.push(note.body);
        calls.push(`loose:${note.body}`);
      }
      if (loose.length > 0) {
        calls.push('speak');
        calls.push(`body:${loose.join('\n\n')}`);
      }
    },
    async range(pull) {
      calls.push('range');
      return seed.ranges?.[pull] ?? {head: '', base: null};
    },
    async resolveThread() {
      calls.push('resolveThread');
    },
    async checksText(pull) {
      calls.push('checksText');
      return seed.checksText?.[pull] ?? '';
    },
    async merge(pull) {
      calls.push(`merge:${pull}`);
      for (const list of Object.values(seed.pulls ?? {})) {
        for (const pr of list) {
          if (pr.id === pull) {
            pr.state = 'MERGED';
          }
        }
      }
    },
  };
  return {tracker, review, calls};
}
