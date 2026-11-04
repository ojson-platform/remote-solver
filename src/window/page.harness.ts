import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {request as httpRequest} from 'node:http';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

import {changeDir} from '../machine/naming.ts';

import {renderWindow} from './client/render.ts';
import {serveBoard} from './page.ts';
import type {WindowSnapshot} from './snapshot.ts';
import {
  COLUMN_NAMES,
  type BoardState,
  type PoolCard,
  type RoleRecord,
  type SettingsState,
  type SidebarBlock,
} from './types.ts';
import {openWindow, type WindowTicket} from './window.ts';

export const MANAGER = 'ada';

export function yard(): {dir: string; home: string; arcadia: string} {
  const dir = mkdtempSync(path.join(tmpdir(), 'ai-factory-page-'));
  const arcadia = path.join(dir, 'arcadia');
  mkdirSync(arcadia, {recursive: true});
  return {dir, home: path.join(dir, 'home.yaml'), arcadia};
}

export function prepare(arcadia: string, home: string): void {
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(path.join(checkout, 'openspec'), {recursive: true});
  writeFileSync(
    path.join(checkout, 'openspec', 'config.yaml'),
    'sdd:\n  queues:\n    - name: alpha\n',
  );
  writeFileSync(home, `watch:\n  - alpha\nroots:\n  arcadia: ${arcadia}\n`);
}

export function ticket(over: Partial<WindowTicket> & Pick<WindowTicket, 'key'>): WindowTicket {
  return {title: over.key, labels: ['sdd:cycle'], ...over};
}

export function between(html: string, start: string, end: string): string {
  const from = html.indexOf(start);
  const to = html.indexOf(end, from + start.length);
  assert.ok(from >= 0, start);
  assert.ok(to > from, end);
  return html.slice(from, to);
}

export function formsOf(html: string): string[] {
  return html.match(/<form\b[^>]*>[\s\S]*?<\/form>/g) ?? [];
}

export function articleOf(html: string, key: string): string {
  const at = html.indexOf(`data-key="${key}"`);
  assert.ok(at >= 0);
  return html.slice(html.lastIndexOf('<article', at), html.indexOf('</article>', at));
}

export function bandOf(html: string, key: string): string {
  const marker = `<aside class="sidebar" data-key="${key}"`;
  const at = html.indexOf(marker);
  assert.ok(at >= 0, marker);
  return html.slice(at, html.indexOf('</aside>', at));
}

export function glineOf(html: string, key: string, name: string): string {
  const band = bandOf(html, key);
  const marker = `data-gate="${name}"`;
  const at = band.indexOf(marker);
  assert.ok(at >= 0, name);
  const form = band.lastIndexOf('<form', at);
  return band.slice(form, band.indexOf('</form>', at) + '</form>'.length);
}

export function spineOf(html: string, key: string, layer: string): string {
  const band = bandOf(html, key);
  const marker = `id="spine-${layer}"`;
  const at = band.indexOf(marker);
  assert.ok(at >= 0, marker);
  const start = band.lastIndexOf('<section', at);
  const next = band.indexOf('class="spine-pick"', at + marker.length);
  return band.slice(start, next === -1 ? band.length : band.lastIndexOf('<section', next));
}

export function stationOf(html: string, key: string, name: string): string {
  const article = articleOf(html, key);
  const marker = `data-station="${name}"`;
  const at = article.indexOf(marker);
  assert.ok(at >= 0, name);
  const next = article.indexOf('data-station="', at + marker.length);
  return article.slice(at, next === -1 ? article.length : next);
}

export function writeQueues(checkout: string, queues: readonly string[]): void {
  const dir = path.join(checkout, 'openspec');
  mkdirSync(dir, {recursive: true});
  writeFileSync(
    path.join(dir, 'config.yaml'),
    ['sdd:', '  queues:', ...queues.map(name => `    - name: ${name}`), ''].join('\n'),
  );
}

export async function post(url: string, pathname: string, body: string) {
  const response = await fetch(new URL(pathname, url), {
    method: 'POST',
    headers: {'content-type': 'application/x-www-form-urlencoded'},
    body,
    redirect: 'manual',
  });
  return {status: response.status, body: await response.text()};
}

export async function pageHtml(url: string): Promise<string> {
  return renderWindow(await readSnapshot(url));
}

export function shown(body: string): string {
  return renderWindow(JSON.parse(body) as WindowSnapshot);
}

export async function paint(response: Response): Promise<string> {
  const body = await response.text();
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('json')) {
    return body;
  }
  const shot = JSON.parse(body) as WindowSnapshot;
  if (shot.opened?.spineReady === false) {
    return renderWindow(await readSnapshot(response.url));
  }
  return renderWindow(shot);
}

export async function readOnce(url: string): Promise<WindowSnapshot> {
  const response = await fetch(new URL('/snapshot', url));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  return response.json() as Promise<WindowSnapshot>;
}

