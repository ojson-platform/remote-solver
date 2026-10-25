import type {Machine} from '../adapters/compose.ts';
import type {Conversation, IssueRecord, Pull, ThreadRecord} from '../machine/port.ts';

import {existsSync, mkdirSync, readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import path from 'node:path';

import {parse} from 'yaml';

import {markerName, parseMarker} from '../machine/marker.ts';
import {phaseOf} from '../machine/phase.ts';
import {modelFor, type SkillMode} from '../machine/skill.ts';
import {runSpy, type RunningTurn} from '../main.ts';

import {FACTORY_AGENTS, mergeFactory, readOverlayDoc} from './factory.ts';
import {serveBoard} from './page.ts';
import {isDoc, type WindowReview, type WindowTicket} from './types.ts';
import {openWindow} from './window.ts';

/** How often the served page reads the tracker again. */
export const REFRESH_MS = 15_000;

/** The header line for the turns that are running. Empty when none are. */
export function turnsLine(turns: readonly RunningTurn[]): string {
  return [...turns]
    .sort((left, right) => left.issue.localeCompare(right.issue))
    .map(turn => `#${turn.issue} ${turn.phase} → ${turn.action}`)
    .join(' · ');
}

/** Remember one issue's turn. Clearing an issue leaves every other turn in place. */
export function applyTurn(
  turns: Map<string, RunningTurn>,
  issue: string,
  turn: RunningTurn | undefined,
): void {
  if (turn === undefined) {
    turns.delete(issue);
    return;
  }
  turns.set(issue, turn);
}

/** Home file when `remote-solver board` does not name one. */
export function defaultHomePath(): string {
  return path.join(homedir(), '.aifactory', 'config.yaml');
}

/**
 * Model for one step of the board's spy.
 * A cursor pair in the home file wins. Any other agent keeps the built-in cursor pair.
 */
export function boardModel(homePath: string, checkout: string, mode: SkillMode): string {
  let home: Record<string, unknown> = {};
  if (existsSync(homePath)) {
    try {
      const raw = parse(readFileSync(homePath, 'utf8'));
      if (isDoc(raw)) {
        home = raw;
      }
    } catch {
      home = {};
    }
  }
  const factory = mergeFactory(home, readOverlayDoc(checkout));
  const chosen = mode === 'mechanical' ? factory.mechanical : factory.judgment;
  if (factory.agent === 'cursor' && chosen !== '') {
    return chosen;
  }
  return modelFor(mode);
}

/** The machine spy, with its running set and latest line handed to the page. */
export function watchSpy(
  box: Machine,
  sink: {
    running: Set<string>;
    setNote?: (line: string) => void;
    /** One issue's turn, or none when that worker has left it. */
    setTurn?: (issue: string, turn: RunningTurn | undefined) => void;
    refresh: () => Promise<void>;
  },
  signal?: AbortSignal,
): Promise<void> {
  const watch = {
    signal,
    onRunning(keys: readonly string[]) {
      sink.running.clear();
      for (const key of keys) {
        sink.running.add(key);
      }
    },
    onReport(line: string) {
      sink.setNote?.(line);
    },
    onTurn(issue: string, turn: RunningTurn | undefined) {
      sink.setTurn?.(issue, turn);
    },
    onCycle() {
      forget(sink.refresh());
    },
  };
  return runSpy(box, [], watch);
}

export type LiveTracker = {
  login(): Promise<string>;
  listOpen(): Promise<IssueRecord[]>;
  assign(key: string, login: string): Promise<void>;
  editLabels(key: string, add: string[], remove: string[]): Promise<void>;
  comments(key: string): Promise<{body: string; manager?: boolean}[]>;
};

export type LiveReview = {
  pulls(key: string): Promise<Pull[]>;
  threadList(pull: string): Promise<ThreadRecord[]>;
  comments(pull: string): Promise<Conversation[]>;
  range(pull: string): Promise<{head: string; base: string | null}>;
  speak(pull: string, body: string): Promise<void>;
};

export type LiveVcs = {
  compare(base: string, head: string): Promise<{commits: string; diff: string} | null>;
};

export type LiveBoardOptions = {
  homePath: string;
  /** Watch-list key, `owner/repo`. */
  repo: string;
  tracker: LiveTracker;
  review: LiveReview;
  vcs?: LiveVcs;
  /** GitHub root for this launch. The window's default is `~/github`. */
  githubRoot?: string;
  /** Working directory. It is the gathered checkout for `repo`. */
  checkout?: string;
  /** True while the machine spy's agent is running for this key. */
  leading?: (key: string) => boolean;
  /** Latest spy line drawn in the page header. */
  spyNote?: () => string;
  /** Action token while a worker is on a turn for this key. */
  turn?: (key: string) => string | undefined;
};

function forget(work: Promise<unknown>): void {
  void work.catch(error => {
    console.error(error);
  });
}

function ticketFrom(issue: IssueRecord, repo: string, service: string | undefined): WindowTicket {
  return {
    key: issue.key,
    title: issue.title,
    body: issue.body,
    labels: [...issue.labels],
    assignee: issue.assignee ?? '',
    repo,
    sddService: service ?? issue.service ?? '',
    open: issue.state.toUpperCase() !== 'CLOSED',
    parent: issue.parent,
    dependsOn: [...issue.dependsOn],
    ...(issue.sddHooks !== undefined ? {sddHooks: issue.sddHooks} : {}),
  };
}

function reviewOf(threads: readonly ThreadRecord[], notes: readonly Conversation[]): WindowReview {
  const last = [...notes].reverse().find(note => !note.robot);
  return {
    threads: threads.map(thread => ({
      marker: markerName(parseMarker(thread.body)),
      file: thread.path,
      lines: thread.body === '' ? [] : thread.body.split('\n'),
    })),
    conversation: last
      ? {last: {marker: markerName(parseMarker(last.body)), body: last.body}}
      : undefined,
  };
}

/**
 * The window fed by a tracker and a review port.
 * A page load writes `sdd:proposing` for a ticket this manager holds.
 * It does not start a step: the console spy owns the agent.
 */
export function openLiveBoard(options: LiveBoardOptions) {
  const {tracker, review, vcs, repo} = options;
  let generation = 0;
  let loginName: string | undefined;
  let cache: WindowTicket[] = [];
  let pullByKey = new Map<string, string>();
  let reviews = new Map<string, WindowReview>();
  const services = new Map<string, string>();

  function bump(): void {
    generation += 1;
  }

  function patch(key: string, change: (ticket: WindowTicket) => WindowTicket): void {
    cache = cache.map(ticket => (ticket.key === key ? change(ticket) : ticket));
  }

  function changeLabels(key: string, add: readonly string[], remove: readonly string[]): void {
    bump();
    patch(key, ticket => {
      const labels = ticket.labels.filter(label => !remove.includes(label));
      for (const label of add) {
        if (!labels.includes(label)) {
          labels.push(label);
        }
      }
      return {...ticket, labels};
    });
    forget(tracker.editLabels(key, [...add], [...remove]));
  }

  async function oneTicket(
    issue: IssueRecord,
    pulls: Map<string, string>,
    reading: Map<string, WindowReview>,
  ): Promise<WindowTicket> {
    const ticket = ticketFrom(issue, repo, services.get(issue.key));
    try {
      const comments = await tracker.comments(issue.key);
      const open = (await review.pulls(issue.key)).filter(pull => pull.state === 'OPEN');
      let diff = false;
      let checks: WindowTicket['checks'];
      if (open.length === 1) {
        const pull = open[0];
        if (pull) {
          checks = pull.checks;
          pulls.set(issue.key, pull.id);
          if (vcs) {
            try {
              const range = await review.range(pull.id);
              if (range.base) {
                const compared = await vcs.compare(range.base, range.head);
                diff = Boolean(compared && compared.diff !== '');
              }
            } catch (error) {
              console.error(error);
            }
          }
          reading.set(
            issue.key,
            reviewOf(await review.threadList(pull.id), await review.comments(pull.id)),
          );
        }
      }
      return {
        ...ticket,
        comments,
        openPullRequests: open.length,
        ...(checks !== undefined ? {checks} : {}),
        ...(diff ? {diff: true} : {}),
        ...(phaseOf(issue.labels) === 'accepting' && open.length === 1 ? {mergeAhead: true} : {}),
      };
    } catch (error) {
      console.error(error);
      return ticket;
    }
  }

  async function refresh(): Promise<void> {
    const gen = generation;
    const issues = await tracker.listOpen();
    const login = await tracker.login().catch(error => {
      console.error(error);
      return undefined;
    });
    const nextPulls = new Map<string, string>();
    const nextReviews = new Map<string, WindowReview>();
    const tickets: WindowTicket[] = [];
    for (const issue of issues) {
      if (!issue.labels.includes('sdd:cycle')) {
        continue;
      }
      tickets.push(await oneTicket(issue, nextPulls, nextReviews));
    }
    if (gen !== generation) {
      return;
    }
    cache = tickets;
    pullByKey = nextPulls;
    reviews = nextReviews;
    if (login) {
      loginName = login;
    }
  }

  function pullPage(file: string, line: number): string {
    const ids = [...new Set(pullByKey.values())];
    const id = ids.length === 1 ? ids[0] : undefined;
    if (!id) {
      return `https://github.com/${repo}/pulls`;
    }
    const clean = file
      .split('/')
      .filter(part => part !== '' && part !== '.' && part !== '..')
      .map(part => encodeURIComponent(part))
      .join('/');
    if (clean === '') {
      return `https://github.com/${repo}/pull/${id}#L${line}`;
    }
    return `https://github.com/${repo}/blob/refs/pull/${id}/head/${clean}#L${line}`;
  }

  mkdirSync(path.dirname(options.homePath), {recursive: true});
  const fresh = !existsSync(options.homePath);
  const view = openWindow(
    {
      homePath: options.homePath,
      adapter: 'github',
      agents: FACTORY_AGENTS,
      repoDir: options.checkout ? {repo, dir: options.checkout} : undefined,
    },
    {
      tickets: () => cache,
      login: () => loginName,
      leading: options.leading,
      spyNote: options.spyNote,
      turn: options.turn,
      writeAssignee(key, login) {
        bump();
        patch(key, ticket => ({...ticket, assignee: login}));
        forget(tracker.assign(key, login));
      },
      writePhase(key, phase) {
        changeLabels(key, [`sdd:${phase}`], []);
      },
      editLabels(key, add, remove = []) {
        changeLabels(key, add, remove);
      },
      writeService(key, service) {
        bump();
        services.set(key, service);
        patch(key, ticket => ({...ticket, sddService: service}));
      },
      commentPull(key, body) {
        const pull = pullByKey.get(key);
        if (!pull) {
          return;
        }
        forget(review.speak(pull, body));
      },
      review: key => reviews.get(key),
      reviewPlace: place => pullPage(place.file, place.line),
    },
  );
  if (fresh) {
    view.leaveWatch([repo]);
  }
  if (options.githubRoot) {
    view.leaveRoots({github: options.githubRoot});
  }
  return {window: view, refresh};
}

/** Serve the board and keep the ticket cache fresh. The URL is the page. */
export async function serveLiveBoard(options: LiveBoardOptions): Promise<{
  url: string;
  refresh(): Promise<void>;
  close(): Promise<void>;
}> {
  const live = openLiveBoard(options);
  await live.refresh();
  const page = await serveBoard(live.window);
  const timer = setInterval(() => {
    forget(live.refresh());
  }, REFRESH_MS);
  timer.unref();
  return {
    url: page.url,
    refresh: () => live.refresh(),
    close: async () => {
      clearInterval(timer);
      await page.close();
    },
  };
}
