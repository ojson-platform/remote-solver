import {phaseOf} from '../machine/phase.ts';

import {slotOf} from './board.ts';
import type {Factory} from './factory.ts';
import type {CardState, WindowTicket} from './types.ts';

/** Starts a step for a checkout that can move, then writes `proposing` for this manager's phaseless ticket. */
export function runSpy(input: {
  answers: boolean;
  modelsReady: boolean;
  homeFactory: Factory;
  hasTickets: boolean;
  settle: () => {cards: readonly CardState[]; watch: readonly string[]};
  reading: () => readonly WindowTicket[];
  onWatch: (item: WindowTicket, watch: readonly string[]) => boolean;
  gathered: (item: WindowTicket) => string | undefined;
  serviceBroken: (checkout: string) => boolean;
  canStart: (checkout: string | undefined) => boolean;
  factoryFor: (checkout: string | undefined) => Factory;
  login: () => string | undefined;
  leading: (key: string) => boolean;
  startStep?: (checkout?: string, models?: {mechanical: string; judgment: string}) => void;
  writePhase?: (key: string, phase: string) => void;
}): void {
  if (!input.answers) {
    return;
  }
  if (!input.hasTickets) {
    if (!input.modelsReady) {
      return;
    }
    input.startStep?.(undefined, {
      mechanical: input.homeFactory.mechanical,
      judgment: input.homeFactory.judgment,
    });
    return;
  }
  const view = input.settle();
  const manager = input.login();
  const reading = input.reading();
  for (const card of view.cards) {
    if (card.reason !== '' || !card.checkout || input.serviceBroken(card.checkout)) {
      continue;
    }
    const item = reading.find(ticket => ticket.key === card.key);
    if (!item) {
      continue;
    }
    const phase = phaseOf([...item.labels]);
    const where = slotOf(item, phase, manager);
    if (where !== 'cards' && where !== 'pool' && where !== 'hide') {
      continue;
    }
    if (input.leading(item.key)) {
      continue;
    }
    const factory = input.factoryFor(card.checkout);
    if (!input.canStart(card.checkout)) {
      continue;
    }
    input.startStep?.(card.checkout, {
      mechanical: factory.mechanical,
      judgment: factory.judgment,
    });
  }
  if (manager === undefined) {
    return;
  }
  for (const item of reading) {
    if (!input.onWatch(item, view.watch) || item.open === false) {
      continue;
    }
    if (item.labels.includes('sdd:cancelled') || phaseOf([...item.labels]) !== null) {
      continue;
    }
    if (item.assignee !== manager) {
      continue;
    }
    const located = input.gathered(item);
    if (located && input.serviceBroken(located)) {
      continue;
    }
    const card = view.cards.find(entry => entry.key === item.key);
    const stopped =
      (item.openPullRequests ?? 0) > 1 ||
      (card?.reason ?? '') !== '' ||
      !input.canStart(card?.checkout);
    if (stopped) {
      continue;
    }
    input.writePhase?.(item.key, 'proposing');
  }
}
