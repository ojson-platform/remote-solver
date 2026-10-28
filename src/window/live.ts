import type {Machine} from '../adapters/compose.ts';
import type {Conversation, IssueRecord, Pull, ThreadRecord, ThreadTarget} from '../machine/port.ts';
import type {CycleSnapshot} from '../machine/snapshot.ts';

import {existsSync, mkdirSync, readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import path from 'node:path';

import {parse} from 'yaml';

import {githubPauseRemaining} from '../adapters/github.ts';
import {readBranch, type BranchFacts} from '../machine/change.ts';
import {markerName, parseMarker} from '../machine/marker.ts';
import {phaseOf} from '../machine/phase.ts';
import {modelFor, type SkillMode} from '../machine/skill.ts';
import {runSpy, type RunningTurn} from '../main.ts';

import {changeFiles} from './change-files.ts';
import {FACTORY_AGENTS, mergeFactory, readOverlayDoc} from './factory.ts';
import {serveBoard} from './page.ts';
import {isDoc, type WindowReview, type WindowTicket} from './types.ts';
import {openWindow} from './window.ts';

/** How often the served page reads the tracker again. */
export const REFRESH_MS = 60_000;

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

/** Remember a turn and tell the page when the header line changed. */
export function noteTurn(
  turns: Map<string, RunningTurn>,
  issue: string,
  turn: RunningTurn | undefined,
  note: () => void,
): void {
  const before = turnsLine([...turns.values()]);
  applyTurn(turns, issue, turn);
  if (turnsLine([...turns.values()]) !== before) {
    note();
  }
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
    /** Paint from a poll that already read the tracker. */
    apply?: (snapshot: CycleSnapshot) => void;
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
    onCycle(snapshot?: CycleSnapshot) {
      if (snapshot) {
        sink.apply?.(snapshot);
        return;
      }
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
  openThread(pull: string, target: ThreadTarget): Promise<void>;
};

export type LiveVcs = {
  compare(base: string, head: string): Promise<{commits: string; diff: string} | null>;
  /** Whether the range differs. When present, a refresh does not read the diff text. */
  changed?(base: string, head: string): Promise<boolean>;
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

function ticketSign(ticket: WindowTicket): string {
  return JSON.stringify({
    key: ticket.key,
    title: ticket.title,
    body: ticket.body ?? '',
    labels: ticket.labels,
    assignee: ticket.assignee ?? '',
    repo: ticket.repo ?? '',
    sddService: ticket.sddService ?? '',
    open: ticket.open !== false,
    parent: ticket.parent ?? '',
    dependsOn: ticket.dependsOn ?? [],
    sddHooks: ticket.sddHooks ?? null,
    comments: ticket.comments ?? [],
    openPullRequests: ticket.openPullRequests ?? null,
    checks: ticket.checks ?? null,
    diff: ticket.diff === true,
    pull: ticket.pull ?? '',
    mergeAhead: ticket.mergeAhead === true,
  });
}

function signTickets(tickets: readonly WindowTicket[]): string {
  return tickets.map(ticketSign).sort().join('\n');
}

function signMap<T>(map: ReadonlyMap<string, T>, value: (item: T) => string): string {
  return [...map.keys()]
    .sort()
    .map(key => `${key}=${value(map.get(key) as T)}`)
    .join('\n');
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
  let spyThreadPull = new Map<string, string>();
  const services = new Map<string, string>();
  let facts = new Map<string, BranchFacts>();
  let spyKeys = new Set<string>();
  let gatheredOf: (ticket: WindowTicket) => string | undefined = () => undefined;

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
    let comments: {body: string; manager?: boolean}[] | undefined;
    let open: Pull[] = [];
    try {
      comments = await tracker.comments(issue.key);
      open = (await review.pulls(issue.key)).filter(pull => pull.state === 'OPEN');
    } catch (error) {
      console.error(error);
      return ticket;
    }
    let diff = false;
    let checks: WindowTicket['checks'];
    try {
      if (open.length === 1) {
        const pull = open[0];
        if (pull) {
          checks = pull.checks;
          pulls.set(issue.key, pull.id);
          if (vcs) {
            try {
              const range = await review.range(pull.id);
              if (range.base) {
                if (vcs.changed) {
                  diff = await vcs.changed(range.base, range.head);
                } else {
                  const compared = await vcs.compare(range.base, range.head);
                  diff = Boolean(compared && compared.diff !== '');
                }
              }
            } catch (error) {
              console.error(error);
            }
          }
          const seen = spyThreadPull.get(issue.key);
          const held = seen === pull.id ? reviews.get(issue.key) : undefined;
          if (held) {
            reading.set(issue.key, held);
          } else {
            reading.set(
              issue.key,
              reviewOf(await review.threadList(pull.id), await review.comments(pull.id)),
            );
          }
        }
      }
    } catch (error) {
      console.error(error);
    }
    return {
      ...ticket,
      ...(comments ? {comments} : {}),
      openPullRequests: open.length,
      ...(checks !== undefined ? {checks} : {}),
      ...(diff ? {diff: true} : {}),
      ...(open.length === 1 && open[0] ? {pull: open[0].id} : {}),
      ...(phaseOf(issue.labels) === 'accepting' && open.length === 1 ? {mergeAhead: true} : {}),
    };
  }

  function sameCheckout(dir: string | undefined): boolean {
    if (!options.checkout || !dir) {
      return false;
    }
    return path.resolve(dir) === path.resolve(options.checkout);
  }

  function factsFor(
    tickets: readonly WindowTicket[],
    incoming?: Map<string, BranchFacts>,
  ): Map<string, BranchFacts> {
    const next = new Map<string, BranchFacts>();
    for (const ticket of tickets) {
      const fromSpy = incoming?.get(ticket.key);
      if (fromSpy && sameCheckout(gatheredOf(ticket))) {
        next.set(ticket.key, fromSpy);
        continue;
      }
      if (spyKeys.has(ticket.key)) {
        const held = facts.get(ticket.key);
        if (held) {
          next.set(ticket.key, held);
          continue;
        }
      }
      next.set(ticket.key, readBranch(ticket.key, changeFiles(gatheredOf(ticket), ticket.key)).facts);
    }
    return next;
  }

  function boardChanged(
    tickets: readonly WindowTicket[],
    nextReviews: ReadonlyMap<string, WindowReview>,
    nextFacts: ReadonlyMap<string, BranchFacts>,
    nextLogin: string | undefined,
  ): boolean {
    return (
      signTickets(tickets) !== signTickets(cache) ||
      signMap(nextReviews, item => JSON.stringify(item)) !== signMap(reviews, item => JSON.stringify(item)) ||
      signMap(nextFacts, item => JSON.stringify(item)) !== signMap(facts, item => JSON.stringify(item)) ||
      nextLogin !== loginName
    );
  }

  function tokenOf(key: string): string {
    const ticket = cache.find(item => item.key === key);
    const mark = facts.get(key);
    return JSON.stringify({
      fingerprint: mark?.fingerprint ?? null,
      body: ticket?.body ?? '',
      comments: ticket?.comments ?? [],
      labels: ticket?.labels ?? [],
      checks: ticket?.checks ?? null,
      diff: ticket?.diff === true,
      pull: ticket?.pull ?? '',
      openPullRequests: ticket?.openPullRequests ?? null,
    });
  }

  async function refresh(): Promise<boolean> {
    if (githubPauseRemaining() > 0) {
      return false;
    }
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
      return false;
    }
    const nextFacts = factsFor(tickets);
    const nextLogin = login ?? loginName;
    const changed = boardChanged(tickets, nextReviews, nextFacts, nextLogin);
    cache = tickets;
    pullByKey = nextPulls;
    reviews = nextReviews;
    facts = nextFacts;
    if (login) {
      loginName = login;
    }
    return changed;
  }

  function apply(snapshot: CycleSnapshot): boolean {
    const prior = new Map(cache.map(ticket => [ticket.key, ticket]));
    const nextPulls = new Map(pullByKey);
    const nextReviews = new Map(reviews);
    const nextSpy = new Map(spyThreadPull);
    const tickets: WindowTicket[] = [];
    for (const issue of snapshot.issues) {
      if (!issue.labels.includes('sdd:cycle')) {
        continue;
      }
      const previous = prior.get(issue.key);
      const ticket = ticketFrom(issue, repo, services.get(issue.key));
      const listed = snapshot.pulls.get(issue.key);
      const open = listed?.filter(pull => pull.state === 'OPEN');
      let openCount = previous?.openPullRequests;
      let checks = previous?.checks;
      let onlyId: string | undefined;
      if (open) {
        openCount = open.length;
        checks = undefined;
        const only = open.length === 1 ? open[0] : undefined;
        if (only) {
          checks = only.checks;
          onlyId = only.id;
          nextPulls.set(issue.key, only.id);
          if (only.reading) {
            nextReviews.set(issue.key, reviewOf(only.reading.threads, only.reading.notes));
            nextSpy.set(issue.key, only.id);
          } else {
            nextReviews.delete(issue.key);
            nextSpy.delete(issue.key);
          }
        } else {
          nextPulls.delete(issue.key);
          nextReviews.delete(issue.key);
          nextSpy.delete(issue.key);
        }
      }
      tickets.push({
        ...ticket,
        ...(previous?.comments ? {comments: previous.comments} : {}),
        ...(openCount !== undefined ? {openPullRequests: openCount} : {}),
        ...(checks !== undefined ? {checks} : {}),
        ...(previous?.diff ? {diff: true} : {}),
        ...(onlyId !== undefined ? {pull: onlyId} : {}),
        ...(phaseOf(issue.labels) === 'accepting' && openCount === 1 ? {mergeAhead: true} : {}),
      });
    }
    if (snapshot.facts) {
      const used = new Set<string>();
      for (const ticket of tickets) {
        if (sameCheckout(gatheredOf(ticket)) && snapshot.facts.has(ticket.key)) {
          used.add(ticket.key);
        }
      }
      spyKeys = used;
    }
    const nextFacts = factsFor(tickets, snapshot.facts);
    const changed = boardChanged(tickets, nextReviews, nextFacts, loginName);
    cache = tickets;
    pullByKey = nextPulls;
    reviews = nextReviews;
    spyThreadPull = nextSpy;
    facts = nextFacts;
    return changed;
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
      async threadPull(key, body, place) {
        const pull = pullByKey.get(key);
        if (!pull) {
          throw new Error('pull is missing');
        }
        const range = await review.range(pull);
        if (range.head === '') {
          throw new Error('head is missing');
        }
        await review.openThread(pull, {
          commit: range.head,
          path: place.path,
          line: place.line,
          body,
          plain: true,
          side: place.side,
        });
      },
      async speakPull(key, body) {
        const pull = pullByKey.get(key);
        if (!pull) {
          throw new Error('pull is missing');
        }
        await review.speak(pull, body);
      },
      review: key => reviews.get(key),
      branchFacts: key => facts.get(key),
      spineToken: key => tokenOf(key),
      reviewPlace: place => pullPage(place.file, place.line),
    },
  );
  if (fresh) {
    view.leaveWatch([repo]);
  }
  if (options.githubRoot) {
    view.leaveRoots({github: options.githubRoot});
  }
  gatheredOf = ticket => view.gatheredOf(ticket);
  return {window: view, refresh, apply};
}

/** Serve the board and keep the ticket cache fresh. The URL is the page. */
export async function serveLiveBoard(options: LiveBoardOptions): Promise<{
  url: string;
  refresh(): Promise<void>;
  apply(snapshot: CycleSnapshot): void;
  close(): Promise<void>;
  note(): void;
}> {
  const live = openLiveBoard(options);
  await live.refresh();
  const page = await serveBoard(live.window);
  const refresh = async () => {
    const wrote = await live.refresh();
    if (wrote) {
      page.note();
    }
  };
  const apply = (snapshot: CycleSnapshot) => {
    if (live.apply(snapshot)) {
      page.note();
    }
  };
  const timer = setInterval(() => {
    forget(refresh());
  }, REFRESH_MS);
  timer.unref();
  return {
    url: page.url,
    refresh,
    apply,
    note: () => {
      page.note();
    },
    close: async () => {
      clearInterval(timer);
      await page.close();
    },
  };
}
