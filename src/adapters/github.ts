import {execFileSync, spawnSync} from 'node:child_process';

import {pullTitlePrefix} from '../machine/naming.ts';
import {publishChoice} from '../machine/policy.ts';
import {markRobot, spokeByRobot} from '../machine/review.ts';
import type {ReviewNote} from '../machine/port.ts';
import type {
  CheckState,
  Conversation,
  IssueRecord,
  Review,
  Thread,
  ThreadTarget,
  Tracker,
} from '../machine/port.ts';

export type CheckRollup = {
  state: string;
  statusCheckRollup: {name?: string; status?: string; conclusion?: string; state?: string}[] | null;
};

const FAILED = ['FAILURE', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED'];
const PENDING = ['QUEUED', 'IN_PROGRESS', 'PENDING', 'WAITING', 'REQUESTED'];

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
export function changesPayload(head: string, notes: ReviewNote[]): {
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

export function gh(args: string[], input?: string): string {
  return execFileSync('gh', args, {encoding: 'utf8', input});
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
    parent: links.parent,
    dependsOn: links.dependsOn,
  };
}

export type GitHubAdapters = {
  /** Base branch passed to `gh pr create`. */
  prBase?: string;
};

export function githubAdapters(options: GitHubAdapters = {}): {tracker: Tracker; review: Review} {
  const prBase = options.prBase ?? 'master';
  let slug: string | null = null;
  let user: string | null = null;
  const repoSlug = () => {
    if (!slug) {
      slug = repo().slug;
    }
    return slug;
  };
  const login = () => {
    if (!user) {
      user = gh(['api', 'user', '--jq', '.login']).trim();
    }
    return user;
  };
  const readIssue = (key: string): RawIssue =>
    JSON.parse(
      gh(['issue', 'view', key, '--repo', repoSlug(), '--json', 'number,title,body,state,labels']),
    ) as RawIssue;

  const tracker: Tracker = {
    login,
    listOpen() {
      const found = JSON.parse(
        gh([
          'issue',
          'list',
          '--repo',
          repoSlug(),
          '--state',
          'open',
          '--limit',
          '100',
          '--json',
          'number,title,body,state,labels',
        ]),
      ) as RawIssue[];
      return found.map(asRecord);
    },
    issue: key => asRecord(readIssue(key)),
    labels: key => asRecord(readIssue(key)).labels,
    editLabels(key, add, remove) {
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
      gh(args);
    },
    updateBody(key, body) {
      gh(['issue', 'edit', key, '--repo', repoSlug(), '--body', body]);
    },
    comment(key, body) {
      gh(['issue', 'comment', key, '--repo', repoSlug(), '--body', markRobot(body)]);
    },
    close(key, comment) {
      gh(['issue', 'close', key, '--repo', repoSlug(), '--comment', markRobot(comment)]);
    },
  };

  const linked = (key: string) => {
    const found = JSON.parse(
      gh([
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
    pulls(key) {
      return linked(key).map(pr => {
        const id = String(pr.number);
        if (pr.state !== 'OPEN') {
          return {
            id,
            title: pr.title,
            state: pr.state,
            checks: 'none' as const,
          };
        }
        const view = JSON.parse(
          gh(['pr', 'view', id, '--repo', repoSlug(), '--json', 'statusCheckRollup,state']),
        ) as CheckRollup;
        return {
          id,
          title: pr.title,
          state: pr.state,
          checks: classifyChecks(view),
        };
      });
    },
    threads(pull) {
      const {owner, name} = repo();
      const query = `query($owner:String!,$name:String!,$number:Int!){
        repository(owner:$owner, name:$name) {
          pullRequest(number:$number) {
            reviewThreads(first:100) {
              nodes {
                isResolved
                comments(last:1) { nodes { author { login } body } }
              }
            }
          }
        }
      }`;
      const data = JSON.parse(
        gh([
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
              reviewThreads: {nodes: {isResolved: boolean; comments: {nodes: {body: string}[]}}[]};
            } | null;
          };
        };
      };
      const nodes = data.data.repository.pullRequest?.reviewThreads.nodes ?? [];
      return nodes.map(node => ({
        resolved: node.isResolved,
        body: node.comments.nodes[0]?.body ?? '',
      }));
    },
    comments(pull) {
      const comments = JSON.parse(
        gh([
          'api',
          `repos/${repoSlug()}/issues/${pull}/comments`,
          '--jq',
          '[.[] | {login: .user.login, body}]',
        ]),
      ) as {login: string; body: string}[];
      return comments.map(comment => ({
        body: comment.body,
        robot: spokeByRobot(comment.body, comment.login),
      }));
    },
    ensurePull(key, title, body) {
      const open = linked(key)
        .filter(pr => pr.state === 'OPEN')
        .map(pr => String(pr.number));
      const choice = publishChoice(open);
      if (!choice.ok) {
        throw new Error(choice.reason);
      }
      if (choice.id) {
        return choice.id;
      }
      const url = gh([
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
      ]).trim();
      const id = url.match(/\/(\d+)\s*$/)?.[1];
      if (!id) {
        throw new Error(`gh pr create returned no pull number: ${url}`);
      }
      return id;
    },
    openThread(pull, target: ThreadTarget) {
      gh([
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
    reply(pull, comment, body) {
      gh([
        'api',
        '--method',
        'POST',
        `repos/${repoSlug()}/pulls/${pull}/comments/${comment}/replies`,
        '-f',
        `body=${markRobot(body)}`,
      ]);
    },
    say(pull, body) {
      gh(['issue', 'comment', pull, '--repo', repoSlug(), '--body', markRobot(body)]);
    },
    speak(pull, body) {
      gh(['issue', 'comment', pull, '--repo', repoSlug(), '--body', body]);
    },
    flag(pull, head, notes) {
      const payload = changesPayload(head, notes);
      const post = () =>
        gh(
          ['api', '--method', 'POST', '--input', '-', `repos/${repoSlug()}/pulls/${pull}/reviews`],
          JSON.stringify(payload),
        );
      try {
        post();
      } catch {
        const text = notes.map(note => note.body).join('\n\n');
        try {
          gh(
            ['api', '--method', 'POST', '--input', '-', `repos/${repoSlug()}/pulls/${pull}/reviews`],
            JSON.stringify(changesPayload(head, notes.map(note => ({body: note.body})))),
          );
        } catch {
          this.speak(pull, text);
          return;
        }
        this.speak(pull, text);
        return;
      }
      if (payload.comments.length === 0 && payload.body) {
        this.speak(pull, payload.body);
      }
      const loose = notes.filter(note => !note.path).map(note => note.body).join('\n\n');
      if (payload.comments.length > 0 && loose) {
        this.speak(pull, loose);
      }
    },
    range(pull) {
      const view = JSON.parse(gh(['pr', 'view', pull, '--repo', repoSlug(), '--json', 'headRefOid,baseRefOid'])) as {
        headRefOid?: string;
        baseRefOid?: string;
      };
      return {head: view.headRefOid ?? '', base: view.baseRefOid ?? null};
    },
    resolveThread(thread) {
      const query =
        'mutation($id:ID!){ resolveReviewThread(input:{threadId:$id}) { thread { isResolved } } }';
      gh(['api', 'graphql', '-f', `query=${query}`, '-f', `id=${thread}`]);
    },
    checksText(pull) {
      const result = spawnSync('gh', ['pr', 'checks', pull, '--repo', repoSlug()], {
        encoding: 'utf8',
      });
      return `${result.stdout ?? ''}${result.stderr ?? ''}`;
    },
    merge(pull) {
      try {
        gh(['pr', 'merge', pull, '--repo', repoSlug(), '--rebase']);
      } catch (error) {
        const stderr =
          error && typeof error === 'object' && 'stderr' in error ? String(error.stderr) : '';
        const message = error instanceof Error ? error.message : String(error);
        if (/already merged/i.test(`${message}\n${stderr}`)) {
          return;
        }
        throw error;
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
};

export type MemorySeed = {
  user?: string;
  issues?: MemoryIssue[];
  pulls?: Record<string, {id: string; title: string; state: string}[]>;
  threads?: Record<string, Thread[]>;
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
      parent: issue.parent ?? links.parent,
      dependsOn: issue.dependsOn ?? links.dependsOn,
    };
  };
  const tracker: Tracker = {
    login: () => {
      calls.push('login');
      return seed.user ?? 'robot';
    },
    listOpen: () => {
      calls.push('listOpen');
      return issues.filter(issue => issue.state === 'OPEN').map(record);
    },
    issue: key => {
      calls.push('issue');
      return record(find(key));
    },
    labels: key => {
      calls.push('labels');
      return [...find(key).labels];
    },
    editLabels(key, add, remove) {
      calls.push('editLabels');
      const issue = find(key);
      issue.labels = issue.labels.filter(name => !remove.includes(name));
      for (const label of add) {
        if (!issue.labels.includes(label)) {
          issue.labels.push(label);
        }
      }
    },
    updateBody(key, body) {
      calls.push('updateBody');
      find(key).body = body;
    },
    comment(_key, body) {
      calls.push('comment');
      calls.push(`body:${markRobot(body)}`);
    },
    close(key, comment) {
      calls.push(`close:${comment}`);
      calls.push(`body:${markRobot(comment)}`);
      find(key).state = 'CLOSED';
    },
  };
  const review: Review = {
    pulls(key) {
      calls.push('pulls');
      return (seed.pulls?.[key] ?? []).map(pr => {
        const checks = seed.checks?.[pr.id] ?? {
          checks: 'none' as const,
        };
        return {...pr, ...checks};
      });
    },
    threads(pull) {
      calls.push('threads');
      return seed.threads?.[pull] ?? [];
    },
    comments(pull) {
      calls.push('comments');
      return seed.comments?.[pull] ?? [];
    },
    ensurePull(key) {
      calls.push('ensurePull');
      const open = (seed.pulls?.[key] ?? []).filter(pr => pr.state === 'OPEN').map(pr => pr.id);
      const choice = publishChoice(open);
      if (!choice.ok) {
        throw new Error(choice.reason);
      }
      return choice.id ?? 'new';
    },
    openThread(_pull, target) {
      calls.push('openThread');
      calls.push(`body:${markRobot(target.body)}`);
    },
    reply(_pull, _comment, body) {
      calls.push('reply');
      calls.push(`body:${markRobot(body)}`);
    },
    say(_pull, body) {
      calls.push('say');
      calls.push(`body:${markRobot(body)}`);
    },
    speak(_pull, body) {
      calls.push('speak');
      calls.push(`body:${body}`);
    },
    flag(_pull, head, notes) {
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
    range(pull) {
      calls.push('range');
      return seed.ranges?.[pull] ?? {head: '', base: null};
    },
    resolveThread() {
      calls.push('resolveThread');
    },
    checksText(pull) {
      calls.push('checksText');
      return seed.checksText?.[pull] ?? '';
    },
    merge(pull) {
      calls.push(`merge:${pull}`);
    },
  };
  return {tracker, review, calls};
}
