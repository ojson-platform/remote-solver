import {createHash} from 'node:crypto';

import type {BranchFacts, BranchText} from '../machine/change/types.ts';
import type {Decision} from '../machine/decide/types.ts';
import {phaseOf} from '../machine/phase/phase.ts';

import {mergeReviewsPreservingLocal} from './store.ts';
import type {WindowReview, WindowTicket} from './types.ts';

export type Work =
  | {kind: 'running'; phase: string; action: string}
  | {kind: 'held'; phase: string; action: string}
  | {kind: 'closed'};

export type LabelWish = {token: number; key: string; label: string; on: boolean};

export type Screen = {
  station: string | undefined;
  activity?: {kind: 'running' | 'held'; phase: string; action: string};
  reading?: Decision;
  plaqueDecision?: Decision;
  facts?: BranchFacts;
  text?: BranchText;
};

export type Desk = {
  admit(read: {id: number; tickets: WindowTicket[]; reviews?: Map<string, WindowReview>}): boolean;
  noteBranch(
    key: string,
    read:
      | {token: number; fingerprint: string; facts: BranchFacts; text?: BranchText}
      | {token: number; failed: true},
  ): void;
  noteWork(
    key: string,
    event:
      | {kind: 'running'; phase: string; action: string}
      | {kind: 'held'; phase: string; action: string}
      | {kind: 'settled'; decision: Decision}
      | {kind: 'clear'},
  ): void;
  hold(keys: readonly {key: string; phase: string; action: string}[]): void;
  wish(key: string, wish: LabelWish | {kind: 'drop'; token: number}): void;
  project(key: string): Screen | undefined;
  projectHeader(): string;
  spineRevision(key: string): string | undefined;
};

type Slot = {
  work: Work;
  decision?: Decision;
  facts?: BranchFacts;
  text?: BranchText;
  branchToken: number;
};

function gateOf(decision: Decision | undefined): Decision | undefined {
  return decision?.kind === 'wait' && decision.gate ? decision : undefined;
}

/** One cycle body per issue. `project` is the only screen. */
export function createDesk(): Desk {
  let hostId = 0;
  const tickets = new Map<string, WindowTicket>();
  let reviews = new Map<string, WindowReview>();
  const slots = new Map<string, Slot>();
  let wishes: LabelWish[] = [];

  function slot(key: string): Slot {
    const found = slots.get(key);
    if (found) {
      return found;
    }
    const created: Slot = {work: {kind: 'closed'}, branchToken: 0};
    slots.set(key, created);
    return created;
  }

  function known(key: string): boolean {
    return tickets.has(key) || slots.has(key);
  }

  function labelsOf(key: string): string[] {
    let next = [...(tickets.get(key)?.labels ?? [])];
    for (const wish of wishes) {
      if (wish.key !== key) {
        continue;
      }
      const has = next.includes(wish.label);
      if (has === wish.on) {
        continue;
      }
      if (wish.on) {
        next = [...next, wish.label];
      } else {
        next = next.filter(label => label !== wish.label);
      }
    }
    return next;
  }

  function stationOf(key: string): string | undefined {
    return phaseOf(labelsOf(key)) ?? undefined;
  }

  function retire(raw: ReadonlyMap<string, readonly string[]>): void {
    wishes = wishes.filter(wish => {
      const labels = raw.get(wish.key);
      if (!labels) {
        return true;
      }
      return labels.includes(wish.label) !== wish.on;
    });
  }

  return {
    admit(read) {
      if (read.id < hostId) {
        return false;
      }
      hostId = read.id;
      tickets.clear();
      for (const ticket of read.tickets) {
        tickets.set(ticket.key, ticket);
        slot(ticket.key);
      }
      if (read.reviews) {
        reviews = mergeReviewsPreservingLocal(reviews, read.reviews);
      }
      retire(new Map(read.tickets.map(ticket => [ticket.key, ticket.labels])));
      return true;
    },
    noteBranch(key, read) {
      const body = slot(key);
      if (read.token < body.branchToken) {
        return;
      }
      body.branchToken = read.token;
      if ('failed' in read) {
        return;
      }
      body.facts = read.facts;
      if (read.text) {
        body.text = read.text;
      }
    },
    noteWork(key, event) {
      const body = slot(key);
      if (event.kind === 'clear') {
        body.work = {kind: 'closed'};
        return;
      }
      if (event.kind === 'settled') {
        if (body.work.kind === 'running' && !gateOf(event.decision)) {
          return;
        }
        if (body.work.kind === 'held') {
          if (gateOf(event.decision)) {
            body.decision = event.decision;
          }
          return;
        }
        body.decision = event.decision;
        body.work = {kind: 'closed'};
        return;
      }
      body.work = event;
    },
    hold(keys) {
      const next = new Set(keys.map(item => item.key));
      for (const [key, body] of slots) {
        if (body.work.kind === 'held' && !next.has(key)) {
          body.work = {kind: 'closed'};
        }
      }
      for (const item of keys) {
        const body = slot(item.key);
        if (body.work.kind === 'running') {
          continue;
        }
        body.work = {kind: 'held', phase: item.phase, action: item.action};
      }
    },
    wish(key, wish) {
      if ('kind' in wish) {
        wishes = wishes.filter(item => item.token !== wish.token);
        return;
      }
      const next = {...wish, key};
      const index = wishes.findIndex(item => item.key === key && item.label === wish.label);
      if (index >= 0) {
        wishes[index] = next;
      } else {
        wishes.push(next);
      }
    },
    project(key) {
      if (!known(key)) {
        return undefined;
      }
      const body = slots.get(key);
      const work = body?.work ?? {kind: 'closed' as const};
      const decision = body?.decision;
      const reading = work.kind === 'closed' ? decision : undefined;
      const plaqueDecision = work.kind === 'running' ? gateOf(decision) : reading;
      return {
        station: stationOf(key),
        ...(work.kind === 'closed' ? {} : {activity: work}),
        ...(reading ? {reading} : {}),
        ...(plaqueDecision ? {plaqueDecision} : {}),
        ...(body?.facts ? {facts: body.facts} : {}),
        ...(body?.text ? {text: body.text} : {}),
      };
    },
    projectHeader() {
      const turns: {issue: string; phase: string; action: string}[] = [];
      for (const [key, body] of slots) {
        if (body.work.kind !== 'running') {
          continue;
        }
        turns.push({issue: key, phase: body.work.phase, action: body.work.action});
      }
      return turns
        .sort((left, right) => left.issue.localeCompare(right.issue))
        .map(turn => `#${turn.issue} ${turn.phase} → ${turn.action}`)
        .join(' · ');
    },
    spineRevision(key) {
      if (!known(key)) {
        return undefined;
      }
      const fingerprint = slots.get(key)?.facts?.fingerprint ?? '';
      return createHash('sha256')
        .update(`${stationOf(key) ?? ''}\0${hostId}\0${fingerprint}`)
        .digest('hex')
        .slice(0, 16);
    },
  };
}
