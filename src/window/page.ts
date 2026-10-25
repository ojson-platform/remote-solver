import type {Spine} from './spine.ts';
import type {
  BoardState,
  OverlayGroup,
  RoleOutcome,
  RoleRecord,
  ServiceConfigGroup,
  SettingsState,
  SidebarBlock,
  SkillMode,
} from './types.ts';

import {readFileSync} from 'node:fs';
import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';

import {bundleClient} from './client/bundle.ts';
import {snapshot} from './snapshot.ts';
import {ROLE_OUTCOMES} from './types.ts';

export {draftsAfterClick, headClickToggles, lineFieldClosesOnEscape} from './client/gesture.ts';

/** The window this page draws and drives. */
type Surface = {
  board: () => BoardState;
  take: (key?: string) => boolean | void;
  spy: () => void;
  sidebar: () => SidebarBlock[];
  spine: () => Spine | undefined;
  answer: (
    key: string,
    question: string,
    reply: string,
    line?: string,
    path?: string,
    at?: string,
    side?: string,
  ) => string | undefined | Promise<string | undefined>;
  acceptReview: (key: string) => string | undefined;
  shelf: () => {name: string; outcome: RoleOutcome}[];
  settings: () => SettingsState;
  overlay: () => OverlayGroup;
  serviceConfig: () => ServiceConfigGroup;
  openCard: (key: string) => boolean | void;
  openSettings: () => void;
  closeSettings: () => void;
  chooseAgent: (agentId: string) => void;
  leaveModel: (mode: SkillMode, value: string) => void;
  leaveEffort: (mode: SkillMode, value: string) => void;
  leaveSpeed: (mode: SkillMode, value: string) => void;
  leaveWatch: (names: readonly string[]) => void;
  leaveRoots: (next: {arcadia?: string; github?: string}) => void;
  addRole: (role: RoleRecord) => void;
  renameRole: (name: string, next: string) => void;
  chooseRoleOutcome: (name: string, outcome: RoleOutcome) => void;
  setRoleText: (name: string, text: string) => void;
  setRoleLabels: (name: string, labels: readonly string[]) => void;
  removeRole: (name: string) => void;
  drag: (name: string, key: string) => {popup?: string; status?: string} | undefined;
  closeCard: () => void;
  checkouts: () => string[];
  spyNote: () => string;
  turn: (key: string) => string | undefined;
  openReviewPlace: (file: string, line: number) => string | undefined;
  doorPlace: (file: string) => string | undefined;
  gateMark: (key: string, station: string, side?: boolean) => void;
  lastGate: (key: string, station: string, side?: boolean) => boolean;
  plantQueue: (key: string, name: string) => boolean;
  chooseCheckout: (next: string) => void;
  chooseOverlayAgent: (agentId: string) => void;
  clearOverlayAgent: () => void;
  leaveOverlayModel: (mode: SkillMode, value: string) => void;
  leaveOverlayEffort: (mode: SkillMode, value: string) => void;
  leaveOverlaySpeed: (mode: SkillMode, value: string) => void;
  leaveOverlayWatch: (names: readonly string[]) => void;
  setServiceBase: (value: string) => void;
  setServiceBranchScope: (value: string) => void;
  addServiceQueue: () => void;
  setServiceQueue: (index: number, name: string, description: string) => void;
  removeServiceQueue: (index: number) => void;
  moveServiceQueue: (from: number, to: number) => void;
  addServiceIgnore: (value: string) => void;
  setServiceIgnore: (index: number, value: string) => void;
  removeServiceIgnore: (index: number) => void;
  chooseServiceHook: (action: string, point: string, first: string) => void;
  setServiceHook: (action: string, point: string, values: readonly string[]) => void;
  saveServiceConfig: () => void;
  chooseService: (key: string, service: string) => void;
};

type PageView = {
  /** Grows when a turn changes, a tracker read commits, or a gesture is written. */
  generation: number;
  popup?: string;
  repair?: string;
  ask?: {key: string; station: string; side: boolean};
  opened: string;
  service: Record<string, string>;
  status?: string;
  show?: string;
  serviceDirty: boolean;
};

const BODY_LIMIT = 262144;

type ActResult = 'see' | 'unknown' | 'conflict';

function namesOf(value: string | null): string[] {
  return (value ?? '')
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(item => item !== '');
}

function modeOf(value: string | null): SkillMode | undefined {
  if (value === 'mechanical' || value === 'judgment') {
    return value;
  }
  return undefined;
}