export async function readSnapshot(url: string): Promise<WindowSnapshot> {
  let shot = await readOnce(url);
  for (
    let attempt = 0;
    attempt < 20 && shot.opened && shot.opened.spineReady === false;
    attempt += 1
  ) {
    await new Promise(resolve => setImmediate(resolve));
    shot = await readOnce(url);
  }
  return shot;
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function beginPost(url: string, pathname: string, body: string) {
  const target = new URL(pathname, url);
  const req = httpRequest({
    hostname: target.hostname,
    port: Number(target.port),
    path: target.pathname,
    method: 'POST',
    headers: {'content-type': 'application/x-www-form-urlencoded', connection: 'close'},
  });
  const response = new Promise<{status: number; body: string}>((resolve, reject) => {
    req.on('error', reject);
    req.on('response', res => {
      const chunks: Buffer[] = [];
      res.on('data', chunk => chunks.push(Buffer.from(chunk)));
      res.on('end', () => {
        resolve({status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8')});
      });
    });
  });
  req.flushHeaders();
  req.write(body);
  await delay(80);
  return () => {
    req.end();
    return response;
  };
}

export function boardState(over: Partial<BoardState> = {}): BoardState {
  return {
    visible: true,
    rows: [],
    settingsOpen: false,
    stepsStart: false,
    takeDisabled: false,
    cards: [],
    watch: [],
    pool: [],
    columns: COLUMN_NAMES.map(name => ({name, cards: []})),
    ...over,
  };
}

export function pool(key: string, title = key): PoolCard {
  return {key, title, take: true, queue: 'alpha', choices: []};
}

export function settingsState(open = false): SettingsState {
  const field = {value: '', needsValue: false};
  return {
    open,
    agent: '',
    models: {mechanical: field, judgment: field},
    watch: [],
    roots: {arcadia: '', github: ''},
    roles: [],
  };
}

export function idle() {
  const field = {value: '', needsValue: false};
  return {
    board: () => boardState(),
    take: () => false as boolean | void,
    spy: () => {},
    sidebar: (): SidebarBlock[] => [],
    spine: () => undefined,
    answer: () => undefined,
    acceptReview: () => undefined,
    shelf: () => [] as {name: string; outcome: RoleRecord['outcome']}[],
    settings: () => settingsState(),
    overlay: () => ({
      file: '.aifactory/config.yaml' as const,
      checkout: '',
      agent: '',
      models: {mechanical: field, judgment: {...field}},
      watch: [] as string[],
    }),
    serviceConfig: () => ({
      file: 'openspec/config.yaml' as const,
      checkout: '',
      save: false,
    }),
    openCard: () => false as boolean | void,
    openSettings: () => {},
    closeSettings: () => {},
    chooseAgent: () => {},
    leaveModel: () => {},
    leaveEffort: () => {},
    leaveSpeed: () => {},
    leaveWatch: () => {},
    leaveRoots: () => {},
    addRole: () => {},
    renameRole: () => {},
    chooseRoleOutcome: () => {},
    setRoleText: () => {},
    setRoleLabels: () => {},
    removeRole: () => {},
    drag: () => undefined as {popup?: string; status?: string} | undefined,
    closeCard: () => {},
    checkouts: () => [] as string[],
    spyNote: () => '',
    turn: () => undefined,
    running: () => false,
    openReviewPlace: () => undefined as string | undefined,
    doorPlace: () => undefined as string | undefined,
    gateMark: () => {},
    lastGate: () => false,
    plantQueue: () => false,
    chooseCheckout: () => {},
    chooseOverlayAgent: () => {},
    clearOverlayAgent: () => {},
    leaveOverlayModel: () => {},
    leaveOverlayEffort: () => {},
    leaveOverlaySpeed: () => {},
    leaveOverlayWatch: () => {},
    setServiceBase: () => {},
    setServiceBranchScope: () => {},
    addServiceQueue: () => {},
    setServiceQueue: () => {},
    removeServiceQueue: () => {},
    moveServiceQueue: () => {},
    addServiceIgnore: () => {},
    setServiceIgnore: () => {},
    removeServiceIgnore: () => {},
    chooseServiceHook: () => {},
    setServiceHook: () => {},
    saveServiceConfig: () => {},
    chooseService: () => {},
  };
}

export async function hosted(
  outside: Parameters<typeof openWindow>[1],
  run: (
    page: {url: string; note(): void},
    window: ReturnType<typeof openWindow>,
    paths: {home: string; arcadia: string},
  ) => Promise<void>,
): Promise<void> {
  const {dir, home, arcadia} = yard();
  try {
    prepare(arcadia, home);
    const window = openWindow({homePath: home, adapter: 'tracker'}, outside);
    const page = await serveBoard(window);
    try {
      await run(page, window, {home, arcadia});
    } finally {
      await page.close();
    }
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
}

export function saveControl(html: string): {disabled: boolean; form: string} {
  const form = formsOf(html).find(item => item.includes('value="save-service"'));
  assert.ok(form);
  const button = form.match(/<button\b[^>]*>Записать сервис<\/button>/);
  assert.ok(button);
  return {disabled: /\bdisabled\b/.test(button[0]), form};
}

export function statusOf(html: string): string {
  const match = html.match(/role="status"[^>]*>([^<]*)</);
  assert.ok(match?.[1]);
  return match[1];
}

export function bare(key: string, title: string): WindowTicket {
  return ticket({key, queue: 'alpha', sddService: 'services/billing', title});
}

export function held(key: string, phase: string, over: Partial<WindowTicket> = {}): WindowTicket {
  return ticket({
    key,
    assignee: MANAGER,
    queue: 'alpha',
    sddService: 'services/billing',
    title: key,
    ...over,
    labels: over.labels ?? ['sdd:cycle', `sdd:${phase}`],
  });
}

export function writeChange(arcadia: string, key: string, name: string, body: string): void {
  const file = path.join(arcadia, 'services', 'billing', changeDir(key), name);
  mkdirSync(path.dirname(file), {recursive: true});
  writeFileSync(file, body);
}

export function deltaRequirement(): string {
  return [
    '## ADDED Requirements',
    '',
    '### Requirement: Rows show the section',
    '',
    'The row shows the whole section.',
    '',
    '#### Scenario: The row shows the section',
    '',
    '- **WHEN** the section is long',
    '- **THEN** the row shows it',
    '',
  ].join('\n');
}

export function git(root: string, args: string[]): void {
  execFileSync('git', args, {cwd: root, stdio: 'ignore'});
}
