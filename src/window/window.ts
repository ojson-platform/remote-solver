import type {
  BoardState,
  GateStation,
  Launch,
  RoleOutcome,
  RoleRecord,
  SkillMode,
  WindowOutside,
  WindowTicket,
} from './types.ts';

import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';

import {phaseOf} from '../machine/phase.ts';

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
import {focusNamesPlace, focusPlaque} from './focus.ts';
import {openRoleEditor, runRole, shelfOf} from './role.ts';
import {openServiceGroup} from './service-group.ts';
import {blocksFor} from './sidebar.ts';
import {buildSpine, projectSpine, reviewGateForPhase, type Spine} from './spine.ts';
import {runSpy} from './spy.ts';
import {COLUMN_NAMES, GATE_LABEL, GATE_STATIONS, isGateStation} from './types.ts';

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

function wholeLine(at: string): number | undefined {
  if (!/^[0-9]+$/.test(at)) {
    return undefined;
  }
  return Number(at);
}

function anchorSide(side: string): 'right' | 'left' {
  if (side === 'left') {
    return 'left';
  }
  return 'right';
}

function quotedLine(source: string, reply: string): string {
  const line = source.trim();
  if (line === '') {
    return reply;
  }
  return `> ${line}\n\n${reply}`;
}

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
    repoDir: launch.repoDir,
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
      review: key => outside.review?.(key),
      facts: key => outside.branchFacts?.(key),
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
      branchFacts: key => outside.branchFacts?.(key),
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

  function gateAllowed(key: string, station: string, side: boolean): station is GateStation {
    if (!isGateStation(station)) {
      return false;
    }
    const cycles = placed(checkout.settle().watch);
    const column = cycles.columns.find(item => item.cards.some(card => card.key === key));
    const plaque = column?.name ?? cycles.pool.find(card => card.key === key)?.station;
    if (!plaque || side) {
      return true;
    }
    return COLUMN_NAMES.indexOf(station) > COLUMN_NAMES.indexOf(plaque);
  }

  const shelf = new Map<string, {spine?: Spine; revision: string; state: 'ready' | 'failed'}>();
  let spineKey = '';
  let spineState: 'idle' | 'due' | 'ready' | 'failed' = 'idle';

  function spineRevision(key: string, epoch: number): string {
    const token = outside.spineToken?.(key);
    const source = token !== undefined ? token : `epoch:${epoch}`;
    return createHash('sha256').update(source).digest('hex');
  }

  function readOpenSpine(): Spine | undefined {
    if (openKey === '') {
      return undefined;
    }
    const item = checkout.sorted().find(ticket => ticket.key === openKey);
    if (!item) {
      return undefined;
    }
    const cycles = placed(checkout.settle().watch);
    const column = cycles.columns.find(entry => entry.cards.some(card => card.key === item.key));
    const station = column?.name ?? cycles.pool.find(card => card.key === item.key)?.station;
    const phase = phaseOf([...item.labels]);
    const gateOff: Partial<Record<GateStation, true>> = {};
    for (const name of GATE_STATIONS) {
      if (item.labels.includes(GATE_LABEL[name])) {
        gateOff[name] = true;
      }
    }
    const chrome = {
      key: item.key,
      station,
      focusBody: focusPlaque(item.comments),
      issueBody: item.body,
      checks: item.checks,
      diff: item.diff === true,
      pull: (item.openPullRequests ?? 0) === 1,
      reviewGate: reviewGateForPhase(phase),
      gateOff,
    };
    const text = outside.branchText?.(item.key);
    if (text) {
      return projectSpine(text, chrome);
    }
    return buildSpine({...chrome, checkout: checkout.gathered(item)});
  }

  return {
    board,
    spyNote: () => outside.spyNote?.() ?? '',
    turn: (key: string) => outside.turn?.(key),
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
      const result = runRole({
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
      if (!result) {
        return undefined;
      }
      if ('popup' in result) {
        return {popup: result.popup};
      }
      if (role.outcome === 'ticket-fields') {
        return {status: `${role.name} ${key}`};
      }
      return {status: result.status};
    },
    overlay: () => overlaySession.view(home.doc()),
    sidebar,
    spine() {
      return readOpenSpine();
    },
    armSpine(epoch: number): boolean {
      if (openKey === '') {
        return false;
      }
      const revision = spineRevision(openKey, epoch);
      const saved = shelf.get(openKey);
      if (saved !== undefined && saved.revision === revision) {
        spineKey = openKey;
        spineState = saved.state;
        return false;
      }
      spineKey = openKey;
      spineState = 'due';
      return true;
    },
    warmSpine(epoch: number): void {
      const key = openKey;
      const revision = spineRevision(key, epoch);
      const built = readOpenSpine();
      if (openKey !== key || !built) {
        return;
      }
      shelf.set(key, {spine: built, revision, state: 'ready'});
      spineKey = key;
      spineState = 'ready';
    },
    failSpine(epoch: number): void {
      const key = openKey;
      const previous = shelf.get(key);
      shelf.set(key, {
        spine: previous?.spine,
        revision: spineRevision(key, epoch),
        state: 'failed',
      });
      spineKey = key;
      spineState = 'failed';
    },
    heldSpine(): {spine?: Spine; ready: boolean} {
      if (openKey === '') {
        return {ready: true};
      }
      const saved = shelf.get(openKey);
      if (spineKey === openKey && spineState === 'due') {
        return {spine: saved?.spine, ready: false};
      }
      return {spine: saved?.spine, ready: true};
    },
    async answer(
      key: string,
      question: string,
      reply: string,
      source = '',
      path = '',
      at = '',
      side = '',
    ): Promise<string | undefined> {
      const text = reply.trim();
      const asked = question.trim();
      if (text === '') {
        if (asked === '') {
          return 'Комментарий пустой. Напишите его в поле.';
        }
        return 'Ответ пустой. Напишите его в поле.';
      }
      const item = checkout.sorted().find(ticket => ticket.key === key);
      if (!item || (item.openPullRequests ?? 0) !== 1) {
        return 'комментарий не записан';
      }
      const comment = (body: string): string | undefined => {
        if (!outside.commentPull) {
          return 'комментарий не записан';
        }
        outside.commentPull(key, body);
        return undefined;
      };
      if (asked !== '') {
        return comment(`- [ ] ${asked}\n\n${text}`);
      }
      const line = wholeLine(at);
      if (path === '' || line === undefined) {
        return comment(quotedLine(source, text));
      }
      try {
        if (!outside.threadPull) {
          throw new Error('thread is missing');
        }
        await outside.threadPull(key, text, {path, line, side: anchorSide(side)});
      } catch {
        try {
          if (!outside.speakPull) {
            throw new Error('speak is missing');
          }
          await outside.speakPull(key, quotedLine(source, text));
        } catch {
          return 'комментарий не записан';
        }
      }
      return undefined;
    },
    acceptReview(key: string) {
      const item = checkout.sorted().find(ticket => ticket.key === key);
      const phase = item ? phaseOf([...item.labels]) : null;
      const gate = reviewGateForPhase(phase);
      if (!item || !gate || (item.openPullRequests ?? 0) !== 1 || !outside.editLabels) {
        return 'Принять не удалось.';
      }
      outside.editLabels(key, [`sdd:${gate}`]);
      return undefined;
    },
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
    closeCard() {
      openKey = '';
    },
    checkouts() {
      return checkout.gatheredCheckouts();
    },
    openCard(key: string): boolean {
      if (!checkout.sorted().some(ticket => ticket.key === key)) {
        return false;
      }
      const state = board();
      const item = checkout.sorted().find(ticket => ticket.key === key);
      if (!item) {
        return false;
      }
      const located = checkout.gathered(item);
      const gatheredOk = located !== undefined && checkout.gatheredCheckouts().includes(located);
      const onBoard =
        state.pool.some(card => card.key === key) ||
        state.columns.some(column => column.cards.some(card => card.key === key));
      if (!onBoard && !gatheredOk) {
        return false;
      }
      if (gatheredOk && located !== undefined) {
        remember(located);
      }
      openKey = key;
      return true;
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
    doorPlace(file: string): string | undefined {
      const url = outside.reviewPlace?.({file, line: 1});
      return url ? url : undefined;
    },
    plantQueue(key: string, name: string): boolean {
      const queue = name.trim();
      if (queue === '' || queue.includes('\n') || queue.includes('\r')) {
        return false;
      }
      const item = checkout.sorted().find(ticket => ticket.key === key);
      if (!item) {
        return false;
      }
      const card = checkout.cardOf(item);
      if (card.reason !== 'конфига сервиса нет' || !card.checkout) {
        return false;
      }
      const file = path.join(card.checkout, 'openspec', 'config.yaml');
      if (existsSync(file)) {
        return false;
      }
      mkdirSync(path.dirname(file), {recursive: true});
      writeFileSync(file, `sdd:\n  queues:\n    - name: ${JSON.stringify(queue)}\n`);
      return true;
    },
    lastGate(key: string, station: string, side?: boolean): boolean {
      if (!gateAllowed(key, station, side === true)) {
        return false;
      }
      const item = checkout.sorted().find(ticket => ticket.key === key);
      if (!item || item.labels.includes(GATE_LABEL[station])) {
        return false;
      }
      return GATE_STATIONS.every(
        name => name === station || item.labels.includes(GATE_LABEL[name]),
      );
    },
    gateMark(key: string, station: string, side?: boolean): void {
      if (!gateAllowed(key, station, side === true)) {
        return;
      }
      const item = checkout.sorted().find(ticket => ticket.key === key);
      if (!item) {
        return;
      }
      const label = GATE_LABEL[station];
      const present = item.labels.includes(label);
      outside.editLabels?.(key, present ? [] : [label], present ? [label] : []);
    },
    gatheredOf(item: WindowTicket): string | undefined {
      return checkout.gathered(item);
    },
    take(key?: string): boolean {
      if (!key || !answers()) {
        return false;
      }
      const view = checkout.settle();
      const card = placed(view.watch).pool.find(item => item.key === key);
      if (!card || card.takeDisabled) {
        return false;
      }
      const login = outside.login?.();
      if (login === undefined || outside.writeAssignee === undefined) {
        return false;
      }
      outside.writeAssignee(key, login);
      return true;
    },
    spy,
  };
}