function outcomeOf(value: string | null): RoleOutcome | undefined {
  if (value !== null && (ROLE_OUTCOMES as readonly string[]).includes(value)) {
    return value as RoleOutcome;
  }
  return undefined;
}

function intOf(value: string | null): number | undefined {
  if (value === null || !/^\d+$/.test(value)) {
    return undefined;
  }
  return Number(value);
}

function settleOpened(surface: Surface, view: PageView): void {
  if (view.opened === '') {
    return;
  }
  const board = surface.board();
  const found =
    board.pool.some(card => card.key === view.opened) ||
    board.columns.some(column => column.cards.some(card => card.key === view.opened));
  if (!found) {
    view.opened = '';
  }
}

function roleDraft(surface: Surface, params: URLSearchParams, act: string | null): void {
  if (act === 'add-role') {
    return;
  }
  if (!params.has('name') || !params.has('outcome') || !params.has('text')) {
    return;
  }
  const name = params.get('name') ?? '';
  const outcome = outcomeOf(params.get('outcome'));
  if (name === '' || !outcome) {
    return;
  }
  const role: RoleRecord = {name, outcome, text: params.get('text') ?? ''};
  if (outcome === 'ticket-fields') {
    role.labels = params.getAll('labels');
  }
  surface.addRole(role);
}

function hookDraft(surface: Surface, params: URLSearchParams, act: string | null): boolean {
  if (act === 'choose-service-hook') {
    return false;
  }
  const first = params.get('first');
  if (first === null || first.trim() === '') {
    return false;
  }
  const posted = params.get('choice') ?? '';
  const split = posted.indexOf('\t');
  if (split !== -1) {
    surface.chooseServiceHook(posted.slice(0, split), posted.slice(split + 1), first);
    return true;
  }
  const free = surface.serviceConfig().hookChoices?.[0];
  if (!free) {
    return false;
  }
  surface.chooseServiceHook(free.action, free.point, first);
  return true;
}

function finish(
  surface: Surface,
  params: URLSearchParams,
  act: string | null,
  view: PageView,
): ActResult {
  roleDraft(surface, params, act);
  if (hookDraft(surface, params, act)) {
    view.serviceDirty = true;
  }
  return 'see';
}

