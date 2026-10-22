import type {
  BoardState,
  Launch,
  RoleOutcome,
  RoleRecord,
  SkillMode,
  WindowOutside,
} from './types.ts';

import {lay} from './board.ts';
import {openCheckout, unreadableRow} from './checkout.ts';
import {
  FACTORY_AGENTS,
  agentRows,
  catalogRejections,
  gapRows,
  mergeFactory,
  modelRow,
  openHome,
  openOverlay,
  readOverlayDoc,
  slotsFilled,
  takeBlock,
  type Factory,
} from './factory.ts';
import {focusNamesPlace} from './focus.ts';
import {openRoleEditor, runRole, shelfOf} from './role.ts';
import {openServiceGroup} from './service-group.ts';
import {blocksFor} from './sidebar.ts';
import {runSpy} from './spy.ts';

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
  RoleOutcome,
  RoleRecord,
  ServiceConfigGroup,
  ServiceHookChoice,
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
  const roles = openRoleEditor(
    () => home.doc().roles,
    next => home.leaveRoles(next),
  );
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
    return catalogRejections(factory, outside.catalog);
  }

  function canStart(located: string | undefined): boolean {
    const factory = factoryFor(located);
    return slotsFilled(factory, rejectedOf(factory));
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
    runSpy({
      answers: answers(),
      modelsReady: home.modelsReady(),
      homeFactory: mergeFactory(home.doc(), null),
      hasTickets: outside.tickets !== undefined,
      settle: () => checkout.settle(),
      reading: () => checkout.sorted(),
      onWatch: (item, watch) => checkout.onWatch(item, watch),
      gathered: item => checkout.gathered(item),
      serviceBroken: located => checkout.serviceBroken(located),
      canStart,
      factoryFor,
      login: () => outside.login?.(),
      leading: key => outside.leading?.(key) === true,
      startStep: outside.startStep,
      writePhase: outside.writePhase,
    });
  }

  return {
    board,
    shelf: () => shelfOf(roles.list()),
    settings: () => home.settings(settingsOpen),
    addRole: (role: RoleRecord) => roles.add(role),
    renameRole: (name: string, next: string) => roles.rename(name, next),
    chooseRoleOutcome: (name: string, outcome: RoleOutcome) => roles.choose(name, outcome),
    setRoleText: (name: string, text: string) => roles.setText(name, text),
    setRoleLabels: (name: string, labels: readonly string[]) => roles.setLabels(name, labels),
    removeRole: (name: string) => roles.remove(name),
    drag(name: string, key: string) {
      const role = roles.list().find(item => item.name === name);
      if (!role) {
        return undefined;
      }
      const item = checkout.sorted().find(ticket => ticket.key === key);
      if (!item) {
        return undefined;
      }
      return runRole({
        role,
        openPullRequests: item.openPullRequests ?? 0,
        checkout: checkout.gathered(item),
        editLabels: add => {
          outside.editLabels?.(key, add);
        },
        writeHooks: text => {
          outside.writeHooks?.(key, text);
        },
        commentPull: body => {
          outside.commentPull?.(key, body);
        },
      });
    },
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
    chooseServiceHook: (action: string, point: string, first: string) =>
      service.chooseHook(action, point, first),
    setServiceHook: (action: string, point: string, values: readonly string[]) =>
      service.setHook(action, point, values),
    saveServiceConfig: () => service.save(),
    chooseOverlayAgent: (agentId: string) => overlaySession.chooseAgent(agentId),
    clearOverlayAgent: () => overlaySession.clearAgent(),
    leaveOverlayModel: (mode: SkillMode, value: string) => overlaySession.leaveModel(mode, value),
    leaveOverlayEffort: (mode: SkillMode, value: string) => overlaySession.leaveEffort(mode, value),
    leaveOverlaySpeed: (mode: SkillMode, value: string) => overlaySession.leaveSpeed(mode, value),
    leaveOverlayWatch: (names: readonly string[]) => overlaySession.leaveWatch(names),
    chooseAgent: (agentId: string) => home.chooseAgent(agentId),
    leaveModel: (mode: SkillMode, value: string) => home.leaveModel(mode, value),
    leaveEffort: (mode: SkillMode, value: string) => home.leaveEffort(mode, value),
    leaveSpeed: (mode: SkillMode, value: string) => home.leaveSpeed(mode, value),
    leaveWatch: (names: readonly string[]) => home.leaveWatch(names),
    leaveRoots: (nextRoots: {arcadia?: string; github?: string}) => home.leaveRoots(nextRoots),
    chooseService(key: string, service: string) {
      outside.writeService?.(key, service);
    },
    openReviewPlace(file: string, line: number): string | undefined {
      if (openKey === '') {
        return undefined;
      }
      const item = checkout.sorted().find(ticket => ticket.key === openKey);
      if (!item || !focusNamesPlace(item.comments, file, line)) {
        return undefined;
      }
      return outside.reviewPlace?.({file, line});
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
