import type {Machine} from '../adapters/compose.ts';
import {
  diffEnd,
  type Conversation,
  type IssueRecord,
  type Pull,
  type ThreadRecord,
  type ThreadTarget,
} from '../machine/port.ts';
import type {CycleSnapshot} from '../machine/snapshot.ts';

import {existsSync, mkdirSync, readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import path from 'node:path';

import {parse} from 'yaml';

import {ghErrorLine, githubPauseRemaining} from '../adapters/github.ts';
import {readBranch, type BranchFacts, type BranchText} from '../machine/change.ts';
import {markerName, parseMarker} from '../machine/marker.ts';
import {phaseOf} from '../machine/phase.ts';
import {modelFor, type SkillMode} from '../machine/skill.ts';
import type {Decision} from '../machine/policy.ts';
import {runSpy, type RunningTurn} from '../main.ts';

import {changeFiles, contentChangeFiles} from './change-files.ts';
import {createBoardStore} from './store.ts';
import {FACTORY_AGENTS, mergeFactory, readOverlayDoc} from './factory.ts';
import {serveBoard} from './page.ts';
import {isDoc, type BoardTurn, type WindowReview, type WindowTicket} from './types.ts';
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

/** Spy memory the tracker's refresh does not clear. */
export function createBoardSpyState(note: () => void): {
  running: Set<string>;
  leading: (key: string) => boolean;
  turnsLine: () => string;
  turn: (key: string) => BoardTurn | undefined;
  decision: (key: string) => Decision | undefined;
  sink: {
    running: Set<string>;
    setTurn: (issue: string, turn: RunningTurn | undefined) => void;
    onHeld: (held: readonly {issue: string; action: string}[]) => void;
    onDecision: (issue: string, decision: Decision) => void;
  };
} {
  const running = new Set<string>();
  const turns = new Map<string, RunningTurn>();
  const heldActions = new Map<string, string>();
  const decisions = new Map<string, Decision>();
  return {
    running,
    leading: key => running.has(key),
    turnsLine: () => turnsLine([...turns.values()]),
    turn: key => {
      const turn = turns.get(key);
      if (turn !== undefined) {
        return {action: turn.action, phase: turn.phase};
      }
      const held = heldActions.get(key);
      return held === undefined ? undefined : {action: held};
    },
    decision: key => decisions.get(key),
    sink: {
      running,
      setTurn(issue, turn) {
        noteTurn(turns, issue, turn, note);
      },
      onHeld(held) {
        heldActions.clear();
        for (const item of held) {
          heldActions.set(item.issue, item.action);
        }
        note();
      },
      onDecision(issue, decision) {
        decisions.set(issue, decision);
        note();
      },
    },
  };
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
    onHeld?: (held: readonly {issue: string; action: string}[]) => void;
    onDecision?: (issue: string, decision: Decision) => void;
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
    onHeld(held: readonly {issue: string; action: string}[]) {
      sink.onHeld?.(held);
    },
    onDecision(issue: string, decision: Decision) {
      sink.onDecision?.(issue, decision);
    },
    onCycle(snapshot?: CycleSnapshot) {
      if (snapshot) {
        sink.apply?.(snapshot);
        return;
      }
      forget(sink.refresh());
    },
  };
  return runSpy(box, ['--parallel', '20'], watch);
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
  /** The parent when `head` is this issue's archive commit. Otherwise `head`. */
  contentCommit?(key: string, head: string): Promise<string>;
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
  /** Action token, or phase and action, while the spy leads or holds this key. */
  turn?: (key: string) => BoardTurn | undefined;
  /** Settled decision the spy published for this key. */
  decision?: (key: string) => Decision | undefined;
  /** TCP port. Absent means the system chooses one. */
  port?: number;
};

function logProblem(error: unknown): void {
  console.error(ghErrorLine(error));
}