async function apply(
  surface: Surface,
  params: URLSearchParams,
  view: PageView,
): Promise<ActResult> {
  const act = params.get('act');
  if (act === 'repair') {
    const key = params.get('key');
    if (key) {
      view.repair = key;
    }
    return finish(surface, params, act, view);
  }
  if (act === 'close-repair') {
    view.repair = undefined;
    return finish(surface, params, act, view);
  }
  if (act === 'plant-queue') {
    const key = params.get('key') ?? '';
    if (!surface.plantQueue(key, params.get('name') ?? '')) {
      return 'conflict';
    }
    view.repair = undefined;
    return finish(surface, params, act, view);
  }
  if (act === 'close-ask') {
    view.ask = undefined;
    return finish(surface, params, act, view);
  }
  if (act === 'gate') {
    const key = params.get('key');
    const station = params.get('station');
    const side = params.get('where') === 'side';
    if (key && station) {
      if (params.get('sure') !== '1' && surface.lastGate(key, station, side)) {
        view.ask = {key, station, side};
      } else {
        view.ask = undefined;
        surface.gateMark(key, station, side);
      }
    }
    return finish(surface, params, act, view);
  }
  if (act === 'open') {
    const key = params.get('key');
    if (key && view.opened === key) {
      view.opened = '';
      surface.closeCard();
      return finish(surface, params, act, view);
    }
    if (key && surface.openCard(key)) {
      view.opened = key;
      view.show = key;
    }
    return finish(surface, params, act, view);
  }
  if (act === 'close-card') {
    view.opened = '';
    surface.closeCard();
    return finish(surface, params, act, view);
  }
  if (act === 'open-settings') {
    surface.openSettings();
    return finish(surface, params, act, view);
  }
  if (act === 'close-settings') {
    surface.closeSettings();
    view.serviceDirty = false;
    return finish(surface, params, act, view);
  }
  if (act === 'close-popup') {
    view.popup = undefined;
    return finish(surface, params, act, view);
  }
  if (act === 'choose-agent') {
    const agent = params.get('agent');
    if (agent) {
      surface.chooseAgent(agent);
    }
    return finish(surface, params, act, view);
  }
  if (act === 'leave-model') {
    const mode = modeOf(params.get('mode'));
    if (mode) {
      surface.leaveModel(mode, params.get('value') ?? '');
    }
    return finish(surface, params, act, view);
  }
  if (act === 'leave-effort') {
    const mode = modeOf(params.get('mode'));
    if (mode) {
      surface.leaveEffort(mode, params.get('value') ?? '');
    }
    return finish(surface, params, act, view);
  }
  if (act === 'leave-speed') {
    const mode = modeOf(params.get('mode'));
    if (mode) {
      surface.leaveSpeed(mode, params.get('value') ?? '');
    }
    return finish(surface, params, act, view);
  }
  if (act === 'leave-watch') {
    surface.leaveWatch(namesOf(params.get('names')));
    return finish(surface, params, act, view);
  }
  if (act === 'leave-roots') {
    surface.leaveRoots({
      arcadia: params.get('arcadia') ?? '',
      github: params.get('github') ?? '',
    });
    return finish(surface, params, act, view);
  }
  if (act === 'add-role') {
    const outcome = outcomeOf(params.get('outcome'));
    const name = params.get('name') ?? '';
    if (outcome && name !== '') {
      const role: RoleRecord = {name, outcome, text: params.get('text') ?? ''};
      if (outcome === 'ticket-fields') {
        role.labels = params.getAll('labels');
      }
      surface.addRole(role);
    }
    return finish(surface, params, act, view);
  }
  if (act === 'rename-role') {
    const name = params.get('name');
    const next = params.get('next');
    if (name && next) {
      surface.renameRole(name, next);
    }
    return finish(surface, params, act, view);
  }
  if (act === 'choose-role-outcome') {
    const name = params.get('name');
    const outcome = outcomeOf(params.get('outcome'));
    if (name && outcome) {
      surface.chooseRoleOutcome(name, outcome);
    }
    return finish(surface, params, act, view);
  }
  if (act === 'set-role-text') {
    const name = params.get('name');
    if (name) {
      surface.setRoleText(name, params.get('text') ?? '');
    }
    return finish(surface, params, act, view);
  }
  if (act === 'set-role-labels') {
    const name = params.get('name');
    if (name) {
      surface.setRoleLabels(name, params.getAll('labels'));
    }
    return finish(surface, params, act, view);
  }
  if (act === 'remove-role') {
    const name = params.get('name');
    if (name) {
      surface.removeRole(name);
    }
    return finish(surface, params, act, view);
  }
  if (act === 'answer') {
    const key = params.get('key') ?? '';
    const reply = (params.get('reply') ?? '').trim();
    if (reply === '') {
      const question = (params.get('question') ?? '').trim();
      view.status =
        question === ''
          ? 'Комментарий пустой. Напишите его в поле.'
          : 'Ответ пустой. Напишите его в поле.';
    } else if (key) {
      view.show = key;
      const status = await surface.answer(
        key,
        params.get('question') ?? '',
        reply,
        params.get('line') ?? '',
        params.get('path') ?? '',
        params.get('at') ?? '',
        params.get('side') ?? '',
      );
      if (status !== undefined) {
        view.status = status;
      }
    }
    return finish(surface, params, act, view);
  }
  if (act === 'accept-review') {
    const key = params.get('key') ?? '';
    if (key) {
      view.show = key;
      const status = surface.acceptReview(key);
      if (status !== undefined) {
        view.status = status;
      }
    }
    return finish(surface, params, act, view);
  }
  if (act === 'drag') {
    const name = params.get('name');
    const key = params.get('key');
    if (name && key) {
      view.show = key;
      const result = surface.drag(name, key);
      if (result?.popup !== undefined) {
        view.popup = result.popup;
      }
      if (result?.status !== undefined) {
        view.status = result.status;
      }
    }
    return finish(surface, params, act, view);
  }
  if (act === 'choose-checkout') {
    const checkout = params.get('checkout');
    if (checkout) {
      surface.chooseCheckout(checkout);
      view.serviceDirty = false;
    }
    return finish(surface, params, act, view);
  }
  if (act === 'choose-overlay-agent') {
    const agent = params.get('agent');
    if (agent) {
      surface.chooseOverlayAgent(agent);
    } else {
      surface.clearOverlayAgent();
    }
    return finish(surface, params, act, view);
  }
  if (act === 'leave-overlay-model') {
    const mode = modeOf(params.get('mode'));
    if (mode) {
      surface.leaveOverlayModel(mode, params.get('value') ?? '');
    }
    return finish(surface, params, act, view);
  }
  if (act === 'leave-overlay-effort') {
    const mode = modeOf(params.get('mode'));
    if (mode) {
      surface.leaveOverlayEffort(mode, params.get('value') ?? '');
    }
    return finish(surface, params, act, view);
  }
  if (act === 'leave-overlay-speed') {
    const mode = modeOf(params.get('mode'));
    if (mode) {
      surface.leaveOverlaySpeed(mode, params.get('value') ?? '');
    }
    return finish(surface, params, act, view);
  }
  if (act === 'leave-overlay-watch') {
    surface.leaveOverlayWatch(namesOf(params.get('names')));
    return finish(surface, params, act, view);
  }
  if (act === 'set-service-base') {
    surface.setServiceBase(params.get('value') ?? '');
    view.serviceDirty = true;
    return finish(surface, params, act, view);
  }
  if (act === 'set-service-branch') {
    surface.setServiceBranchScope(params.get('value') ?? '');
    view.serviceDirty = true;
    return finish(surface, params, act, view);
  }
  if (act === 'add-service-queue') {
    surface.addServiceQueue();
    view.serviceDirty = true;
    return finish(surface, params, act, view);
  }
  if (act === 'set-service-queue') {
    const names = params.getAll('name');
    const descriptions = params.getAll('description');
    const index = intOf(params.get('index'));
    if (index !== undefined && names.length <= 1) {
      surface.setServiceQueue(index, names[0] ?? '', descriptions[0] ?? '');
    } else {
      names.forEach((name, at) => {
        surface.setServiceQueue(at, name, descriptions[at] ?? '');
      });
    }
    view.serviceDirty = true;
    return finish(surface, params, act, view);
  }
  if (act === 'remove-service-queue') {
    const index = intOf(params.get('index'));
    if (index !== undefined) {
      surface.removeServiceQueue(index);
      view.serviceDirty = true;
    }
    return finish(surface, params, act, view);
  }
  if (act === 'move-service-queue') {
    const from = intOf(params.get('from'));
    const to = intOf(params.get('to'));
    if (from !== undefined && to !== undefined) {
      const length = surface.serviceConfig().queues?.items.length ?? 0;
      if (from >= length || to >= length) {
        return 'conflict';
      }
      surface.moveServiceQueue(from, to);
      view.serviceDirty = true;
    }
    return finish(surface, params, act, view);
  }
  if (act === 'add-service-ignore') {
    const value = params.get('value');
    if (value) {
      surface.addServiceIgnore(value);
      view.serviceDirty = true;
    }
    return finish(surface, params, act, view);
  }
  if (act === 'set-service-ignore') {
    const index = intOf(params.get('index'));
    if (index !== undefined) {
      surface.setServiceIgnore(index, params.get('value') ?? '');
      view.serviceDirty = true;
    }
    return finish(surface, params, act, view);
  }
  if (act === 'remove-service-ignore') {
    const index = intOf(params.get('index'));
    if (index !== undefined) {
      surface.removeServiceIgnore(index);
      view.serviceDirty = true;
    }
    return finish(surface, params, act, view);
  }
  if (act === 'choose-service-hook') {
    const choice = params.get('choice') ?? '';
    const split = choice.indexOf('\t');
    if (split !== -1) {
      surface.chooseServiceHook(
        choice.slice(0, split),
        choice.slice(split + 1),
        params.get('first') ?? '',
      );
      view.serviceDirty = true;
    }
    return finish(surface, params, act, view);
  }
  if (act === 'set-service-hook') {
    const action = params.get('hook-action');
    const point = params.get('point');
    if (action && point) {
      surface.setServiceHook(action, point, params.getAll('values'));
      view.serviceDirty = true;
    }
    return finish(surface, params, act, view);
  }
  if (act === 'save-service') {
    const writable = surface.serviceConfig().save;
    surface.saveServiceConfig();
    if (writable) {
      view.serviceDirty = false;
    }
    return finish(surface, params, act, view);
  }
  if (act === 'choose-service') {
    if (!params.has('service')) {
      return 'conflict';
    }
    const key = params.get('key');
    const service = params.get('service') ?? '';
    if (key) {
      surface.chooseService(key, service);
      view.service[key] = service;
      view.repair = undefined;
    }
    return finish(surface, params, act, view);
  }
  return 'unknown';
}

