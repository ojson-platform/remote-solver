import {execFileSync, spawnSync} from 'node:child_process';

import {pullTitlePrefix} from '../machine/naming.ts';
import type {CheckState, Conversation, IssueRecord, Review, Thread, ThreadTarget, Tracker} from '../machine/port.ts';

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

export function gh(args: string[]): string {
  return execFileSync('gh', args, {encoding: 'utf8'});
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
  reviewCheck?: string;
  /** Base branch passed to `gh pr create`. */
  prBase?: string;
};

export function githubAdapters(options: GitHubAdapters = {}): {tracker: Tracker; review: Review} {
  const reviewCheck = options.reviewCheck ?? 'cursor-review';
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
    JSON.parse(gh(['issue', 'view', key, '--repo', repoSlug(), '--json', 'number,title,body,state,labels'])) as RawIssue;

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
      gh(['issue', 'comment', key, '--repo', repoSlug(), '--body', body]);
    },
    close(key, comment) {
      gh(['issue', 'close', key, '--repo', repoSlug(), '--comment', comment]);
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
          return {id, title: pr.title, state: pr.state, checks: 'none' as const, reviewCheck: 'none' as const};
        }
        const view = JSON.parse(
          gh(['pr', 'view', id, '--repo', repoSlug(), '--json', 'statusCheckRollup,state']),
        ) as CheckRollup;
        return {
          id,
          title: pr.title,
          state: pr.state,
          checks: classifyChecks(view),
          reviewCheck: classifyChecks(view, reviewCheck),
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
        gh(['api', `repos/${repoSlug()}/issues/${pull}/comments`, '--jq', '[.[] | {login: .user.login, body}]']),
      ) as {login: string; body: string}[];
      const me = login();
      return comments.map(comment => ({
        body: comment.body,
        robot: comment.login === me || comment.login.endsWith('[bot]'),
      }));
    },
    ensurePull(key, title, body) {
      const open = linked(key).find(pr => pr.state === 'OPEN');
      if (open) {
        return String(open.number);
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
        `body=${target.body}`,
      ]);
    },
    reply(pull, comment, body) {
      gh(['api', '--method', 'POST', `repos/${repoSlug()}/pulls/${pull}/comments/${comment}/replies`, '-f', `body=${body}`]);
    },
    resolveThread(thread) {
      const query =
        'mutation($id:ID!){ resolveReviewThread(input:{threadId:$id}) { thread { isResolved } } }';
      gh(['api', 'graphql', '-f', `query=${query}`, '-f', `id=${thread}`]);
    },
    checksText(pull) {
      const result = spawnSync('gh', ['pr', 'checks', pull, '--repo', repoSlug()], {encoding: 'utf8'});
      return `${result.stdout ?? ''}${result.stderr ?? ''}`;
    },
    merge(pull) {
      try {
        gh(['pr', 'merge', pull, '--repo', repoSlug(), '--rebase']);
      } catch (error) {
        const stderr = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr) : '';
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
  checks?: Record<string, {checks: CheckState; reviewCheck: CheckState}>;
  checksText?: Record<string, string>;
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
    comment() {
      calls.push('comment');
    },
    close(key, comment) {
      calls.push(`close:${comment}`);
      find(key).state = 'CLOSED';
    },
  };
  const review: Review = {
    pulls(key) {
      calls.push('pulls');
      return (seed.pulls?.[key] ?? []).map(pr => {
        const checks = seed.checks?.[pr.id] ?? {checks: 'none' as const, reviewCheck: 'none' as const};
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
      const existing = (seed.pulls?.[key] ?? []).find(pr => pr.state === 'OPEN');
      if (existing) {
        return existing.id;
      }
      return 'new';
    },
    openThread() {
      calls.push('openThread');
    },
    reply() {
      calls.push('reply');
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