function forget(work: Promise<unknown>): void {
  void work.catch(error => {
    logProblem(error);
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
    blockedBy: [...(issue.blockedBy ?? [])],
    blocks: [...(issue.blocks ?? [])],
    ...(issue.sddHooks !== undefined ? {sddHooks: issue.sddHooks} : {}),
  };
}

function windowThread(thread: ThreadRecord): WindowReview['threads'][number] {
  const bodies = thread.comments ?? (thread.body === '' ? [] : [thread.body]);
  const comments: string[] = [];
  let fixedCommit: string | null | undefined;
  for (const body of bodies) {
    const marker = parseMarker(body);
    if (marker?.kind === 'fixed') {
      fixedCommit = marker.commit;
      continue;
    }
    if (marker === null) {
      comments.push(body);
    }
  }
  return {
    marker: markerName(parseMarker(thread.body)),
    file: thread.path,
    line: thread.line,
    lines: thread.body === '' ? [] : thread.body.split('\n'),
    comments,
    ...(fixedCommit !== undefined ? {fixedCommit} : {}),
  };
}

function reviewOf(threads: readonly ThreadRecord[], notes: readonly Conversation[]): WindowReview {
  const last = [...notes].reverse().find(note => !note.robot);
  return {
    threads: threads.map(windowThread),
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
  const store = createBoardStore();
  let generation = 0;
  const services = new Map<string, string>();
  let gatheredOf: (ticket: WindowTicket) => string | undefined = () => undefined;
  type LabelWish = {token: number; key: string; label: string; on: boolean};
  let wishToken = 0;
  let wishes: LabelWish[] = [];
  let onPaint: () => void = () => {};

  function bump(): void {
    generation += 1;
  }

  function patch(key: string, change: (ticket: WindowTicket) => WindowTicket): void {
    store.patch(key, change);
  }

  function retire(issues: readonly {key: string; labels: readonly string[]}[]): void {
    const raw = new Map(issues.map(issue => [issue.key, issue.labels]));
    wishes = wishes.filter(wish => {
      const labels = raw.get(wish.key);
      if (!labels) {
        return true;
      }
      return labels.includes(wish.label) !== wish.on;
    });
  }

  function project(key: string, labels: readonly string[]): string[] {
    let next = [...labels];
    for (const wish of wishes) {
      if (wish.key !== key) {
        continue;
      }
      const has = next.includes(wish.label);
      if (has === wish.on) {
        continue;
      }
      if (wish.on) {
        next.push(wish.label);
      } else {
        next = next.filter(label => label !== wish.label);
      }
    }
    return next;
  }

  function paintTickets(
    tickets: WindowTicket[],
    raw: ReadonlyMap<string, readonly string[]>,
  ): WindowTicket[] {
    return tickets.map(ticket => {
      const labels = raw.get(ticket.key);
      if (!labels) {
        return ticket;
      }
      return {...ticket, labels: project(ticket.key, labels)};
    });
  }

  function wishFor(key: string, label: string, on: boolean): number {
    const token = ++wishToken;
    const wish = {token, key, label, on};
    const index = wishes.findIndex(item => item.key === key && item.label === label);
    if (index >= 0) {
      wishes[index] = wish;
    } else {
      wishes.push(wish);
    }
    return token;
  }

  function changeLabels(key: string, add: readonly string[], remove: readonly string[]): void {
    bump();
    const tokens: number[] = [];
    for (const label of remove) {
      tokens.push(wishFor(key, label, false));
    }
    for (const label of add) {
      tokens.push(wishFor(key, label, true));
    }
    patch(key, ticket => {
      const labels = ticket.labels.filter(label => !remove.includes(label));
      for (const label of add) {
        if (!labels.includes(label)) {
          labels.push(label);
        }
      }
      return {...ticket, labels};
    });
    void Promise.resolve()
      .then(() => tracker.editLabels(key, [...add], [...remove]))
      .catch(error => {
        logProblem(error);
        const undone: LabelWish[] = [];
        for (const token of tokens) {
          const index = wishes.findIndex(item => item.token === token);
          if (index < 0) {
            continue;
          }
          const wish = wishes[index];
          if (!wish) {
            continue;
          }
          undone.push(wish);
          wishes.splice(index, 1);
        }
        if (undone.length === 0) {
          return;
        }
        bump();
        patch(key, ticket => {
          let labels = [...ticket.labels];
          for (const wish of undone) {
            if (wishes.some(item => item.key === key && item.label === wish.label)) {
              continue;
            }
            if (wish.on) {
              labels = labels.filter(label => label !== wish.label);
            } else if (!labels.includes(wish.label)) {
              labels.push(wish.label);
            }
          }
          return {...ticket, labels};
        });
        onPaint();
      });
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
      logProblem(error);
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
                const end = await diffEnd(vcs, issue.key, range.head);
                if (vcs.changed) {
                  diff = await vcs.changed(range.base, end);
                } else {
                  const compared = await vcs.compare(range.base, end);
                  diff = Boolean(compared && compared.diff !== '');
                }
              }
            } catch (error) {
              logProblem(error);
            }
          }
          const seen = store.spyPull(issue.key);
          const held = seen === pull.id ? store.review(issue.key) : undefined;
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
      logProblem(error);
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
    incomingText?: Map<string, BranchText>,
  ): {facts: Map<string, BranchFacts>; texts: Map<string, BranchText>} {
    const next = new Map<string, BranchFacts>();
    const nextText = new Map<string, BranchText>();
    for (const ticket of tickets) {
      const fromSpy = incoming?.get(ticket.key);
      if (fromSpy && sameCheckout(gatheredOf(ticket))) {
        next.set(ticket.key, fromSpy);
        const stored = incomingText?.get(ticket.key);
        if (stored) {
          nextText.set(ticket.key, stored);
        }
        continue;
      }
      if (store.hasSpy(ticket.key)) {
        const held = store.factsOf(ticket.key);
        if (held) {
          next.set(ticket.key, held);
          const heldText = store.textOf(ticket.key);
          if (heldText) {
            nextText.set(ticket.key, heldText);
          }
          continue;
        }
      }
      const files = changeFiles(gatheredOf(ticket), ticket.key);
      const read = readBranch(ticket.key, files, contentChangeFiles(gatheredOf(ticket), ticket.key));
      if (files.failed?.()) {
        const held = store.factsOf(ticket.key);
        const heldText = store.textOf(ticket.key);
        if (held && heldText) {
          next.set(ticket.key, held);
          nextText.set(ticket.key, heldText);
          continue;
        }
        next.set(ticket.key, read.facts);
        continue;
      }
      next.set(ticket.key, read.facts);
      nextText.set(ticket.key, read.text);
    }
    return {facts: next, texts: nextText};
  }

  function remember(
    tickets: WindowTicket[],
    nextPulls: Map<string, string>,
    nextReviews: Map<string, WindowReview>,
    nextSpy: Map<string, string>,
    read: {facts: Map<string, BranchFacts>; texts: Map<string, BranchText>},
    login: string | undefined,
  ): void {
    store.commit(
      {
        tickets,
        pulls: nextPulls,
        reviews: nextReviews,
        spyPulls: nextSpy,
        facts: read.facts,
        texts: read.texts,
        spyKeys: store.copySpyKeys(),
        ...(login ? {login} : {}),
      },
      gatheredOf,
    );
  }

  async function refresh(): Promise<boolean> {
    if (githubPauseRemaining() > 0) {
      return false;
    }
    const gen = generation;
    const issues = await tracker.listOpen();
    const login = await tracker.login().catch(error => {
      logProblem(error);
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
    retire(issues);
    const painted = paintTickets(tickets, new Map(issues.map(issue => [issue.key, issue.labels])));
    const read = factsFor(painted);
    const nextLogin = login ?? store.login();
    const changed = store.changed(painted, nextReviews, read.facts, nextLogin);
    remember(painted, nextPulls, nextReviews, store.copySpyPulls(), read, login);
    return changed;
  }

  function apply(snapshot: CycleSnapshot): boolean {
    retire(snapshot.issues);
    const prior = new Map(store.tickets().map(ticket => [ticket.key, ticket]));
    const nextPulls = store.copyPulls();
    const nextReviews = store.copyReviews();
    const nextSpy = store.copySpyPulls();
    const tickets: WindowTicket[] = [];
    for (const issue of snapshot.issues) {
      if (!issue.labels.includes('sdd:cycle')) {
        continue;
      }
      const previous = prior.get(issue.key);
      const ticket = {
        ...ticketFrom(issue, repo, services.get(issue.key)),
        labels: project(issue.key, issue.labels),
      };
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
      store.setSpyKeys(used);
    }
    const read = factsFor(tickets, snapshot.facts, snapshot.texts);
    const changed = store.changed(tickets, nextReviews, read.facts, store.login());
    remember(tickets, nextPulls, nextReviews, nextSpy, read, undefined);
    return changed;
  }

  function pullPage(file: string, line: number): string {
    const ids = [...new Set(store.pullIds())];
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
      tickets: () => store.tickets(),
      login: () => store.login(),
      leading: options.leading,
      spyNote: options.spyNote,
      turn: options.turn,
      decision: options.decision,
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
        const pull = store.pull(key);
        if (!pull) {
          return;
        }
        forget(review.speak(pull, body));
      },
      async threadPull(key, body, place) {
        const pull = store.pull(key);
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
        const pull = store.pull(key);
        if (!pull) {
          throw new Error('pull is missing');
        }
        await review.speak(pull, body);
      },
      review: key => store.review(key),
      branchFacts: key => store.factsOf(key),
      branchText: key => store.textOf(key),
      spineToken: key => store.token(key),
      reviewPlace: place => pullPage(place.file, place.line),
    },
    store,
  );
  if (fresh) {
    view.leaveWatch([repo]);
  }
  if (options.githubRoot) {
    view.leaveRoots({github: options.githubRoot});
  }
  gatheredOf = ticket => view.gatheredOf(ticket);
  return {
    window: view,
    refresh,
    apply,
    whenPainted(listener: () => void) {
      onPaint = listener;
    },
  };
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
  const page = await serveBoard(live.window, options.port ?? 0);
  live.whenPainted(() => {
    page.note();
  });
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
