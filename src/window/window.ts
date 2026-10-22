import type {BoardState, Launch, SkillMode, WindowOutside} from './types.ts';

import {phaseOf} from '../machine/phase.ts';

import {lay, slotOf} from './board.ts';
import {openCheckout, unreadableRow} from './checkout.ts';
import {
  FACTORY_AGENTS,
  agentRows,
  gapRows,
  mergeFactory,
  modelRow,
  openHome,
  openOverlay,
  readOverlayDoc,
  rejectedSlots,
  takeBlock,
  type Factory,
} from './factory.ts';
import {openServiceGroup} from './service-group.ts';
import {blocksFor} from './sidebar.ts';

export type {
  AdapterKind,
  BoardState,
  CardState,
  ColumnName,
  CycleCard,
  Launch,
  ModelField,
  OverlayGroup,
  PhaseRow,
  PoolCard,
  ServiceConfigGroup,
  ServiceHookField,
  ServiceIgnoreField,
  ServiceQueueField,
  SettingsState,
  SidebarBlock,
  SidebarHookPoint,
  WindowComment,
  WindowOutside,
  WindowReview,
  WindowTicket,
} from './types.ts';

/** The window for one launch. Another launch has its own home path. */
export function openWindow(launch: Launch = {}, outside: WindowOutside = {}) {
  const offered = launch.agents ?? FACTORY_AGENTS;
  const home = openHome(launch.homePath, offered);
  const overlaySession = openOverlay(offered);
  const service = openServiceGroup();
  const checkout = openCheckout({
    kind: launch.adapter ?? 'tracker',
    home: () => home.disk(),
    tickets: outside.tickets,
    writeService: outside.writeService,
  });
  let settingsOpen = false;
  let openKey = '';

  function remember(next: string): void {
    overlaySession.bind(next);
    service.bind(next);
  }

  function answers(): boolean {
    if (!home.recorded()) {
      return false;
    }
    return outside.answers?.(home.agent()) ?? true;
  }

  function factoryFor(located: string | undefined): Factory {
    return mergeFactory(home.doc(), located ? readOverlayDoc(located) : null);
  }

  function rejectedOf(factory: Factory): {mode: SkillMode; id: string}[] {
    if (!outside.catalog || factory.agent === '') {
      return [];
    }
    return rejectedSlots(factory, outside.catalog(factory.agent));
  }

  function canStart(located: string | undefined): boolean {
    const factory = factoryFor(located);
    return factory.mechanical !== '' && factory.judgment !== '' && rejectedOf(factory).length === 0;
  }

  function checkoutRows(): {text: string}[] {
    const out: {text: string}[] = [];
    for (const located of checkout.gatheredCheckouts()) {
      const factory = factoryFor(located);
      out.push(...gapRows(located, factory, rejectedOf(factory)));
      if (checkout.serviceBroken(located)) {
        out.push(unreadableRow(located));
      }
    }
    return out;
  }

  function rows(live: boolean): {text: string}[] {
    const blocked = agentRows(home.recorded(), live);
    if (blocked) {
      return blocked;
    }
    return [...modelRow(home.doc()), ...checkoutRows()];
  }

  function placed(watch: readonly string[]) {
    return lay({
      reading: checkout.sorted(),
      watch,
      manager: outside.login?.(),
      live: answers(),
      onWatch: (item, names) => checkout.onWatch(item, names),
      gathered: item => checkout.gathered(item),
      serviceBroken: located => checkout.serviceBroken(located),
      cardOf: item => checkout.cardOf(item),
      leading: key => outside.leading?.(key) === true,
      takeBlock: located => {
        const factory = factoryFor(located);
        return takeBlock(factory, rejectedOf(factory).length > 0);
      },
    });
  }

  function board(): BoardState {
    const live = answers();
    const view = checkout.settle();
    const cycles = placed(view.watch);
    return {
      visible: true,
      rows: rows(live),
      settingsOpen,
      stepsStart: live && home.modelsReady(),
      takeDisabled: !live,
      cards: outside.tickets ? view.cards.filter(card => !cycles.taken.has(card.key)) : [],
      watch: view.watch,
      pool: cycles.pool,
      columns: cycles.columns,
    };
  }

  function sidebar() {
    if (openKey === '') {
      return [];
    }
    const item = checkout.sorted().find(ticket => ticket.key === openKey);
    if (!item) {
      return [];
    }
    return blocksFor(item, {
      manager: () => outside.login?.(),
      review: () => outside.review?.(item.key),
      reading: () => checkout.sorted(),
      gathered: ticket => checkout.gathered(ticket),
      serviceBroken: located => checkout.serviceBroken(located),
      cardOf: ticket => checkout.cardOf(ticket),
      leading: key => outside.leading?.(key) === true,
    });
  }

  function spy(): void {
    if (!answers()) {
      return;
    }
    if (!outside.tickets) {
      if (!home.modelsReady()) {
        return;
      }
      const homeFactory = mergeFactory(home.doc(), null);
      outside.startStep?.(undefined, {
        mechanical: homeFactory.mechanical,
        judgment: homeFactory.judgment,
      });
      return;
    }
    const view = checkout.settle();
    const manager = outside.login?.();
    const reading = checkout.sorted();
    for (const card of view.cards) {
      if (card.reason !== '' || !card.checkout || checkout.serviceBroken(card.checkout)) {
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
      if (outside.leading?.(item.key) === true) {
        continue;
      }
      const factory = factoryFor(card.checkout);
      if (!canStart(card.checkout)) {
        continue;
      }
      outside.startStep?.(card.checkout, {
        mechanical: factory.mechanical,
        judgment: factory.judgment,
      });
    }
    if (manager === undefined) {
      return;
    }
    for (const item of reading) {
      if (!checkout.onWatch(item, view.watch) || item.open === false) {
        continue;
      }
      if (item.labels.includes('sdd:cancelled') || phaseOf([...item.labels]) !== null) {
        continue;
      }
      if (item.assignee !== manager) {
        continue;
      }
      const located = checkout.gathered(item);
      if (located && checkout.serviceBroken(located)) {
        continue;
      }
      const card = view.cards.find(entry => entry.key === item.key);
      const stopped =
        (item.openPullRequests ?? 0) > 1 ||
        (card?.reason ?? '') !== '' ||
        !canStart(card?.checkout);
      if (stopped) {
        continue;
      }
      outside.writePhase?.(item.key, 'proposing');
    }
  }

  return {
    board,
    settings: () => home.settings(settingsOpen),
    overlay: () => overlaySession.view(home.doc()),
    sidebar,
    openSettings() {
      settingsOpen = true;
      if (overlaySession.checkout() !== '') {
        return;
      }
      const checkouts = checkout.gatheredCheckouts();
      if (checkouts.length !== 1 || checkout.serviceBroken(checkouts[0])) {
        return;
      }
      remember(checkouts[0]);
    },
    closeSettings() {
      settingsOpen = false;
      service.discard();
    },
    openCard(key: string) {
      const item = checkout.sorted().find(ticket => ticket.key === key);
      if (!item) {
        return;
      }
      const located = checkout.gathered(item);
      if (!located || !checkout.gatheredCheckouts().includes(located)) {
        return;
      }
      remember(located);
      openKey = key;
    },
    chooseCheckout(next: string) {
      if (!checkout.gatheredCheckouts().includes(next)) {
        return;
      }
      remember(next);
    },
    serviceConfig: () => service.view(),
    childQueue: () => service.childQueue(),
    setServiceBase: (value: string) => service.setBase(value),
    setServiceBranchScope: (value: string) => service.setBranchScope(value),
    addServiceQueue: () => service.addQueue(),
    setServiceQueue: (index: number, name: string, description: string) =>
      service.setQueue(index, name, description),
    removeServiceQueue: (index: number) => service.removeQueue(index),
    moveServiceQueue: (from: number, to: number) => service.moveQueue(from, to),
    addServiceIgnore: (value: string) => service.addIgnore(value),
    setServiceIgnore: (index: number, value: string) => service.setIgnore(index, value),
    removeServiceIgnore: (index: number) => service.removeIgnore(index),
    saveServiceConfig: () => service.save(),
    chooseOverlayAgent: (agentId: string) => overlaySession.chooseAgent(agentId),
    clearOverlayAgent: () => overlaySession.clearAgent(),
    leaveOverlayModel: (mode: SkillMode, value: string) => overlaySession.leaveModel(mode, value),
    chooseAgent: (agentId: string) => home.chooseAgent(agentId),
    leaveModel: (mode: SkillMode, value: string) => home.leaveModel(mode, value),
    leaveEffort: (mode: SkillMode, value: string) => home.leaveEffort(mode, value),
    leaveSpeed: (mode: SkillMode, value: string) => home.leaveSpeed(mode, value),
    leaveWatch: (names: readonly string[]) => home.leaveWatch(names),
    leaveRoots: (nextRoots: {arcadia?: string; github?: string}) => home.leaveRoots(nextRoots),
    chooseService(key: string, service: string) {
      outside.writeService?.(key, service);
    },
    take(key?: string) {
      if (!key || !answers()) {
        return;
      }
      const view = checkout.settle();
      const card = placed(view.watch).pool.find(item => item.key === key);
      if (!card || card.takeDisabled) {
        return;
      }
      const login = outside.login?.();
      if (login === undefined) {
        return;
      }
      outside.writeAssignee?.(key, login);
    },
    spy,
  };
}