type ReadBody = {kind: 'text'; text: string} | {kind: 'too-big'};

function readBody(req: IncomingMessage): Promise<ReadBody> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let tooBig = false;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        tooBig = true;
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooBig) {
        resolve({kind: 'too-big'});
        return;
      }
      resolve({kind: 'text', text: Buffer.concat(chunks).toString('utf8')});
    });
    req.on('error', reject);
  });
}

function text(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, {'content-type': 'text/plain; charset=utf-8'});
  res.end(body);
}

function json(res: ServerResponse, body: unknown): void {
  res.writeHead(200, {'content-type': 'application/json; charset=utf-8'});
  res.end(JSON.stringify(body));
}

function written(view: PageView, listeners: Set<ServerResponse>): void {
  view.generation += 1;
  const frame = `event: change\ndata: ${JSON.stringify({generation: view.generation})}\n\n`;
  for (const client of listeners) {
    client.write(frame);
  }
}

function liveSnapshot(surface: Surface, view: PageView) {
  settleOpened(surface, view);
  const body = snapshot(surface, view);
  view.status = undefined;
  return body;
}

const SHELL =
  '<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>ai-factory</title><link rel="stylesheet" href="/face.css"><body><div id="root"></div><script src="/client.js"></script></body></html>';

function faceCss(): string {
  return readFileSync(new URL('./face.css', import.meta.url), 'utf8');
}

