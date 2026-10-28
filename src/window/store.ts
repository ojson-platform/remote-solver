import type {FileSource} from '../machine/port.ts';
import type {BranchFacts, BranchText} from '../machine/change.ts';
import type {Spine} from './spine.ts';
import type {WindowReview, WindowTicket} from './types.ts';

import path from 'node:path';

import {changeFiles, strictChangeFiles} from './change-files.ts';

type SpineSlot = {spine?: Spine; revision: string; state: 'ready' | 'failed'};

export type BoardObservation = {
  tickets: WindowTicket[];
  pulls: Map<string, string>;
  reviews: Map<string, WindowReview>;
  spyPulls: Map<string, string>;
  facts: Map<string, BranchFacts>;
  texts: Map<string, BranchText>;
  spyKeys: Set<string>;
  login?: string;
};

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

function treeId(checkout: string, key: string, strict: boolean): string {
  return `${path.resolve(checkout)}\0${key}\0${strict ? 's' : 'l'}`;
}

/**
 * One process store: the observation, the spine shelf, and the git trees.
 * Writing the same observation leaves the shelf revision untouched.
 * A tree is kept for one checkout and key, and dropped when that branch fingerprint changes.
 */
export function createBoardStore() {
  let tickets: WindowTicket[] = [];
  let loginName: string | undefined;
  let pulls = new Map<string, string>();
  let reviews = new Map<string, WindowReview>();
  let spyPulls = new Map<string, string>();
  let facts = new Map<string, BranchFacts>();
  let texts = new Map<string, BranchText>();
  let spyKeys = new Set<string>();
  const fingerprints = new Map<string, string>();
  const trees = new Map<string, FileSource>();
  const shelf = new Map<string, SpineSlot>();
  let spineKey = '';
  let spineState: 'idle' | 'due' | 'ready' | 'failed' = 'idle';

  function dropTrees(checkout: string | undefined, key: string): void {
    if (!checkout) {
      for (const id of [...trees.keys()]) {
        if (id.split('\0')[1] === key) {
          trees.delete(id);
        }
      }
      return;
    }
    trees.delete(treeId(checkout, key, false));
    trees.delete(treeId(checkout, key, true));
  }

  return {
    tickets(): readonly WindowTicket[] {
      return tickets;
    },
    login(): string | undefined {
      return loginName;
    },
    patch(key: string, change: (ticket: WindowTicket) => WindowTicket): void {
      tickets = tickets.map(ticket => (ticket.key === key ? change(ticket) : ticket));
    },
    review(key: string): WindowReview | undefined {
      return reviews.get(key);
    },
    factsOf(key: string): BranchFacts | undefined {
      return facts.get(key);
    },
    textOf(key: string): BranchText | undefined {
      return texts.get(key);
    },
    pull(key: string): string | undefined {
      return pulls.get(key);
    },
    pullIds(): Iterable<string> {
      return pulls.values();
    },
    spyPull(key: string): string | undefined {
      return spyPulls.get(key);
    },
    hasSpy(key: string): boolean {
      return spyKeys.has(key);
    },
    copyPulls(): Map<string, string> {
      return new Map(pulls);
    },
    copyReviews(): Map<string, WindowReview> {
      return new Map(reviews);
    },
    copySpyPulls(): Map<string, string> {
      return new Map(spyPulls);
    },
    setSpyKeys(keys: Set<string>): void {
      spyKeys = keys;
    },
    copySpyKeys(): Set<string> {
      return new Set(spyKeys);
    },
    /** True when the next observation differs from the one already stored. */
    changed(
      nextTickets: readonly WindowTicket[],
      nextReviews: ReadonlyMap<string, WindowReview>,
      nextFacts: ReadonlyMap<string, BranchFacts>,
      nextLogin: string | undefined,
    ): boolean {
      return (
        signTickets(nextTickets) !== signTickets(tickets) ||
        signMap(nextReviews, item => JSON.stringify(item)) !== signMap(reviews, item => JSON.stringify(item)) ||
        signMap(nextFacts, item => JSON.stringify(item)) !== signMap(facts, item => JSON.stringify(item)) ||
        nextLogin !== loginName
      );
    },
    /** Store an observation. A changed branch fingerprint drops that key's trees. The shelf stays. */
    commit(next: BoardObservation, checkoutOf: (ticket: WindowTicket) => string | undefined): void {
      const seen = new Set<string>();
      for (const ticket of next.tickets) {
        seen.add(ticket.key);
        const mark = next.facts.get(ticket.key)?.fingerprint;
        const previous = fingerprints.get(ticket.key);
        if (previous !== undefined && previous !== mark) {
          dropTrees(checkoutOf(ticket), ticket.key);
        }
        if (mark !== undefined) {
          fingerprints.set(ticket.key, mark);
        } else {
          fingerprints.delete(ticket.key);
        }
      }
      for (const key of [...fingerprints.keys()]) {
        if (!seen.has(key)) {
          fingerprints.delete(key);
          dropTrees(undefined, key);
        }
      }
      tickets = next.tickets;
      pulls = next.pulls;
      reviews = next.reviews;
      spyPulls = next.spyPulls;
      facts = next.facts;
      texts = next.texts;
      spyKeys = new Set(next.spyKeys);
      if (next.login) {
        loginName = next.login;
      }
    },
    token(key: string): string {
      const ticket = tickets.find(item => item.key === key);
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
    },
    /** The tree for this checkout and key. A later fingerprint change drops it. */
    files(checkout: string, key: string, strict: boolean): FileSource {
      const id = treeId(checkout, key, strict);
      const held = trees.get(id);
      if (held) {
        return held;
      }
      const source = strict ? strictChangeFiles(checkout, key) : changeFiles(checkout, key);
      trees.set(id, source);
      return source;
    },
    arm(key: string, revision: string): boolean {
      const saved = shelf.get(key);
      if (saved !== undefined && saved.revision === revision) {
        spineKey = key;
        spineState = saved.state;
        return false;
      }
      spineKey = key;
      spineState = 'due';
      return true;
    },
    warm(key: string, revision: string, spine: Spine | undefined): void {
      if (!spine) {
        return;
      }
      shelf.set(key, {spine, revision, state: 'ready'});
      spineKey = key;
      spineState = 'ready';
    },
    fail(key: string, revision: string): void {
      const previous = shelf.get(key);
      shelf.set(key, {spine: previous?.spine, revision, state: 'failed'});
      spineKey = key;
      spineState = 'failed';
    },
    held(key: string): {spine?: Spine; ready: boolean; revision?: string} {
      if (key === '') {
        return {ready: true};
      }
      const saved = shelf.get(key);
      if (spineKey === key && spineState === 'due') {
        return {spine: saved?.spine, ready: false, revision: saved?.revision};
      }
      return {spine: saved?.spine, ready: true, revision: saved?.revision};
    },
  };
}

export type BoardStore = ReturnType<typeof createBoardStore>;