function failure(error: unknown): string {
  if (error instanceof Error && error.message !== '') {
    return error.message;
  }
  return 'ошибка';
}

async function handle(
  surface: Surface,
  req: IncomingMessage,
  res: ServerResponse,
  view: PageView,
  epoch: {n: number},
  listeners: Set<ServerResponse>,
  clientJs: string,
  css: string,
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  if (req.method === 'POST' && (url.pathname === '/take' || url.pathname === '/act')) {
    const mine = ++epoch.n;
    const body = await readBody(req);
    if (mine !== epoch.n) {
      text(res, 409, 'устарело');
      return;
    }
    if (body.kind === 'too-big') {
      text(res, 413, 'тело слишком большое');
      return;
    }
    const params = new URLSearchParams(body.text);
    if (url.pathname === '/take') {
      const taken = params.get('key');
      if (!surface.take(taken ?? undefined)) {
        text(res, 409, 'не записано');
        return;
      }
      if (taken) {
        view.show = taken;
      }
      surface.spy();
      written(view, listeners);
      json(res, liveSnapshot(surface, view));
      return;
    }
    const result = await apply(surface, params, view);
    if (result === 'unknown') {
      text(res, 400, 'неизвестное действие');
      return;
    }
    if (result === 'conflict') {
      text(res, 409, 'не записано');
      return;
    }
    written(view, listeners);
    json(res, liveSnapshot(surface, view));
    return;
  }
  if (req.method === 'GET' && url.pathname === '/') {
    surface.spy();
    res.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    res.end(SHELL);
    return;
  }
  if (req.method === 'GET' && url.pathname === '/client.js') {
    res.writeHead(200, {'content-type': 'text/javascript; charset=utf-8'});
    res.end(clientJs);
    return;
  }
  if (req.method === 'GET' && url.pathname === '/face.css') {
    res.writeHead(200, {'content-type': 'text/css; charset=utf-8'});
    res.end(css);
    return;
  }
  if (req.method === 'GET' && url.pathname === '/events') {
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.write(`event: change\ndata: ${JSON.stringify({generation: view.generation})}\n\n`);
    listeners.add(res);
    req.on('close', () => listeners.delete(res));
    return;
  }
  if (req.method === 'GET' && url.pathname === '/snapshot') {
    json(res, liveSnapshot(surface, view));
    return;
  }
  res.writeHead(404);
  res.end();
}

/** One process serves the window page. */
export async function serveBoard(surface: Surface): Promise<{
  url: string;
  close(): Promise<void>;
  note(): void;
}> {
  const view: PageView = {generation: 0, opened: '', service: {}, serviceDirty: false};
  const epoch = {n: 0};
  const listeners = new Set<ServerResponse>();
  const clientJs = await bundleClient();
  const css = faceCss();
  const server = createServer((req, res) => {
    handle(surface, req, res, view, epoch, listeners, clientJs, css).catch(error => {
      if (!res.headersSent) {
        text(res, 500, failure(error));
        return;
      }
      res.end();
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('board page did not bind'));
        return;
      }
      resolve({
        url: `http://127.0.0.1:${address.port}/`,
        note() {
          written(view, listeners);
        },
        close: () =>
          new Promise((done, fail) => {
            server.close(error => (error ? fail(error) : done()));
          }),
      });
    });
  });
}
