import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {request as httpRequest} from 'node:http';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {parse, stringify} from 'yaml';
import {requirement, scenario, spec} from '@ojson/spec-coverage';
import {test} from 'vitest';

import {
  COLUMN_NAMES,
  type BoardState,
  type PoolCard,
  type RoleRecord,
  type SettingsState,
  type SidebarBlock,
} from './types.ts';
import {changeDir} from '../machine/naming.ts';
import {openWindow, type WindowTicket} from './window.ts';
import {focusStaysInForm, gesture, payload, SHEET_FIELD_KEY, SHEET_SCROLL_KEY} from './client/gesture.ts';
import {renderWindow} from './client/render.ts';
import {draftsAfterClick, headClickToggles, lineFieldClosesOnEscape, plaqueClickOpens, rowHeadOpens, serveBoard} from './page.ts';
import type {WindowSnapshot} from './snapshot.ts';

const MANAGER = 'ada';

function yard(): {dir: string; home: string; arcadia: string} {
  const dir = mkdtempSync(path.join(tmpdir(), 'ai-factory-page-'));
  const arcadia = path.join(dir, 'arcadia');
  mkdirSync(arcadia, {recursive: true});
  return {dir, home: path.join(dir, 'home.yaml'), arcadia};
}

function prepare(arcadia: string, home: string): void {
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(path.join(checkout, 'openspec'), {recursive: true});
  writeFileSync(
    path.join(checkout, 'openspec', 'config.yaml'),
    'sdd:\n  queues:\n    - name: alpha\n',
  );
  writeFileSync(home, `watch:\n  - alpha\nroots:\n  arcadia: ${arcadia}\n`);
}

function ticket(over: Partial<WindowTicket> & Pick<WindowTicket, 'key'>): WindowTicket {
  return {title: over.key, labels: ['sdd:cycle'], ...over};
}

test('the page shows the pool, the columns, and Take writes the assignee', async () => {
  const {dir, home, arcadia} = yard();
  try {
    prepare(arcadia, home);
    const tickets = [
      ticket({
        key: '1',
        queue: 'alpha',
        sddService: 'services/billing',
        title: 'Take me',
        labels: ['sdd:cycle'],
      }),
    ];
    const assignees: {key: string; login: string}[] = [];
    const phases: {key: string; phase: string}[] = [];
    const window = openWindow(
      {homePath: home, adapter: 'tracker'},
      {
        login: () => MANAGER,
        tickets: () => tickets,
        writeAssignee: (key, login) => {
          assignees.push({key, login});
          const found = tickets.find(item => item.key === key);
          if (found) {
            found.assignee = login;
          }
        },
        writePhase: (key, phase) => {
          phases.push({key, phase});
          const found = tickets.find(item => item.key === key);
          if (found && !found.labels.includes(`sdd:${phase}`)) {
            found.labels = [...found.labels, `sdd:${phase}`];
          }
        },
      },
    );
    window.chooseAgent('cursor');
    const page = await serveBoard(window);
    try {
      const response = await fetch(page.url);
      assert.equal(response.status, 200);
      const html = await pageHtml(page.url);
      assert.equal(html.includes('<h1>'), false);
      assert.match(html, /<span class="key">#1<\/span>/);
      assert.match(html, /Take me/);
      assert.equal(html.includes('github.com'), false);
      for (const name of COLUMN_NAMES) {
        assert.match(html, new RegExp(`<span class="phase">${name}</span>`));
      }
      assert.match(stationOf(html, '1', 'specifying'), /aria-label="Снять гейт specifying"/);
      assert.match(stationOf(html, '1', 'tasking'), /<span class="dot"/);
      assert.equal(stationOf(html, '1', 'specifying').includes('class="plaque"'), false);
      assert.match(html, /<button class="round play" type="submit" aria-label="Взять">/);
      assert.equal(/<button[^>]*>\s*Взять\s*<\/button>/.test(html), false);
      const taken = await fetch(new URL('take', page.url), {
        method: 'POST',
        headers: {'content-type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({key: '1'}).toString(),
        redirect: 'manual',
      });
      assert.equal(taken.status, 200);
      assert.deepEqual(assignees, [{key: '1', login: MANAGER}]);
      assert.deepEqual(phases, [{key: '1', phase: 'proposing'}]);
      const after = await pageHtml(page.url);
      const row = articleOf(after, '1');
      assert.equal(row.includes('aria-label="Взять"'), false);
      assert.match(stationOf(after, '1', 'proposing'), /class="plaque"/);
      assert.match(stationOf(after, '1', 'specifying'), /aria-label="Снять гейт specifying"/);
      assert.match(stationOf(after, '1', 'specifying'), /M8 0\.4/);
    } finally {
      await page.close();
    }
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

test('settings stay closed until opened, and an open card shows the sidebar', async () => {
  const {dir, home, arcadia} = yard();
  try {
    prepare(arcadia, home);
    const window = openWindow(
      {homePath: home, adapter: 'tracker'},
      {
        login: () => MANAGER,
        tickets: () => [
          ticket({
            key: '1',
            queue: 'alpha',
            sddService: 'services/billing',
            title: 'Take me',
            labels: ['sdd:cycle'],
          }),
        ],
      },
    );
    window.chooseAgent('cursor');
    const page = await serveBoard(window);
    try {
      const first = await pageHtml(page.url);
      assert.equal(first.includes('openspec/config.yaml'), false);
      assert.equal(first.includes('class="sidebar"'), false);
      assert.equal(first.includes('role="dialog"'), false);
      const opened = await fetch(new URL('act', page.url), {
        method: 'POST',
        headers: {'content-type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({act: 'open', key: '1'}),
      });
      const withSide = await paint(opened);
      assert.match(withSide, /<aside class="sidebar"/);
      assert.match(withSide, /Take me/);
      const settings = await fetch(new URL('act', page.url), {
        method: 'POST',
        headers: {'content-type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({act: 'open-settings'}),
      });
      const sheet = await paint(settings);
      assert.match(sheet, /\.aifactory\/config\.yaml/);
      assert.match(sheet, /openspec\/config\.yaml/);
    } finally {
      await page.close();
    }
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

function between(html: string, start: string, end: string): string {
  const from = html.indexOf(start);
  const to = html.indexOf(end, from + start.length);
  assert.ok(from >= 0, start);
  assert.ok(to > from, end);
  return html.slice(from, to);
}

function formsOf(html: string): string[] {
  return html.match(/<form\b[^>]*>[\s\S]*?<\/form>/g) ?? [];
}

function articleOf(html: string, key: string): string {
  const at = html.indexOf(`data-key="${key}"`);
  assert.ok(at >= 0);
  return html.slice(html.lastIndexOf('<article', at), html.indexOf('</article>', at));
}

function bandOf(html: string, key: string): string {
  const marker = `<aside class="sidebar" data-key="${key}"`;
  const at = html.indexOf(marker);
  assert.ok(at >= 0, marker);
  return html.slice(at, html.indexOf('</aside>', at));
}

function glineOf(html: string, key: string, name: string): string {
  const band = bandOf(html, key);
  const marker = `data-gate="${name}"`;
  const at = band.indexOf(marker);
  assert.ok(at >= 0, name);
  const form = band.lastIndexOf('<form', at);
  return band.slice(form, band.indexOf('</form>', at) + '</form>'.length);
}

function spineOf(html: string, key: string, layer: string): string {
  const band = bandOf(html, key);
  const marker = `id="spine-${layer}"`;
  const at = band.indexOf(marker);
  assert.ok(at >= 0, marker);
  const start = band.lastIndexOf('<section', at);
  const next = band.indexOf('class="spine-pick"', at + marker.length);
  return band.slice(start, next === -1 ? band.length : band.lastIndexOf('<section', next));
}

function stationOf(html: string, key: string, name: string): string {
  const article = articleOf(html, key);
  const marker = `data-station="${name}"`;
  const at = article.indexOf(marker);
  assert.ok(at >= 0, name);
  const next = article.indexOf('data-station="', at + marker.length);
  return article.slice(at, next === -1 ? article.length : next);
}

function writeQueues(checkout: string, queues: readonly string[]): void {
  const dir = path.join(checkout, 'openspec');
  mkdirSync(dir, {recursive: true});
  writeFileSync(
    path.join(dir, 'config.yaml'),
    ['sdd:', '  queues:', ...queues.map(name => `    - name: ${name}`), ''].join('\n'),
  );
}

async function post(url: string, pathname: string, body: string) {
  const response = await fetch(new URL(pathname, url), {
    method: 'POST',
    headers: {'content-type': 'application/x-www-form-urlencoded'},
    body,
    redirect: 'manual',
  });
  return {status: response.status, body: await response.text()};
}


async function pageHtml(url: string): Promise<string> {
  return renderWindow(await readSnapshot(url));
}

function shown(body: string): string {
  return renderWindow(JSON.parse(body) as WindowSnapshot);
}

async function paint(response: Response): Promise<string> {
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

async function readOnce(url: string): Promise<WindowSnapshot> {
  const response = await fetch(new URL('/snapshot', url));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  return response.json() as Promise<WindowSnapshot>;
}

async function readSnapshot(url: string): Promise<WindowSnapshot> {
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

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function beginPost(url: string, pathname: string, body: string) {
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

function boardState(over: Partial<BoardState> = {}): BoardState {
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

function pool(key: string, title = key): PoolCard {
  return {key, title, take: true, queue: 'alpha', choices: []};
}

function settingsState(open = false): SettingsState {
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

function idle() {
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

async function hosted(
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

test('a GET moves an assigned phaseless card without writing the assignee', async () => {
  const tickets = [
    ticket({
      key: '1',
      queue: 'alpha',
      sddService: 'services/billing',
      assignee: MANAGER,
      title: 'Mine',
      labels: ['sdd:cycle'],
    }),
  ];
  const assignees: string[] = [];
  const phases: {key: string; phase: string}[] = [];
  await hosted(
    {
      login: () => MANAGER,
      tickets: () => tickets,
      writeAssignee: key => {
        assignees.push(key);
      },
      writePhase: (key, phase) => {
        phases.push({key, phase});
        const found = tickets.find(item => item.key === key);
        if (found && !found.labels.includes(`sdd:${phase}`)) {
          found.labels = [...found.labels, `sdd:${phase}`];
        }
      },
    },
    async (page, window) => {
      window.chooseAgent('cursor');
      const response = await fetch(page.url);
      assert.equal(response.status, 200);
      const html = await pageHtml(page.url);
      const row = articleOf(html, '1');
      assert.equal(row.includes('aria-label="Взять"'), false);
      assert.match(stationOf(html, '1', 'proposing'), /class="plaque"/);
      assert.deepEqual(assignees, []);
      assert.deepEqual(phases, [{key: '1', phase: 'proposing'}]);
    },
  );
});

test('a silent agent does not write a phase or start a step', async () => {
  const steps: string[] = [];
  const phases: string[] = [];
  await hosted(
    {
      login: () => MANAGER,
      answers: () => false,
      tickets: () => [
        ticket({
          key: '1',
          queue: 'alpha',
          sddService: 'services/billing',
          assignee: MANAGER,
          labels: ['sdd:cycle'],
        }),
      ],
      startStep: checkout => {
        steps.push(checkout ?? '');
      },
      writePhase: (key, phase) => {
        phases.push(`${key}:${phase}`);
      },
    },
    async (page, window) => {
      window.chooseAgent('cursor');
      const response = await fetch(page.url);
      assert.equal(response.status, 200);
      assert.deepEqual(phases, []);
      assert.deepEqual(steps, []);
    },
  );
});

test('a take that does not write the assignee is 409', async () => {
  const assignees: string[] = [];
  await hosted(
    {
      login: () => MANAGER,
      tickets: () => [
        ticket({
          key: '1',
          queue: 'alpha',
          sddService: 'services/billing',
          openPullRequests: 2,
          labels: ['sdd:cycle'],
        }),
      ],
      writeAssignee: key => {
        assignees.push(key);
      },
    },
    async (page, window) => {
      window.chooseAgent('cursor');
      const taken = await post(page.url, 'take', new URLSearchParams({key: '1'}).toString());
      assert.equal(taken.status, 409);
      assert.ok(taken.body.length > 0);
      const empty = await post(page.url, 'take', '');
      assert.equal(empty.status, 409);
      assert.ok(empty.body.length > 0);
      assert.deepEqual(assignees, []);
    },
  );
  await hosted(
    {
      tickets: () => [
        ticket({key: '1', queue: 'alpha', sddService: 'services/billing', labels: ['sdd:cycle']}),
      ],
      writeAssignee: key => {
        assignees.push(key);
      },
    },
    async (page, window) => {
      window.chooseAgent('cursor');
      const taken = await post(page.url, 'take', new URLSearchParams({key: '1'}).toString());
      assert.equal(taken.status, 409);
      assert.ok(taken.body.length > 0);
    },
  );
  await hosted(
    {
      login: () => MANAGER,
      answers: () => false,
      tickets: () => [
        ticket({key: '1', queue: 'alpha', sddService: 'services/billing', labels: ['sdd:cycle']}),
      ],
      writeAssignee: key => {
        assignees.push(key);
      },
    },
    async (page, window) => {
      window.chooseAgent('cursor');
      const taken = await post(page.url, 'take', new URLSearchParams({key: '1'}).toString());
      assert.equal(taken.status, 409);
      assert.ok(taken.body.length > 0);
      assert.deepEqual(assignees, []);
    },
  );
});

test('an unknown act is 400 and does not call the surface', async () => {
  const calls: string[] = [];
  const surface = idle();
  surface.openCard = () => {
    calls.push('open');
    return true;
  };
  surface.chooseAgent = () => {
    calls.push('agent');
  };
  surface.drag = () => {
    calls.push('drag');
    return undefined;
  };
  surface.saveServiceConfig = () => {
    calls.push('save');
  };
  const page = await serveBoard(surface);
  try {
    const response = await post(page.url, 'act', new URLSearchParams({act: 'nope'}).toString());
    assert.equal(response.status, 400);
    assert.ok(response.body.length > 0);
    assert.deepEqual(calls, []);
  } finally {
    await page.close();
  }
});

async function proveAnUnnamedServiceIsAField(): Promise<void> {
  const dir = mkdtempSync(path.join(tmpdir(), 'ai-factory-page-'));
  const github = path.join(dir, 'github');
  const home = path.join(dir, 'home.yaml');
  const repo = path.join(github, 'acme', 'many');
  try {
    mkdirSync(path.join(repo, 'services', 'api'), {recursive: true});
    writeQueues(repo, ['alpha']);
    writeQueues(path.join(repo, 'services', 'api'), ['alpha']);
    writeFileSync(home, `watch:\n  - acme/many\nroots:\n  github: ${github}\n`);
    const tickets = [
      ticket({key: '2', repo: 'acme/many', title: 'Root', labels: ['alpha', 'sdd:cycle']}),
    ];
    const writes: {key: string; service: string}[] = [];
    const window = openWindow(
      {homePath: home, adapter: 'github'},
      {
        tickets: () => tickets,
        writeService: (key, service) => {
          writes.push({key, service});
          const found = tickets.find(item => item.key === key);
          if (found) {
            found.sddService = service;
          }
        },
      },
    );
    const page = await serveBoard(window);
    try {
      const first = await pageHtml(page.url);
      assert.match(articleOf(first, '2'), /aria-label="Поломка"/);
      assert.equal(first.includes('<select'), false);
      assert.equal(first.includes('role="dialog"'), false);
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'repair', key: '2'}).toString()))
          .status,
        200,
      );
      const popup = await pageHtml(page.url);
      const dialog = between(popup, '<div class="popup repair"', '</div></div>');
      assert.match(dialog, /aria-label="Поломка"/);
      assert.equal(popup.includes('role="dialog" aria-label="Настройки"'), false);
      assert.match(dialog, /<option disabled(?:="")?>—<\/option>/);
      assert.equal(/<option disabled(?:="")? value=/.test(dialog), false);
      assert.match(dialog, /<option value="" selected="">/);
      assert.match(dialog, /<option value="services\/api">/);
      assert.equal(articleOf(popup, '2').includes('<select'), false);
      const missing = await post(
        page.url,
        'act',
        new URLSearchParams({act: 'choose-service', key: '2'}).toString(),
      );
      assert.equal(missing.status, 409);
      assert.ok(missing.body.length > 0);
      assert.deepEqual(writes, []);
      const root = await post(
        page.url,
        'act',
        new URLSearchParams({act: 'choose-service', key: '2', service: ''}).toString(),
      );
      assert.equal(root.status, 200);
      assert.deepEqual(writes, [{key: '2', service: ''}]);
      const cleared = await pageHtml(page.url);
      assert.equal(cleared.includes('<select'), false);
      assert.equal(cleared.includes('role="dialog"'), false);
      const nested = await post(
        page.url,
        'act',
        new URLSearchParams({act: 'choose-service', key: '2', service: 'services/api'}).toString(),
      );
      assert.equal(nested.status, 200);
      assert.deepEqual(writes, [
        {key: '2', service: ''},
        {key: '2', service: 'services/api'},
      ]);
    } finally {
      await page.close();
    }
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
}

test('a body over 262144 bytes is refused and an exact body still applies', async () => {
  const texts: string[] = [];
  let takes = 0;
  const surface = idle();
  surface.setRoleText = (_name, text) => {
    texts.push(text);
  };
  surface.take = () => {
    takes += 1;
    return true;
  };
  const page = await serveBoard(surface);
  try {
    const prefix = 'act=set-role-text&name=editor&text=';
    const exact = prefix + 'a'.repeat(262144 - Buffer.byteLength(prefix));
    assert.equal(Buffer.byteLength(exact), 262144);
    const applied = await post(page.url, 'act', exact);
    assert.equal(applied.status, 200);
    assert.deepEqual(texts, ['a'.repeat(262144 - Buffer.byteLength(prefix))]);
    const refused = await post(page.url, 'act', `${exact}a`);
    assert.equal(refused.status, 413);
    assert.ok(refused.body.length > 0);
    assert.equal(texts.length, 1);
    const takePrefix = 'key=1&x=';
    const takeOver = takePrefix + 'b'.repeat(262145 - Buffer.byteLength(takePrefix));
    const takeRefused = await post(page.url, 'take', takeOver);
    assert.equal(takeRefused.status, 413);
    assert.ok(takeRefused.body.length > 0);
    assert.equal(takes, 0);
  } finally {
    await page.close();
  }
});

test('a hook newline stays inside one string', async () => {
  const seen: {action: string; point: string; values: string[]}[] = [];
  await hosted(
    {
      login: () => MANAGER,
      tickets: () => [
        ticket({
          key: '1',
          queue: 'alpha',
          sddService: 'services/billing',
          assignee: MANAGER,
          labels: ['sdd:cycle', 'sdd:implementing'],
        }),
      ],
    },
    async (page, window, paths) => {
      const file = path.join(paths.arcadia, 'services', 'billing', 'openspec', 'config.yaml');
      writeFileSync(
        file,
        stringify({
          sdd: {
            queues: [{name: 'alpha'}],
            hooks: {specify: {before: ['line1\nline2'], after: ['alpha', 'beta']}},
          },
        }),
      );
      const real = window.setServiceHook;
      window.setServiceHook = (action, point, values) => {
        seen.push({action, point, values: [...values]});
        real(action, point, values);
      };
      window.openCard('1');
      window.openSettings();
      const html = await pageHtml(page.url);
      const areas = [...html.matchAll(/<textarea name="values"[^>]*>([\s\S]*?)<\/textarea>/g)].map(
        match => match[1],
      );
      assert.deepEqual(areas, ['line1\nline2', 'alpha', 'beta']);
      const pair = new URLSearchParams();
      pair.set('act', 'set-service-hook');
      pair.set('hook-action', 'specify');
      pair.set('point', 'before');
      pair.append('values', 'one');
      pair.append('values', 'two');
      assert.equal((await post(page.url, 'act', pair.toString())).status, 200);
      assert.deepEqual(seen.at(-1), {action: 'specify', point: 'before', values: ['one', 'two']});
      const indented = new URLSearchParams();
      indented.set('act', 'set-service-hook');
      indented.set('hook-action', 'specify');
      indented.set('point', 'after');
      indented.set('values', '  indented');
      assert.equal((await post(page.url, 'act', indented.toString())).status, 200);
      assert.deepEqual(seen.at(-1)?.values, ['  indented']);
      const kept = new URLSearchParams();
      kept.set('act', 'set-service-hook');
      kept.set('hook-action', 'specify');
      kept.set('point', 'after');
      kept.set('values', 'keep\n\nrest');
      assert.equal((await post(page.url, 'act', kept.toString())).status, 200);
      assert.deepEqual(seen.at(-1)?.values, ['keep\n\nrest']);
      const edited = new URLSearchParams();
      edited.set('act', 'set-service-hook');
      edited.set('hook-action', 'specify');
      edited.set('point', 'before');
      edited.set('values', 'line1\nline2 tail');
      assert.equal((await post(page.url, 'act', edited.toString())).status, 200);
      assert.deepEqual(seen.at(-1)?.values, ['line1\nline2 tail']);
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'save-service'}).toString())).status,
        200,
      );
      const doc = parse(readFileSync(file, 'utf8')) as {
        sdd: {hooks: {specify: {before: string[]; after: string[]}}};
      };
      assert.deepEqual(doc.sdd.hooks.specify.before, ['line1\nline2 tail']);
      assert.deepEqual(doc.sdd.hooks.specify.after, ['keep\n\nrest']);
    },
  );
});

test('a neighbor submit keeps the role draft and the hook draft', async () => {
  const agents: string[] = [];
  const roles: RoleRecord[] = [];
  const queues: string[] = [];
  const hooks: string[] = [];
  await hosted(
    {
      login: () => MANAGER,
      tickets: () => [
        ticket({key: '1', queue: 'alpha', sddService: 'services/billing', labels: ['sdd:cycle']}),
      ],
    },
    async (page, window) => {
      const choose = window.chooseAgent;
      window.chooseAgent = agent => {
        agents.push(agent);
        choose(agent);
      };
      const add = window.addRole;
      window.addRole = role => {
        roles.push({...role});
        add(role);
      };
      const setQueue = window.setServiceQueue;
      window.setServiceQueue = (index, name, description) => {
        queues.push(`${index}:${name}:${description}`);
        setQueue(index, name, description);
      };
      const chooseHook = window.chooseServiceHook;
      window.chooseServiceHook = (action, point, first) => {
        hooks.push(`${action}:${point}:${first}`);
        chooseHook(action, point, first);
      };
      const opened = await fetch(new URL('act', page.url), {
        method: 'POST',
        headers: {'content-type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({act: 'open-settings'}).toString(),
      });
      assert.equal(opened.status, 200);
      const sheet = await paint(opened);
      const addForm = formsOf(sheet).find(form => form.includes('class="add"'));
      assert.ok(addForm);
      assert.match(addForm, /name="name"/);
      assert.match(addForm, /name="outcome"/);
      assert.match(addForm, /name="text"/);
      assert.ok(formsOf(sheet).some(form => form.includes('name="first"')));
      const empty = await post(
        page.url,
        'act',
        new URLSearchParams({
          act: 'choose-agent',
          agent: 'cursor',
          name: '',
          outcome: 'html',
          text: 'черновик',
        }).toString(),
      );
      assert.equal(empty.status, 200);
      assert.deepEqual(agents, ['cursor']);
      assert.deepEqual(roles, []);
      const drafted = await post(
        page.url,
        'act',
        new URLSearchParams({
          act: 'choose-agent',
          agent: 'cursor',
          name: 'editor',
          outcome: 'html',
          text: 'черновик',
        }).toString(),
      );
      assert.equal(drafted.status, 200);
      assert.deepEqual(roles, [{name: 'editor', outcome: 'html', text: 'черновик'}]);
      assert.match(await pageHtml(page.url), /черновик/);
      const blank = await post(
        page.url,
        'act',
        new URLSearchParams({
          act: 'set-service-queue',
          index: '0',
          name: 'alpha',
          description: '',
          first: '',
        }).toString(),
      );
      assert.equal(blank.status, 200);
      assert.deepEqual(hooks, []);
      assert.deepEqual(queues, ['0:alpha:']);
      const hooked = await post(
        page.url,
        'act',
        new URLSearchParams({
          act: 'set-service-queue',
          index: '0',
          name: 'alpha',
          description: '',
          first: 'абзац',
          choice: 'archive\tbefore',
        }).toString(),
      );
      assert.equal(hooked.status, 200);
      assert.deepEqual(queues, ['0:alpha:', '0:alpha:']);
      assert.deepEqual(hooks, ['archive:before:абзац']);
    },
  );
});

test('a thrown take or board is a non-empty 500', async () => {
  const brokenTake = idle();
  brokenTake.take = () => {
    throw new Error('take broke');
  };
  const takePage = await serveBoard(brokenTake);
  try {
    const taken = await post(takePage.url, 'take', new URLSearchParams({key: '1'}).toString());
    assert.equal(taken.status, 500);
    assert.ok(taken.body.length > 0);
  } finally {
    await takePage.close();
  }
  const brokenBoard = idle();
  brokenBoard.board = () => {
    throw new Error('board broke');
  };
  const boardPage = await serveBoard(brokenBoard);
  try {
    const response = await fetch(new URL('/snapshot', boardPage.url));
    const body = await response.text();
    assert.equal(response.status, 500);
    assert.ok(body.length > 0);
  } finally {
    await boardPage.close();
  }
});

test('the drag payload falls back to text/plain', () => {
  assert.deepEqual(
    payload({
      dataTransfer: {
        getData(type: string) {
          if (type === 'application/x-ai-factory') {
            return '';
          }
          if (type === 'text/plain') {
            return 'pool\n1';
          }
          return '';
        },
      },
    }),
    ['pool', '1'],
  );
  assert.equal(gesture('pool', '1', 'station'), 'take');
  assert.equal(gesture('pool', '1', 'card'), '');
  assert.deepEqual(
    payload({
      dataTransfer: {
        getData(type: string) {
          if (type === 'application/x-ai-factory') {
            return 'role\neditor';
          }
          return 'pool\n9';
        },
      },
    }),
    ['role', 'editor'],
  );
  assert.equal(gesture('role', 'editor', 'card'), '');
  assert.deepEqual(payload({dataTransfer: {getData: () => ''}}), ['', '']);
  assert.deepEqual(payload({dataTransfer: null}), ['', '']);
  assert.equal(gesture('', '', 'card'), '');
  assert.equal(gesture('', '', 'station'), '');
});

test('an unnamed pool card opens into the sidebar and a disabled card is not draggable', async () => {
  const tickets = [
    ticket({key: '1', queue: 'alpha', sddService: 'services/billing', title: 'Healthy'}),
    ticket({key: '2', queue: 'alpha', sddService: 'services/other', title: 'Other'}),
    ticket({key: '3', queue: 'alpha', title: 'Bare'}),
  ];
  await hosted({login: () => MANAGER, tickets: () => tickets}, async (page, window, paths) => {
    window.chooseAgent('cursor');
    writeQueues(path.join(paths.arcadia, 'services', 'other'), ['alpha']);
    const first = await pageHtml(page.url);
    assert.equal(articleOf(first, '1').includes('draggable="true"'), true);
    assert.equal(articleOf(first, '3').includes('draggable="true"'), false);
    assert.equal(first.includes('class="band"'), false);
    const opened = await post(
      page.url,
      'act',
      new URLSearchParams({act: 'open', key: '3'}).toString(),
    );
    assert.equal(opened.status, 200);
    const html = await pageHtml(page.url);
    assert.match(bandOf(html, '3'), /не назван сервис/);
    assert.equal(articleOf(html, '3').includes('<select'), false);
  });
});

test('a fake open that leaves the sidebar empty does not render it', async () => {
  const calls: string[] = [];
  const surface = idle();
  surface.board = () => boardState({pool: [pool('1', 'Bare')]});
  surface.openCard = key => {
    calls.push(key);
  };
  surface.sidebar = () => [];
  const page = await serveBoard(surface);
  try {
    const opened = await post(
      page.url,
      'act',
      new URLSearchParams({act: 'open', key: '1'}).toString(),
    );
    assert.equal(opened.status, 200);
    assert.deepEqual(calls, ['1']);
    const html = await pageHtml(page.url);
    assert.equal(html.includes('class="sidebar"'), false);
    assert.equal(html.includes('class="band"'), false);
  } finally {
    await page.close();
  }
});

test('a drag without a popup leaves the one on screen', async () => {
  const calls: string[] = [];
  let next: {popup: string} | undefined = {popup: 'SECRET'};
  const surface = idle();
  surface.drag = (name, key) => {
    calls.push(`${name}:${key}`);
    const result = next;
    next = undefined;
    return result;
  };
  const page = await serveBoard(surface);
  try {
    assert.equal(
      (
        await post(
          page.url,
          'act',
          new URLSearchParams({act: 'drag', name: 'html-role', key: '1'}).toString(),
        )
      ).status,
      200,
    );
    const shown = await pageHtml(page.url);
    assert.match(shown, /class="popup"/);
    assert.match(shown, /SECRET/);
    assert.equal(
      (
        await post(
          page.url,
          'act',
          new URLSearchParams({act: 'drag', name: 'missing', key: '1'}).toString(),
        )
      ).status,
      200,
    );
    assert.deepEqual(calls, ['html-role:1', 'missing:1']);
    assert.match(await pageHtml(page.url), /SECRET/);
    assert.equal(
      (await post(page.url, 'act', new URLSearchParams({act: 'close-popup'}).toString())).status,
      200,
    );
    assert.equal((await pageHtml(page.url)).includes('SECRET'), false);
  } finally {
    await page.close();
  }
});

test('a GET does not invalidate a stalled post', async () => {
  const calls: string[] = [];
  const surface = idle();
  surface.board = () => boardState({pool: [pool('AAA')]});
  surface.openCard = key => {
    calls.push(key);
    return true;
  };
  const page = await serveBoard(surface);
  let finish: (() => Promise<{status: number; body: string}>) | undefined;
  try {
    finish = await beginPost(page.url, 'act', 'act=open&key=AAA');
    assert.equal((await fetch(page.url)).status, 200);
    const late = await finish();
    finish = undefined;
    assert.equal(late.status, 200);
    assert.deepEqual(calls, ['AAA']);
  } finally {
    if (finish) {
      await finish().catch(() => undefined);
    }
    await page.close();
  }
});

test('a stalled open cannot overwrite a newer dialog', async () => {
  const calls: string[] = [];
  const surface = idle();
  surface.board = () => boardState({pool: [pool('AAA'), pool('BBB')]});
  surface.openCard = key => {
    calls.push(key);
    return true;
  };
  surface.sidebar = () => [{kind: 'reason', line: calls.at(-1) ?? ''}];
  const page = await serveBoard(surface);
  let finish: (() => Promise<{status: number; body: string}>) | undefined;
  try {
    finish = await beginPost(page.url, 'act', 'act=open&key=AAA');
    const newer = await post(page.url, 'act', 'act=open&key=BBB');
    assert.equal(newer.status, 200);
    assert.deepEqual(calls, ['BBB']);
    const late = await finish();
    finish = undefined;
    assert.equal(late.status, 409);
    assert.ok(late.body.length > 0);
    assert.deepEqual(calls, ['BBB']);
    const band = bandOf(await pageHtml(page.url), 'BBB');
    assert.match(band, /<span class="key">#BBB<\/span>/);
    assert.match(band, /: BBB/);
    assert.equal(band.includes('AAA'), false);
  } finally {
    if (finish) {
      await finish().catch(() => undefined);
    }
    await page.close();
  }
});

test('a stalled close does not clear a popup a newer drag set', async () => {
  const surface = idle();
  surface.drag = () => ({popup: 'FINISHED'});
  const page = await serveBoard(surface);
  let finish: (() => Promise<{status: number; body: string}>) | undefined;
  try {
    finish = await beginPost(page.url, 'act', 'act=close-popup');
    assert.equal(
      (
        await post(
          page.url,
          'act',
          new URLSearchParams({act: 'drag', name: 'html-role', key: '1'}).toString(),
        )
      ).status,
      200,
    );
    const late = await finish();
    finish = undefined;
    assert.equal(late.status, 409);
    assert.ok(late.body.length > 0);
    const html = await pageHtml(page.url);
    assert.match(html, /FINISHED/);
    assert.match(html, /class="popup"/);
  } finally {
    if (finish) {
      await finish().catch(() => undefined);
    }
    await page.close();
  }
});

test('a stalled answer cannot overwrite a newer act', async () => {
  let release: ((status: string | undefined) => void) | undefined;
  let started = false;
  const surface = idle();
  surface.answer = () =>
    new Promise(resolve => {
      started = true;
      release = resolve;
    });
  surface.drag = () => ({status: 'НОВОЕ'});
  const page = await serveBoard(surface);
  const pending = post(
    page.url,
    'act',
    new URLSearchParams({act: 'answer', key: 'AAA', reply: 'ответ'}).toString(),
  );
  try {
    while (!started) {
      await delay(5);
    }
    const newer = await post(
      page.url,
      'act',
      new URLSearchParams({act: 'drag', name: 'Note', key: 'BBB'}).toString(),
    );
    assert.equal(newer.status, 200);
    const published = JSON.parse(newer.body) as WindowSnapshot;
    assert.equal(published.status, 'НОВОЕ');
    assert.equal(published.show, 'BBB');
    const kept = await readSnapshot(page.url);
    assert.equal(kept.generation, published.generation);
    assert.equal(kept.show, 'BBB');
    const finish = release;
    release = undefined;
    finish?.('СТАРОЕ');
    const late = await pending;
    assert.equal(late.status, 409);
    assert.equal(late.body, 'устарело');
    assert.deepEqual(await readSnapshot(page.url), kept);
  } finally {
    release?.('СТАРОЕ');
    await pending.catch(() => undefined);
    await page.close();
  }
});

test('a stalled answer does not lend its card to an act that leaves show', async () => {
  let release: ((status: string | undefined) => void) | undefined;
  let started = false;
  const surface = idle();
  surface.answer = () =>
    new Promise(resolve => {
      started = true;
      release = resolve;
    });
  surface.drag = () => ({status: 'ДЕРЖИТ'});
  const page = await serveBoard(surface);
  let pending: Promise<{status: number; body: string}> | undefined;
  try {
    const prior = await post(
      page.url,
      'act',
      new URLSearchParams({act: 'drag', name: 'Note', key: 'CCC'}).toString(),
    );
    assert.equal(prior.status, 200);
    assert.equal((JSON.parse(prior.body) as WindowSnapshot).show, 'CCC');
    pending = post(
      page.url,
      'act',
      new URLSearchParams({act: 'answer', key: 'AAA', reply: 'ответ'}).toString(),
    );
    while (!started) {
      await delay(5);
    }
    const newer = await post(page.url, 'act', new URLSearchParams({act: 'close-popup'}).toString());
    assert.equal(newer.status, 200);
    const published = JSON.parse(newer.body) as WindowSnapshot;
    assert.equal(published.show, 'CCC');
    const kept = await readSnapshot(page.url);
    assert.equal(kept.show, 'CCC');
    const finish = release;
    release = undefined;
    finish?.('СТАРОЕ');
    const late = await pending;
    assert.equal(late.status, 409);
    assert.equal(late.body, 'устарело');
    assert.equal((await readSnapshot(page.url)).show, 'CCC');
  } finally {
    release?.('СТАРОЕ');
    await pending?.catch(() => undefined);
    await page.close();
  }
});

test('the last queue down button is disabled and moving past the end is 409', async () => {
  let moves = 0;
  await hosted(
    {
      login: () => MANAGER,
      tickets: () => [
        ticket({key: '1', queue: 'alpha', sddService: 'services/billing', labels: ['sdd:cycle']}),
      ],
    },
    async (page, window) => {
      const real = window.moveServiceQueue;
      window.moveServiceQueue = (from, to) => {
        moves += 1;
        real(from, to);
      };
      const opened = await fetch(new URL('act', page.url), {
        method: 'POST',
        headers: {'content-type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({act: 'open-settings'}).toString(),
      });
      const sheet = await paint(opened);
      assert.match(sheet, /form="down-0"[^>]*disabled[^>]*>↓<\/button>/);
      const moved = await post(
        page.url,
        'act',
        new URLSearchParams({act: 'move-service-queue', from: '0', to: '1'}).toString(),
      );
      assert.equal(moved.status, 409);
      assert.ok(moved.body.length > 0);
      assert.equal(moves, 0);
      assert.match(await pageHtml(page.url), /value="alpha"/);
    },
  );
});

function saveControl(html: string): {disabled: boolean; form: string} {
  const form = formsOf(html).find(item => item.includes('value="save-service"'));
  assert.ok(form);
  const button = form.match(/<button\b[^>]*>Записать сервис<\/button>/);
  assert.ok(button);
  return {disabled: /\bdisabled\b/.test(button[0]), form};
}

function statusOf(html: string): string {
  const match = html.match(/role="status"[^>]*>([^<]*)</);
  assert.ok(match?.[1]);
  return match[1];
}

test('the open row replaces the rail and the lanes share the stage', async () => {
  const page = await serveBoard(idle());
  try {
    const html = await pageHtml(page.url);
    assert.equal(html.includes('class="rail"'), false);
    assert.equal(html.includes('class="shelf"'), false);
    assert.equal(html.includes('class="sidebar"'), false);
    assert.equal(html.includes('flex: 0 0 300px'), false);
    assert.match(
      html,
      /\.stations\s*\{[^}]*grid-template-columns:\s*252px repeat\(7, minmax\(0, 1fr\)\)/,
    );
    assert.match(html, /\.phase\s*\{[^}]*ellipsis[^}]*nowrap[^}]*font-size:\s*10px/);
    assert.match(html, /\.gutter\.pool \.key\s*\{[^}]*var\(--muted\)/);
    assert.match(html, /\.key\s*\{[^}]*var\(--brass\)/);
    assert.match(html, /\.ticket\.is-open \.gutter\s*\{[^}]*inset/);
    assert.match(html, /\.station\.over\s*\{[^}]*inset[^}]*var\(--brass\)/);
    assert.match(html, /\.sidebar\s*\{[^}]*position:\s*fixed[^}]*right:\s*0/);
    const boardRule = html.match(/\.board\s*\{[^}]*\}/)?.[0] ?? '';
    assert.match(boardRule, /overflow-x:\s*hidden/);
  } finally {
    await page.close();
  }
});

test('an open card is marked, the face holds the phase, and close clears the row', async () => {
  const closed: string[] = [];
  const surface = idle();
  surface.board = () =>
    boardState({
      pool: [
        {
          key: '3',
          title: 'Bare',
          take: true,
          icon: true,
          reason: 'не назван сервис',
          alarm: true,
          takeDisabled: true,
          queue: 'alpha',
          choices: [],
        },
      ],
      columns: COLUMN_NAMES.map(name => ({
        name,
        cards:
          name === 'accepting'
            ? [{key: '9', title: 'Ждёт', icon: true, reason: 'мерж', phaseRow: {done: 12, open: 2}}]
            : [],
      })),
    });
  surface.openCard = () => true;
  surface.sidebar = () => [{kind: 'reason', line: 'мерж'}];
  surface.closeCard = () => {
    closed.push('close');
  };
  const page = await serveBoard(surface);
  try {
    const early = await post(
      page.url,
      'act',
      new URLSearchParams({act: 'close-card', key: 'missing'}).toString(),
    );
    assert.equal(early.status, 200);
    const quiet = await pageHtml(page.url);
    assert.equal(quiet.includes('class="sidebar"'), false);
    assert.equal(quiet.includes('class="band"'), false);
    const opened = await fetch(new URL('act', page.url), {
      method: 'POST',
      headers: {'content-type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({act: 'open', key: '9'}).toString(),
    });
    const html = await paint(opened);
    const article = articleOf(html, '9');
    assert.match(article, /class="ticket is-open"/);
    const plaqueStart = article.indexOf('<button class="plaque"');
    const plaqueEnd = article.indexOf('</button>', plaqueStart);
    const plaque = article.slice(plaqueStart, plaqueEnd);
    const faceStart = article.indexOf('<button class="face"');
    const faceEnd = article.indexOf('</button>', faceStart);
    const face = article.slice(faceStart, faceEnd);
    assert.match(plaque, /class="stat"/);
    assert.match(plaque, /12 сделано · 2 открыто/);
    assert.equal(plaque.includes('мерж'), false);
    assert.equal(face.includes('12 сделано'), false);
    assert.equal(face.includes('мерж'), false);
    const poolFace = articleOf(html, '3');
    assert.match(poolFace, /aria-label="Поломка"/);
    assert.equal(poolFace.includes('не назван сервис'), false);
    const side = bandOf(html, '9');
    assert.match(side, /data-key="9"/);
    assert.match(side, /name="act" value="close-card"/);
    assert.match(side, /мерж/);
    assert.equal(html.includes('class="rail"'), false);
    assert.equal(html.includes('class="shelf"'), false);
    assert.match(html, /<aside class="sidebar" data-key="9"/);
    const before = closed.length;
    const gone = await post(page.url, 'act', new URLSearchParams({act: 'close-card'}).toString());
    assert.equal(gone.status, 200);
    assert.equal(closed.length, before + 1);
    const cleared = await pageHtml(page.url);
    assert.equal(cleared.includes('class="sidebar"'), false);
    assert.equal(cleared.includes('class="band"'), false);
    const again = await post(
      page.url,
      'act',
      new URLSearchParams({act: 'close-card', key: '9'}).toString(),
    );
    assert.equal(again.status, 200);
  } finally {
    await page.close();
  }
});

test('a get names the card the script should scroll into the lane', async () => {
  const surface = idle();
  surface.board = () => boardState({pool: [pool('7'), pool('8')]});
  surface.take = () => true;
  surface.openCard = () => true;
  surface.sidebar = () => [{kind: 'reason', line: '8'}];
  surface.drag = () => undefined;
  const page = await serveBoard(surface);
  try {
    assert.equal(
      (await post(page.url, 'take', new URLSearchParams({key: '7'}).toString())).status,
      200,
    );
    assert.match(await pageHtml(page.url), /<body[^>]*data-show="7"/);
    assert.equal(
      (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '8'}).toString())).status,
      200,
    );
    assert.match(await pageHtml(page.url), /<body[^>]*data-show="8"/);
    assert.equal(
      (
        await post(
          page.url,
          'act',
          new URLSearchParams({act: 'drag', name: 'Gates', key: '8'}).toString(),
        )
      ).status,
      200,
    );
    assert.match(await pageHtml(page.url), /<body[^>]*data-show="8"/);
  } finally {
    await page.close();
  }
});

test('a role drop reports ticket-fields and a skipped pull comment', async () => {
  const labels: string[] = [];
  const comments: string[] = [];
  await hosted(
    {
      login: () => MANAGER,
      tickets: () => [
        ticket({
          key: '4',
          queue: 'alpha',
          sddService: 'services/billing',
          assignee: MANAGER,
          title: 'Board',
          labels: ['sdd:cycle', 'sdd:implementing'],
          openPullRequests: 0,
        }),
        ticket({
          key: '5',
          queue: 'alpha',
          sddService: 'services/billing',
          assignee: MANAGER,
          title: 'Several',
          labels: ['sdd:cycle', 'sdd:implementing'],
          openPullRequests: 2,
        }),
      ],
      editLabels: (_key, add) => {
        labels.push(...add);
      },
      commentPull: () => {
        comments.push('called');
      },
    },
    async (page, window) => {
      window.addRole({
        name: 'Gates',
        outcome: 'ticket-fields',
        text: 'note',
        labels: ['sdd:auto-plan'],
      });
      window.addRole({name: 'Note', outcome: 'pull-comment', text: 'ship it'});
      window.addRole({name: 'Page', outcome: 'html', text: '<p>hi</p>'});
      window.addRole({name: 'File', outcome: 'cycle-file', text: 'notes.md'});
      const opened = await fetch(new URL('act', page.url), {
        method: 'POST',
        headers: {'content-type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({act: 'open', key: '4'}).toString(),
      });
      const side = await paint(opened);
      const verb = bandOf(side, '4');
      assert.match(verb, /<button class="verb"/);
      assert.match(verb, /Gates[\s\S]*ticket-fields/);
      assert.match(verb, /Note[\s\S]*pull-comment/);
      assert.match(verb, /Page[\s\S]*html/);
      assert.match(verb, /File[\s\S]*cycle-file/);
      assert.equal(/<button class="verb"[^>]*disabled/.test(verb), false);
      assert.equal(articleOf(side, '5').includes('class="verb"'), false);
      assert.equal(side.includes('aside.sidebar'), false);
      assert.match(side, /\.station\.over\s*\{[^}]*inset[^}]*var\(--brass\)/);
      assert.equal(gesture('role', 'Gates', 'card'), '');
      const dragged = await post(
        page.url,
        'act',
        new URLSearchParams({act: 'drag', name: 'Gates', key: '4'}).toString(),
      );
      assert.equal(dragged.status, 200);
      const wrote = shown(dragged.body);
      const written = statusOf(wrote);
      assert.match(written, /Gates/);
      assert.match(written, /\b4\b/);
      assert.ok(labels.includes('sdd:auto-plan'));
      const missingFile = await post(
        page.url,
        'act',
        new URLSearchParams({act: 'drag', name: 'File', key: '4'}).toString(),
      );
      assert.equal(missingFile.status, 200);
      assert.match(shown(missingFile.body), /файла нет/);
      assert.equal(
        (
          await post(
            page.url,
            'act',
            new URLSearchParams({act: 'drag', name: 'Page', key: '4'}).toString(),
          )
        ).status,
        200,
      );
      assert.match(await pageHtml(page.url), /class="popup"/);
      const skippedDrop = await post(
        page.url,
        'act',
        new URLSearchParams({act: 'drag', name: 'Note', key: '4'}).toString(),
      );
      assert.equal(skippedDrop.status, 200);
      const skipped = shown(skippedDrop.body);
      assert.match(statusOf(skipped), /комментарий не записан/);
      assert.equal((await pageHtml(page.url)).includes('role="status"'), false);
      assert.match(skipped, /class="popup"/);
      assert.match(skipped, /hi/);
      const quietDrop = await post(
        page.url,
        'act',
        new URLSearchParams({act: 'drag', name: 'Note', key: '5'}).toString(),
      );
      assert.equal(quietDrop.status, 200);
      assert.match(statusOf(shown(quietDrop.body)), /комментарий не записан/);
      assert.deepEqual(comments, []);
      assert.equal(
        (
          await post(
            page.url,
            'act',
            new URLSearchParams({act: 'drag', name: 'missing', key: '4'}).toString(),
          )
        ).status,
        200,
      );
      const kept = await pageHtml(page.url);
      assert.match(kept, /class="popup"/);
      assert.match(kept, /hi/);
    },
  );
}, 20_000);

test('a code place in focus opens the review url', async () => {
  const calls: {file: string; line: number}[] = [];
  await hosted(
    {
      login: () => MANAGER,
      tickets: () => [
        ticket({
          key: '1',
          queue: 'alpha',
          sddService: 'services/billing',
          title: 'Focus',
          labels: ['sdd:cycle', 'sdd:accepting'],
          assignee: MANAGER,
          comments: [{body: 'sdd:focus\nCode src/a.ts:4\nCode solid\nsee src/b.ts:9\n'}],
        }),
      ],
      reviewPlace: place => {
        calls.push(place);
        if (place.file === 'src/a.ts' && place.line === 4) {
          return 'https://arcanum.example/review/42';
        }
        return 'https://arcanum.example/other';
      },
    },
    async (page, window) => {
      const opened = await fetch(new URL('act', page.url), {
        method: 'POST',
        headers: {'content-type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({act: 'open', key: '1'}).toString(),
      });
      const html = await paint(opened);
      const focus = bandOf(html, '1');
      assert.match(focus, /<a href="https:\/\/arcanum\.example\/review\/42">src\/a\.ts:4<\/a>/);
      assert.equal(focus.includes('Code solid'), false);
      assert.match(focus, /src\/b\.ts:9/);
      assert.equal(focus.includes('https://arcanum.example/other'), false);
      assert.equal(/<a\b[^>]*>[^<]*solid/.test(focus), false);
      assert.equal(/<a\b[^>]*>[^<]*src\/b\.ts:9/.test(focus), false);
      assert.deepEqual(calls, [
        {file: 'src/a.ts', line: 4},
        {file: 'src/a.ts', line: 4},
      ]);
      assert.ok(window.sidebar().some(block => block.kind === 'focus'));
      const closed = await post(
        page.url,
        'act',
        new URLSearchParams({act: 'close-card'}).toString(),
      );
      assert.equal(closed.status, 200);
      assert.deepEqual(window.sidebar(), []);
      const cleared = await pageHtml(page.url);
      assert.equal(cleared.includes('class="sidebar"'), false);
      assert.equal(cleared.includes('class="band"'), false);
      const missing = await post(
        page.url,
        'act',
        new URLSearchParams({act: 'close-card', key: 'absent'}).toString(),
      );
      assert.equal(missing.status, 200);
    },
  );
});

test('a service draft stays unsigned until save and a warned edit cannot be written', async () => {
  const fileOf = (arcadia: string) =>
    path.join(arcadia, 'services', 'billing', 'openspec', 'config.yaml');
  await hosted(
    {
      login: () => MANAGER,
      tickets: () => [
        ticket({key: '1', queue: 'alpha', sddService: 'services/billing', labels: ['sdd:cycle']}),
      ],
    },
    async (page, _window, paths) => {
      const file = fileOf(paths.arcadia);
      const before = readFileSync(file, 'utf8');
      const opened = await fetch(new URL('act', page.url), {
        method: 'POST',
        headers: {'content-type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({act: 'open-settings'}).toString(),
      });
      const fresh = await paint(opened);
      assert.equal(saveControl(fresh).disabled, true);
      assert.equal(fresh.includes('сервис не записан'), false);
      assert.equal(fresh.includes('правку нельзя записать'), false);
      assert.equal(
        (
          await post(
            page.url,
            'act',
            new URLSearchParams({
              act: 'set-service-queue',
              name: 'beta',
              description: 'смена',
            }).toString(),
          )
        ).status,
        200,
      );
      const dirty = await pageHtml(page.url);
      assert.equal(saveControl(dirty).disabled, false);
      assert.match(dirty, /сервис не записан/);
      assert.match(dirty, /Закрыть без записи/);
      assert.equal(readFileSync(file, 'utf8'), before);
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'save-service'}).toString())).status,
        200,
      );
      const saved = await pageHtml(page.url);
      assert.equal(saved.includes('сервис не записан'), false);
      assert.equal(saveControl(saved).disabled, true);
      const doc = parse(readFileSync(file, 'utf8')) as {
        sdd: {queues: {name: string; description?: string}[]};
      };
      assert.equal(doc.sdd.queues[0]?.name, 'beta');
      assert.equal(doc.sdd.queues[0]?.description, 'смена');
    },
  );
  await hosted(
    {
      login: () => MANAGER,
      tickets: () => [
        ticket({key: '1', queue: 'alpha', sddService: 'services/billing', labels: ['sdd:cycle']}),
      ],
    },
    async (page, _window, paths) => {
      const file = fileOf(paths.arcadia);
      const before = readFileSync(file, 'utf8');
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'open-settings'}).toString()))
          .status,
        200,
      );
      assert.equal(
        (
          await post(
            page.url,
            'act',
            new URLSearchParams({
              act: 'set-service-queue',
              name: 'gamma',
              description: '',
            }).toString(),
          )
        ).status,
        200,
      );
      assert.match(await pageHtml(page.url), /Закрыть без записи/);
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'close-settings'}).toString()))
          .status,
        200,
      );
      assert.equal(readFileSync(file, 'utf8'), before);
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'open-settings'}).toString()))
          .status,
        200,
      );
      const again = await pageHtml(page.url);
      assert.equal(again.includes('сервис не записан'), false);
      assert.match(again, /value="alpha"/);
    },
  );
  await hosted(
    {
      login: () => MANAGER,
      tickets: () => [
        ticket({key: '1', queue: 'alpha', sddService: 'services/billing', labels: ['sdd:cycle']}),
      ],
    },
    async (page, _window, paths) => {
      const file = fileOf(paths.arcadia);
      const before = readFileSync(file, 'utf8');
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'open-settings'}).toString()))
          .status,
        200,
      );
      assert.equal(
        (
          await post(
            page.url,
            'act',
            new URLSearchParams({act: 'add-service-ignore', value: '('}).toString(),
          )
        ).status,
        200,
      );
      const ignored = await pageHtml(page.url);
      assert.equal(saveControl(ignored).disabled, true);
      assert.match(ignored, /правку нельзя записать/);
      assert.equal(readFileSync(file, 'utf8'), before);
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'close-settings'}).toString()))
          .status,
        200,
      );
      assert.equal(readFileSync(file, 'utf8'), before);
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'open-settings'}).toString()))
          .status,
        200,
      );
      assert.equal(
        (
          await post(
            page.url,
            'act',
            new URLSearchParams({act: 'remove-service-queue', index: '0'}).toString(),
          )
        ).status,
        200,
      );
      const emptied = await pageHtml(page.url);
      assert.equal(saveControl(emptied).disabled, true);
      assert.match(emptied, /правку нельзя записать/);
      assert.equal(readFileSync(file, 'utf8'), before);
    },
  );
});

test('a root pair and a queue pair submit together when focus leaves the form', async () => {
  const roots: {arcadia?: string; github?: string}[] = [];
  const queues: {index: number; name: string; description: string}[] = [];
  const surface = idle();
  surface.settings = () => settingsState(true);
  surface.leaveRoots = next => {
    roots.push(next);
  };
  surface.serviceConfig = () => ({
    file: 'openspec/config.yaml',
    checkout: '/billing',
    save: true,
    queues: {items: [{name: 'alpha', description: 'old'}]},
    hookChoices: [{action: 'archive', point: 'before'}],
  });
  surface.setServiceQueue = (index, name, description) => {
    queues.push({index, name, description});
  };
  const page = await serveBoard(surface);
  try {
    const html = await pageHtml(page.url);
    const rootsForm = formsOf(html).find(
      form => form.includes('name="arcadia"') && form.includes('name="github"'),
    );
    assert.ok(rootsForm);
    assert.match(rootsForm, /class="pair"/);
    assert.equal(rootsForm.includes('onchange'), false);
    const queueForm = formsOf(html).find(
      form => form.includes('name="name"') && form.includes('name="description"'),
    );
    assert.ok(queueForm);
    assert.match(queueForm, /class="[^"]*\bpair\b/);
    assert.equal(/<input\b[^>]*name="name"[^>]*onchange/.test(queueForm), false);
    assert.equal(/<input\b[^>]*name="description"[^>]*onchange/.test(queueForm), false);
    assert.match(queueForm, /name="first"/);
    assert.equal(focusStaysInForm({contains: () => true}, {} as Node), true);
    assert.equal(focusStaysInForm({contains: () => false}, null), false);
    assert.equal(SHEET_SCROLL_KEY, 'ai-factory-sheet-scroll');
    assert.equal(SHEET_FIELD_KEY, 'ai-factory-sheet-field');
    assert.equal(
      (
        await post(
          page.url,
          'act',
          new URLSearchParams({act: 'leave-roots', arcadia: '/arc', github: '/hub'}).toString(),
        )
      ).status,
      200,
    );
    assert.deepEqual(roots, [{arcadia: '/arc', github: '/hub'}]);
    assert.equal(
      (
        await post(
          page.url,
          'act',
          new URLSearchParams({
            act: 'set-service-queue',
            name: 'beta',
            description: 'линия',
          }).toString(),
        )
      ).status,
      200,
    );
    assert.deepEqual(queues, [{index: 0, name: 'beta', description: 'линия'}]);
  } finally {
    await page.close();
  }
});

test('settings list a checkout that is not in the pool', async () => {
  const surface = idle();
  surface.settings = () => settingsState(true);
  surface.board = () => boardState({pool: [pool('1', 'Pool')]});
  surface.checkouts = () => ['/repo/only-column'];
  const page = await serveBoard(surface);
  try {
    const html = await pageHtml(page.url);
    assert.equal(html.includes('only-column'), true);
    const pick = formsOf(html).find(
      form => form.includes('choose-checkout') && form.includes('/repo/only-column'),
    );
    assert.ok(pick);
    assert.match(pick, /<button[^>]*>\/repo\/only-column<\/button>/);
    assert.equal(
      html.includes('value="/repo/only-column"') || pick.includes('/repo/only-column'),
      true,
    );
  } finally {
    await page.close();
  }
});

test('the settings picker lists a checkout that stands only in a column', async () => {
  await hosted(
    {
      login: () => MANAGER,
      tickets: () => [
        ticket({key: '1', queue: 'alpha', sddService: 'services/billing', title: 'Pool'}),
        ticket({
          key: '2',
          queue: 'alpha',
          sddService: 'services/other',
          assignee: MANAGER,
          title: 'Column',
          labels: ['sdd:cycle', 'sdd:implementing'],
        }),
      ],
    },
    async (page, window, paths) => {
      const other = path.join(paths.arcadia, 'services', 'other');
      writeQueues(other, ['alpha']);
      const listed = window.checkouts();
      assert.ok(listed.some(item => item.endsWith(path.join('services', 'other'))));
      assert.equal(
        window.board().pool.some(card => card.checkout?.endsWith(path.join('services', 'other'))),
        false,
      );
      const opened = await fetch(new URL('act', page.url), {
        method: 'POST',
        headers: {'content-type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({act: 'open-settings'}).toString(),
      });
      const html = await paint(opened);
      const pick = formsOf(html).find(
        form => form.includes('choose-checkout') && form.includes(other),
      );
      assert.ok(pick);
    },
  );
});

function bare(key: string, title: string): WindowTicket {
  return ticket({key, queue: 'alpha', sddService: 'services/billing', title});
}

function held(key: string, phase: string, over: Partial<WindowTicket> = {}): WindowTicket {
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

function writeChange(arcadia: string, key: string, name: string, body: string): void {
  const file = path.join(arcadia, 'services', 'billing', changeDir(key), name);
  mkdirSync(path.dirname(file), {recursive: true});
  writeFileSync(file, body);
}

function deltaRequirement(): string {
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

function git(root: string, args: string[]): void {
  execFileSync('git', args, {cwd: root, stdio: 'ignore'});
}

test('a missing service config asks for one queue name', async () => {
  await hosted(
    {
      login: () => MANAGER,
      tickets: () => [
        ticket({key: '1', queue: 'alpha', sddService: 'services/billing', title: 'Bare'}),
      ],
    },
    async (page, window, paths) => {
      window.chooseAgent('cursor');
      const file = path.join(paths.arcadia, 'services', 'billing', 'openspec', 'config.yaml');
      rmSync(file);
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'repair', key: '1'}).toString()))
          .status,
        200,
      );
      const open = await pageHtml(page.url);
      const dialog = between(open, '<div class="popup repair"', '</div></div>');
      assert.match(dialog, /конфига сервиса нет/);
      assert.match(dialog, /name="name"/);
      assert.equal(dialog.includes('<select'), false);
      assert.equal(dialog.includes('hooks'), false);
      assert.equal(articleOf(open, '1').includes('name="name"'), false);
      assert.equal(
        (
          await post(
            page.url,
            'act',
            new URLSearchParams({act: 'plant-queue', key: '1', name: ' '}).toString(),
          )
        ).status,
        409,
      );
      assert.equal(existsSync(file), false);
      assert.equal(
        (
          await post(
            page.url,
            'act',
            new URLSearchParams({act: 'plant-queue', key: '1', name: 'bad\nname'}).toString(),
          )
        ).status,
        409,
      );
      assert.equal(existsSync(file), false);
      assert.equal(
        (
          await post(
            page.url,
            'act',
            new URLSearchParams({act: 'plant-queue', key: '1', name: 'alpha'}).toString(),
          )
        ).status,
        200,
      );
      assert.equal(readFileSync(file, 'utf8'), 'sdd:\n  queues:\n    - name: "alpha"\n');
      const next = await pageHtml(page.url);
      assert.equal(next.includes('role="dialog"'), false);
      assert.equal(articleOf(next, '1').includes('aria-label="Поломка"'), false);
      assert.match(articleOf(next, '1'), /aria-label="Взять"/);
    },
  );
});

spec('board', () => {
  requirement('The board is a column of keys and seven stations', () => {
    scenario('An empty station stays the same width', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [bare('1', 'Take me')]},
        async (page, window) => {
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          assert.match(html, /grid-template-columns:\s*252px repeat\(7, minmax\(0, 1fr\)\)/);
          for (const name of COLUMN_NAMES) {
            assert.match(stationOf(html, '1', name), /data-station="/);
          }
          assert.match(stationOf(html, '1', 'specifying'), /aria-label="Снять гейт specifying"/);
          assert.match(stationOf(html, '1', 'tasking'), /<span class="dot"/);
          assert.equal(stationOf(html, '1', 'specifying').includes('class="plaque"'), false);
        },
      );
    });
    scenario('The window adds no phase control', async () => {
      const phases: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [bare('1', 'Take me')],
          writePhase: (_key, phase) => {
            phases.push(phase);
          },
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const opened = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'open', key: '1'}).toString(),
          );
          assert.equal(opened.status, 200);
          const html = await pageHtml(page.url);
          assert.match(html, /class="ticket pool is-open"/);
          assert.equal(html.includes('name="phase"'), false);
          assert.deepEqual(phases, []);
        },
      );
    });
    scenario('An empty pool draws no tile', async () => {
      await hosted({login: () => MANAGER, tickets: () => []}, async (page, window) => {
        window.chooseAgent('cursor');
        const html = await pageHtml(page.url);
        assert.match(html, /class="head"/);
        for (const name of COLUMN_NAMES) {
          assert.match(html, new RegExp(`<span class="phase">${name}</span>`));
        }
        assert.equal(html.includes('<article'), false);
        assert.equal(html.includes('aria-label="Взять"'), false);
      });
    });
  });
  requirement('Take writes this process login', () => {
    scenario('Play is named Take and is not the button text', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [bare('1', 'Take me')]},
        async (page, window) => {
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          assert.match(html, /<button class="round play" type="submit" aria-label="Взять">/);
          assert.equal(/<button[^>]*>\s*Взять\s*<\/button>/.test(html), false);
        },
      );
    });
    scenario('A drop on a station does not write the phase', async () => {
      const phases: string[] = [];
      const assignees: string[] = [];
      const tickets = [bare('1', 'Take me')];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => tickets,
          writeAssignee: (key, login) => {
            assignees.push(key);
            const found = tickets.find(item => item.key === key);
            if (found) {
              found.assignee = login;
            }
          },
          writePhase: (key, phase) => {
            phases.push(phase);
            const found = tickets.find(item => item.key === key);
            if (found && !found.labels.includes(`sdd:${phase}`)) {
              found.labels = [...found.labels, `sdd:${phase}`];
            }
          },
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(gesture('pool', '1', 'station'), 'take');
          assert.equal(gesture('pool', '1', 'card'), '');
          const taken = await post(page.url, 'take', new URLSearchParams({key: '1'}).toString());
          assert.equal(taken.status, 200);
          assert.deepEqual(assignees, ['1']);
          assert.deepEqual(phases, ['proposing']);
          assert.equal(phases.includes('implementing'), false);
        },
      );
    });
    scenario("An exclamation replaces play on this cycle's break", async () => {
      const assignees: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [ticket({key: '1', queue: 'alpha', title: 'Bare'})],
          writeAssignee: key => {
            assignees.push(key);
          },
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          const row = articleOf(html, '1');
          assert.match(row, /aria-label="Поломка"/);
          assert.equal(row.includes('aria-label="Взять"'), false);
          assert.equal(row.includes('не назван сервис'), false);
          const taken = await post(page.url, 'take', new URLSearchParams({key: '1'}).toString());
          assert.equal(taken.status, 409);
          assert.deepEqual(assignees, []);
        },
      );
    });
    scenario('A board-wide silence leaves play disabled', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [bare('1', 'Quiet')]},
        async (page, window) => {
          window.chooseAgent('cursor');
          window.leaveModel('judgment', '');
          const html = await pageHtml(page.url);
          const row = articleOf(html, '1');
          assert.match(
            row,
            /<button class="round play off" type="submit" disabled(?:="")? aria-label="Взять">/,
          );
          assert.equal(row.includes('aria-label="Поломка"'), false);
          assert.match(html, /нужна модель judgment/);
        },
      );
    });
  });
  requirement('The icon is hidden while a step runs or checks are waited', () => {
    scenario('A gate shows the icon', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [
            ticket({
              key: '2',
              queue: 'alpha',
              sddService: 'services/billing',
              assignee: MANAGER,
              title: 'Propose it',
              labels: ['sdd:cycle', 'sdd:proposed'],
            }),
          ],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          assert.equal(html.includes('class="mark"'), false);
          assert.match(stationOf(html, '2', 'proposing'), /class="plaque"/);
          assert.equal(articleOf(html, '2').includes('aria-label="Взять"'), false);
        },
      );
    });
    scenario('A running step keeps the reason line', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [
            held('1', 'specifying', {dependsOn: ['9']}),
            ticket({key: '9', title: 'blocker', labels: ['note']}),
          ],
          leading: () => true,
          turn: () => 'restore-baseline',
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          const plaque = stationOf(html, '1', 'specifying');
          assert.match(plaque, /блокеры 9/);
          assert.equal(plaque.includes('restore-baseline'), false);
          assert.equal(plaque.includes('class="mark"'), false);
          const card = window
            .board()
            .columns.find(column => column.name === 'specifying')
            ?.cards.find(item => item.key === '1');
          assert.equal(card?.icon, undefined);
          assert.equal(card?.reason, 'блокеры 9');
        },
      );
    });
  });
  requirement('A station door opens the port and does not write a phase', () => {
    scenario('A file ahead of the plaque is a door', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'specifying')],
          reviewPlace: place => `https://review.example/${place.file}?line=${place.line}`,
        },
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'proposal.md', '# proposal\n');
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          assert.match(stationOf(html, '1', 'proposing'), /aria-label="plan"/);
          assert.match(stationOf(html, '1', 'specifying'), /class="plaque"/);
        },
      );
    });
    scenario('A door opens the port and does not write a phase', async () => {
      const phases: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'specifying')],
          writePhase: (_key, phase) => {
            phases.push(phase);
          },
          reviewPlace: place => `https://review.example/${place.file}?line=${place.line}`,
        },
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'proposal.md', '# proposal\n');
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          const door = stationOf(html, '1', 'proposing');
          assert.match(
            door,
            /<a class="big" href="https:\/\/review\.example\/openspec\/changes\/issue-1\/proposal\.md\?line=1" aria-label="plan">/,
          );
          assert.equal(door.includes('name="phase"'), false);
          assert.deepEqual(phases, []);
        },
      );
    });
    scenario('An empty port leaves the circle without a navigation', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'specifying')],
          reviewPlace: () => '',
        },
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'proposal.md', '# proposal\n');
          window.chooseAgent('cursor');
          const door = stationOf(await pageHtml(page.url), '1', 'proposing');
          assert.match(door, /<button class="big" type="button" aria-label="plan">/);
          assert.equal(door.includes('href='), false);
        },
      );
    });
    scenario('Several specs open one list of capabilities', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'implementing')],
          reviewPlace: place => `https://review.example/${place.file}?line=${place.line}`,
        },
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'specs/beta/spec.md', '# beta\n');
          writeChange(paths.arcadia, '1', 'specs/alpha/spec.md', '# alpha\n');
          window.chooseAgent('cursor');
          const closed = await pageHtml(page.url);
          const station = stationOf(closed, '1', 'specifying');
          assert.equal(station.match(/aria-label="spec"/g)?.length, 1);
          assert.match(station, /name="act" value="open"/);
          assert.equal(station.includes('alpha'), false);
          assert.equal(station.includes('beta'), false);
          assert.equal(closed.includes('class="caps"'), false);
          const opened = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'open', key: '1'}).toString(),
          );
          assert.equal(opened.status, 200);
          const html = await pageHtml(page.url);
          assert.equal(stationOf(html, '1', 'specifying').match(/aria-label="spec"/g)?.length, 1);
          assert.equal(articleOf(html, '1').includes('class="caps"'), false);
          assert.match(html, /id="cap-alpha"/);
          assert.match(html, /id="cap-beta"/);
        },
      );
    });
    scenario('The current station is the plaque', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'designing')]},
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'design.md', '# design\n');
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          const station = stationOf(html, '1', 'designing');
          assert.match(station, /class="plaque"/);
          assert.equal(station.includes('aria-label="design"'), false);
        },
      );
    });
    scenario('A note does not move the plaque', async () => {
      const phases: string[] = [];
      const tickets = [held('1', 'implementing')];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => tickets,
          writePhase: (_key, phase) => {
            phases.push(phase);
          },
          review: () => ({
            threads: [{marker: 'note', file: 'design.md', lines: ['look']}],
          }),
        },
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'design.md', '# design\n');
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          assert.match(stationOf(html, '1', 'implementing'), /class="plaque"/);
          assert.match(stationOf(html, '1', 'designing'), /aria-label="design"/);
          assert.match(stationOf(html, '1', 'designing'), /class="pip"/);
          assert.deepEqual(phases, []);
          assert.deepEqual(tickets[0]?.labels, ['sdd:cycle', 'sdd:implementing']);
        },
      );
    });
  });
});

spec('auto-gate', () => {
  requirement('A future gate sets or clears one auto label', () => {
    scenario('Gandalf writes one auto label and does not write a phase', async () => {
      const phases: string[] = [];
      const tickets = [held('1', 'proposing')];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => tickets,
          writePhase: (_key, phase) => {
            phases.push(phase);
          },
          editLabels: (_key, add, remove) => {
            const item = tickets[0];
            if (!item) {
              return;
            }
            item.labels = item.labels.filter(label => !remove?.includes(label));
            for (const label of add) {
              if (!item.labels.includes(label)) {
                item.labels = [...item.labels, label];
              }
            }
          },
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const before = stationOf(await pageHtml(page.url), '1', 'designing');
          assert.match(before, /aria-label="Снять гейт designing"/);
          assert.match(before, /M8 0\.4/);
          assert.equal(before.includes('class="tick"'), false);
          const posted = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'gate', key: '1', station: 'designing'}).toString(),
          );
          assert.equal(posted.status, 200);
          assert.ok(tickets[0]?.labels.includes('sdd:auto-design'));
          assert.equal(tickets[0]?.labels.includes('sdd:designed'), false);
          assert.equal(tickets[0]?.labels.includes('sdd:proposed'), false);
          assert.equal(tickets[0]?.labels.includes('sdd:specified'), false);
          assert.equal(tickets[0]?.labels.includes('sdd:accepted'), false);
          assert.deepEqual(phases, []);
          const after = stationOf(await pageHtml(page.url), '1', 'designing');
          assert.match(after, /aria-label="Поставить гейт designing"/);
          assert.match(after, /class="tick"/);
          assert.equal(after.includes('M8 0.4'), false);
        },
      );
    });
    scenario('A circle removes that one label', async () => {
      const tickets = [
        held('1', 'proposing', {
          labels: ['sdd:cycle', 'sdd:proposing', 'sdd:auto-plan', 'sdd:auto-spec'],
        }),
      ];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => tickets,
          editLabels: (_key, add, remove) => {
            const item = tickets[0];
            if (!item) {
              return;
            }
            item.labels = item.labels.filter(label => !remove?.includes(label));
            for (const label of add) {
              if (!item.labels.includes(label)) {
                item.labels = [...item.labels, label];
              }
            }
          },
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const before = stationOf(await pageHtml(page.url), '1', 'specifying');
          assert.match(before, /aria-label="Поставить гейт specifying"/);
          assert.match(before, /class="tick"/);
          assert.equal(before.includes('<svg'), false);
          const posted = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'gate', key: '1', station: 'specifying'}).toString(),
          );
          assert.equal(posted.status, 200);
          assert.equal(tickets[0]?.labels.includes('sdd:auto-spec'), false);
          assert.ok(tickets[0]?.labels.includes('sdd:auto-plan'));
          assert.ok(tickets[0]?.labels.includes('sdd:proposing'));
          const after = stationOf(await pageHtml(page.url), '1', 'specifying');
          assert.match(after, /aria-label="Снять гейт specifying"/);
        },
      );
    });
    scenario('A started phase has no gate button', async () => {
      const tickets = [held('1', 'specifying')];
      const calls: string[][] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => tickets,
          editLabels: (_key, add, remove) => {
            calls.push([...(add ?? []), ...(remove ?? [])]);
          },
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          assert.equal(stationOf(html, '1', 'proposing').includes('гейт'), false);
          assert.equal(stationOf(html, '1', 'specifying').includes('гейт'), false);
          assert.match(stationOf(html, '1', 'specifying'), /class="plaque"/);
          const posted = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'gate', key: '1', station: 'proposing'}).toString(),
          );
          assert.equal(posted.status, 200);
          assert.deepEqual(calls, []);
          assert.equal(tickets[0]?.labels.includes('sdd:auto-plan'), false);
        },
      );
    });
    scenario('A door keeps the gate button in the open row', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing')]},
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'design.md', '# design\n');
          window.chooseAgent('cursor');
          const closed = await pageHtml(page.url);
          const station = stationOf(closed, '1', 'designing');
          assert.match(station, /aria-label="design"/);
          assert.equal(station.includes('гейт'), false);
          const opened = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'open', key: '1'}).toString(),
          );
          assert.equal(opened.status, 200);
          const html = await pageHtml(page.url);
          assert.match(glineOf(html, '1', 'designing'), /aria-label="Снять гейт designing"/);
          assert.match(glineOf(html, '1', 'designing'), /name="where" value="side"/);
          assert.equal(stationOf(html, '1', 'designing').includes('гейт'), false);
        },
      );
    });
    scenario('An auto label does not clear the wait', async () => {
      const tickets = [
        held('1', 'proposing', {
          labels: ['sdd:cycle', 'sdd:proposing', 'sdd:wait-human'],
          comments: [{body: 'Review the proposal and accept it.'}],
        }),
      ];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => tickets,
          editLabels: (_key, add, remove) => {
            const item = tickets[0];
            if (!item) {
              return;
            }
            item.labels = item.labels.filter(label => !remove?.includes(label));
            for (const label of add) {
              if (!item.labels.includes(label)) {
                item.labels = [...item.labels, label];
              }
            }
          },
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const posted = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'gate', key: '1', station: 'specifying'}).toString(),
          );
          assert.equal(posted.status, 200);
          assert.ok(tickets[0]?.labels.includes('sdd:auto-spec'));
          assert.ok(tickets[0]?.labels.includes('sdd:wait-human'));
          const plaque = stationOf(await pageHtml(page.url), '1', 'proposing');
          assert.match(plaque, /<span class="kicker">ask<\/span>/);
        },
      );
    });
    scenario('A station behind the plaque with no file is a dot', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'implementing')]},
        async (page, window) => {
          window.chooseAgent('cursor');
          const station = stationOf(await pageHtml(page.url), '1', 'tasking');
          assert.match(station, /<span class="dot"/);
          assert.equal(station.includes('<button'), false);
          assert.equal(station.includes('<a '), false);
        },
      );
    });
    scenario('A pool cycle sets a gate', async () => {
      const tickets = [bare('1', 'Quiet')];
      const phases: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => tickets,
          writePhase: (_key, phase) => {
            phases.push(phase);
          },
          editLabels: (_key, add, remove) => {
            const item = tickets[0];
            if (!item) {
              return;
            }
            item.labels = item.labels.filter(label => !remove?.includes(label));
            for (const label of add) {
              if (!item.labels.includes(label)) {
                item.labels = [...item.labels, label];
              }
            }
          },
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          assert.match(stationOf(html, '1', 'proposing'), /aria-label="Снять гейт proposing"/);
          assert.match(stationOf(html, '1', 'accepting'), /aria-label="Снять гейт accepting"/);
          assert.match(stationOf(html, '1', 'implementing'), /<span class="dot"/);
          const posted = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'gate', key: '1', station: 'proposing'}).toString(),
          );
          assert.equal(posted.status, 200);
          assert.ok(tickets[0]?.labels.includes('sdd:auto-plan'));
          assert.equal(tickets[0]?.labels.includes('sdd:accepted'), false);
          assert.deepEqual(phases, []);
        },
      );
    });
    scenario('Accepting sets auto-merge', async () => {
      const tickets = [bare('1', 'Quiet')];
      const phases: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => tickets,
          writePhase: (_key, phase) => {
            phases.push(phase);
          },
          editLabels: (_key, add, remove) => {
            const item = tickets[0];
            if (!item) {
              return;
            }
            item.labels = item.labels.filter(label => !remove?.includes(label));
            for (const label of add) {
              if (!item.labels.includes(label)) {
                item.labels = [...item.labels, label];
              }
            }
          },
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const posted = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'gate', key: '1', station: 'accepting'}).toString(),
          );
          assert.equal(posted.status, 200);
          assert.ok(tickets[0]?.labels.includes('sdd:auto-merge'));
          assert.equal(tickets[0]?.labels.includes('sdd:accepted'), false);
          assert.deepEqual(phases, []);
          const station = stationOf(await pageHtml(page.url), '1', 'accepting');
          assert.match(station, /aria-label="Поставить гейт accepting"/);
        },
      );
    });
    scenario('The last gate asks before it clears', async () => {
      const tickets = [
        held('1', 'proposing', {
          labels: [
            'sdd:cycle',
            'sdd:proposing',
            'sdd:auto-plan',
            'sdd:auto-spec',
            'sdd:auto-design',
          ],
        }),
      ];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => tickets,
          editLabels: (_key, add, remove) => {
            const item = tickets[0];
            if (!item) {
              return;
            }
            item.labels = item.labels.filter(label => !remove?.includes(label));
            for (const label of add) {
              if (!item.labels.includes(label)) {
                item.labels = [...item.labels, label];
              }
            }
          },
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const asked = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'gate', key: '1', station: 'accepting'}).toString(),
          );
          assert.equal(asked.status, 200);
          const dialog = await pageHtml(page.url);
          assert.match(dialog, /aria-label="Без контроля"/);
          assert.match(dialog, /Тикет останется без контроля/);
          assert.equal(tickets[0]?.labels.includes('sdd:auto-merge'), false);
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'close-ask'}).toString()))
              .status,
            200,
          );
          const kept = await pageHtml(page.url);
          assert.equal(kept.includes('Без контроля'), false);
          assert.equal(tickets[0]?.labels.includes('sdd:auto-merge'), false);
          assert.equal(
            (
              await post(
                page.url,
                'act',
                new URLSearchParams({
                  act: 'gate',
                  key: '1',
                  station: 'accepting',
                  sure: '1',
                }).toString(),
              )
            ).status,
            200,
          );
          assert.ok(tickets[0]?.labels.includes('sdd:auto-merge'));
          assert.equal(tickets[0]?.labels.includes('sdd:accepted'), false);
        },
      );
    });
  });
});

spec('board', () => {
  requirement('A plaque shows the top and the bottom in order', () => {
    scenario('Ask is the top while the cycle waits', async () => {
      const tickets = [
        held('1', 'proposing', {
          labels: ['sdd:cycle', 'sdd:proposing', 'sdd:wait-human'],
          comments: [{body: 'Review the proposal and accept it.'}],
        }),
      ];
      await hosted({login: () => MANAGER, tickets: () => tickets}, async (page, window) => {
        window.chooseAgent('cursor');
        const waiting = stationOf(await pageHtml(page.url), '1', 'proposing');
        assert.match(waiting, /<span class="kicker">ask<\/span>/);
        assert.match(waiting, /Review the proposal and accept it\./);
        assert.equal(waiting.includes('class="stat"'), false);
        tickets[0]?.labels.splice(tickets[0].labels.indexOf('sdd:wait-human'), 1);
        const cleared = stationOf(await pageHtml(page.url), '1', 'proposing');
        assert.equal(cleared.includes('>ask<'), false);
        assert.match(cleared, /<div class="stat">0<\/div>/);
      });
    });
    scenario('A focus gap is the top when there is no ask', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [
            held('1', 'specifying', {
              comments: [{body: 'sdd:focus\nPlan solid\nSpecify src/a.ts:1\n'}],
            }),
          ],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const plaque = stationOf(await pageHtml(page.url), '1', 'specifying');
          assert.match(plaque, /<span class="kicker">Specify<\/span>/);
          assert.equal(plaque.includes('Plan'), false);
        },
      );
    });
    scenario('A solid focus adds no gap line', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [
            held('1', 'proposing', {
              comments: [{body: 'sdd:focus\nChange solid\nPlan solid\nSpecify solid\n'}],
            }),
          ],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const plaque = stationOf(await pageHtml(page.url), '1', 'proposing');
          assert.equal(plaque.includes('class="kicker"'), false);
          assert.equal(plaque.includes('Plan'), false);
          assert.match(plaque, /<div class="stat">0<\/div>/);
        },
      );
    });
    scenario('Review is the top when text is unanswered', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'specifying')],
          review: () => ({threads: [{lines: ['please look']}]}),
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const plaque = stationOf(await pageHtml(page.url), '1', 'specifying');
          assert.match(plaque, /<span class="kicker">ревью<\/span>/);
          assert.match(plaque, /please look/);
        },
      );
    });
    scenario('The check state is the top on verifying', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'verifying', {checks: 'red'})],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const plaque = stationOf(await pageHtml(page.url), '1', 'verifying');
          assert.match(plaque, /<span class="kicker red">red<\/span>/);
          assert.equal(plaque.includes('lint'), false);
          assert.equal(plaque.includes('class="stat"'), false);
        },
      );
    });
    scenario('A click opens the row and does not write a phase', async () => {
      const phases: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'implementing')],
          writePhase: (_key, phase) => {
            phases.push(phase);
          },
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const opened = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'open', key: '1'}).toString(),
          );
          assert.equal(opened.status, 200);
          const html = await pageHtml(page.url);
          assert.match(html, /class="ticket is-open"/);
          assert.equal(html.includes('name="phase"'), false);
          assert.deepEqual(phases, []);
        },
      );
    });
    scenario('The closed plaque hides the tail of the ask', async () => {
      const body =
        'Review the proposal. To accept it, replace the label sdd:proposing with sdd:proposed on this issue, or run sdd accept 5.';
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [
            held('1', 'proposing', {
              labels: ['sdd:cycle', 'sdd:proposing', 'sdd:wait-human'],
              comments: [{body}],
            }),
          ],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const closed = await pageHtml(page.url);
          const plaque = stationOf(closed, '1', 'proposing');
          assert.equal(plaque.match(/<span class="reason">/g)?.length, 1);
          assert.match(plaque, /text-overflow:\s*ellipsis|class="reason"/);
          assert.match(closed, /\.plaque \.reason[\s\S]*white-space:\s*nowrap[\s\S]*ellipsis/);
          assert.match(closed, /\.station > form:has\(\.plaque\) \{ min-width: 0; width: 100%; \}/);
          const opened = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'open', key: '1'}).toString(),
          );
          assert.equal(opened.status, 200);
          const html = await pageHtml(page.url);
          const side = bandOf(html, '1');
          assert.match(side, /Review the proposal\. To accept it, replace the label sdd:proposing/);
          assert.match(side, /run sdd accept 5\./);
        },
      );
    });
    scenario('A running turn fills an empty plaque', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'specifying'), held('2', 'tasking')],
          turn: key => {
            if (key === '1') {
              return 'restore-baseline';
            }
            if (key === '2') {
              return 'create-tasks';
            }
            return undefined;
          },
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          const specifying = stationOf(html, '1', 'specifying');
          const tasking = stationOf(html, '2', 'tasking');
          assert.match(specifying, /<span class="reason">restore-baseline<\/span>/);
          assert.equal(specifying.includes('class="kicker"'), false);
          assert.equal(specifying.includes('class="mark"'), false);
          assert.match(tasking, /<span class="reason">create-tasks<\/span>/);
          assert.equal(tasking.includes('class="kicker"'), false);
          assert.equal(tasking.includes('class="mark"'), false);
        },
      );
    });
    scenario('A running turn does not replace plaque text', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [
            held('1', 'specifying', {
              labels: ['sdd:cycle', 'sdd:specifying', 'sdd:wait-human'],
              comments: [{body: 'please decide'}],
            }),
          ],
          turn: () => 'restore-baseline',
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const plaque = stationOf(await pageHtml(page.url), '1', 'specifying');
          assert.match(plaque, /<span class="kicker">ask<\/span>/);
          assert.match(plaque, /please decide/);
          assert.equal(plaque.includes('restore-baseline'), false);
        },
      );
    });
  });
  requirement('A break opens one repair field', () => {
    scenario('An unnamed service is a field in the exclamation popup', () =>
      proveAnUnnamedServiceIsAField(),
    );
    scenario('A missing catalog shows the reason and no field', async () => {
      const gone = 'services/gone';
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [ticket({key: '1', queue: 'alpha', sddService: gone, title: 'Gone'})],
        },
        async (page, window, paths) => {
          window.chooseAgent('cursor');
          const catalog = path.join(paths.arcadia, gone);
          assert.equal(existsSync(catalog), false);
          const face = await pageHtml(page.url);
          assert.match(articleOf(face, '1'), /aria-label="Поломка"/);
          assert.equal(face.includes('role="dialog"'), false);
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'repair', key: '1'}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          const dialog = between(html, '<div class="popup repair"', '</div></div>');
          assert.match(dialog, /каталога нет/);
          assert.equal(dialog.includes('<select'), false);
          assert.equal(dialog.includes('name="name"'), false);
          assert.equal(html.includes('role="dialog" aria-label="Настройки"'), false);
          assert.equal(existsSync(catalog), false);
        },
      );
    });
    scenario('An empty model is a board row', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [bare('1', 'Quiet')]},
        async (page, window) => {
          window.chooseAgent('cursor');
          window.leaveModel('judgment', '');
          const html = await pageHtml(page.url);
          const row = articleOf(html, '1');
          assert.match(html, /нужна модель judgment/);
          assert.match(
            row,
            /<button class="round play off" type="submit" disabled(?:="")? aria-label="Взять">/,
          );
          assert.equal(row.includes('aria-label="Поломка"'), false);
          assert.equal(html.includes('role="dialog"'), false);
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'repair', key: '1'}).toString()))
              .status,
            200,
          );
          const after = await pageHtml(page.url);
          assert.equal(after.includes('aria-label="Поломка"'), false);
          assert.equal(after.includes('role="dialog"'), false);
          assert.match(after, /нужна модель judgment/);
        },
      );
    });
    scenario('Several pull requests are not closed by the window', async () => {
      const tickets = [
        ticket({
          key: '1',
          queue: 'alpha',
          sddService: 'services/billing',
          title: 'Pair',
          labels: ['sdd:cycle'],
          openPullRequests: 2,
        }),
      ];
      await hosted({login: () => MANAGER, tickets: () => tickets}, async (page, window) => {
        window.chooseAgent('cursor');
        const face = await pageHtml(page.url);
        assert.match(articleOf(face, '1'), /aria-label="Поломка"/);
        assert.equal(
          (await post(page.url, 'act', new URLSearchParams({act: 'repair', key: '1'}).toString()))
            .status,
          200,
        );
        const html = await pageHtml(page.url);
        const dialog = between(html, '<div class="popup repair"', '</div></div>');
        assert.match(dialog, /несколько pull request/);
        assert.equal(dialog.includes('<select'), false);
        assert.equal(dialog.includes('name="name"'), false);
        const forms = formsOf(dialog);
        assert.equal(forms.length, 1);
        assert.match(forms[0] ?? '', /close-repair/);
        assert.equal(tickets[0]?.openPullRequests, 2);
      });
    });
  });

});

spec('board-command', () => {
  requirement('The board command serves this repository', () => {
    scenario('The snapshot names the current turn', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('6', 'specifying')],
          spyNote: () => '#6 specifying → restore-baseline',
          turn: key => {
            if (key === '6') {
              return 'restore-baseline';
            }
            return undefined;
          },
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const shot = await readSnapshot(page.url);
          assert.equal(shot.spy, '#6 specifying → restore-baseline');
          const row = shot.rows.find(item => item.key === '6');
          assert.ok(row);
          assert.equal(row.action, 'restore-baseline');
        },
      );
    });
    scenario('The snapshot shows the action on an empty plaque', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'specifying'), held('2', 'tasking')],
          turn: key => {
            if (key === '1') {
              return 'restore-baseline';
            }
            if (key === '2') {
              return 'create-tasks';
            }
            return undefined;
          },
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const shot = await readSnapshot(page.url);
          const specifying = shot.rows.find(item => item.key === '1');
          const tasking = shot.rows.find(item => item.key === '2');
          assert.ok(specifying);
          assert.ok(tasking);
          assert.equal(specifying.plaque.top, undefined);
          assert.equal(specifying.plaque.bottom, 'restore-baseline');
          assert.equal(tasking.plaque.top, undefined);
          assert.equal(tasking.plaque.bottom, 'create-tasks');
        },
      );
    });
    scenario('The snapshot offers Specify acceptance for an empty delta', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying', {openPullRequests: 1})]},
        async (page, window, paths) => {
          writeChange(
            paths.arcadia,
            '1',
            'specs/section-text/spec.md',
            '## Purpose\n\nNo requirement yet.\n',
          );
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const shot = await readSnapshot(page.url);
          assert.ok(shot.opened);
          assert.equal(shot.opened.spine.pull, true);
          assert.ok(shot.opened.spine.capabilities.some(item => item.id === 'section-text'));
          assert.equal(
            shot.opened.spine.capabilities.every(item => item.rows.length === 0),
            true,
          );
          const specify = shot.opened.layers.find(layer => layer.layer === 'Specify');
          const plan = shot.opened.layers.find(layer => layer.layer === 'Plan');
          assert.ok(specify);
          assert.ok(plan);
          assert.equal(specify.act, 'accept');
          assert.equal(plan.act, 'gate');
        },
      );
    });
    scenario('The snapshot hides Specify acceptance during a spec turn', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'specifying', {openPullRequests: 1})],
          turn: () => 'create-initial-specs',
        },
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'specs/section-text/spec.md', deltaRequirement());
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const shot = await readSnapshot(page.url);
          assert.ok(shot.opened);
          const specify = shot.opened.layers.find(layer => layer.layer === 'Specify');
          assert.ok(specify);
          assert.equal(specify.act, 'none');
        },
      );
    });
    scenario('The snapshot shows an error once', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing')]},
        async (page, window) => {
          window.chooseAgent('cursor');
          const posted = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'answer', key: '1', reply: ''}).toString(),
          );
          assert.equal(posted.status, 200);
          const first = JSON.parse(posted.body) as WindowSnapshot;
          assert.equal(first.status, 'Комментарий пустой. Напишите его в поле.');
          const second = await readSnapshot(page.url);
          assert.equal(second.status, undefined);
        },
      );
    });
  });
});

spec('plaque-key', () => {
  requirement('The key is a link to the issue', () => {
    scenario('A named repository makes the key a link to the issue', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [
            ticket({
              key: '7',
              repo: 'acme/billing',
              queue: 'alpha',
              sddService: 'services/billing',
              title: 'From GitHub',
            }),
            held('9', 'implementing', {repo: 'acme/other', title: 'On station'}),
          ],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          const pool = articleOf(html, '7');
          assert.match(
            pool,
            /<a class="key" href="https:\/\/github\.com\/acme\/billing\/issues\/7">7<\/a>/,
          );
          const column = articleOf(html, '9');
          assert.match(
            column,
            /<a class="key" href="https:\/\/github\.com\/acme\/other\/issues\/9">9<\/a>/,
          );
        },
      );
    });
    scenario('No repository leaves the key as text', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [bare('1', 'No repo')]},
        async (page, window) => {
          window.chooseAgent('cursor');
          const article = articleOf(await pageHtml(page.url), '1');
          assert.match(article, /<button class="face" type="submit">[\s\S]*<span class="key">1<\/span>/);
          assert.equal(article.includes('<a class="key"'), false);
        },
      );
    });
  });
  requirement('Activating the key follows the link and does not take the cycle', () => {
    scenario('Activating the key follows the link and does not open the sidebar', async () => {
      const assignees: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [
            held('7', 'implementing', {repo: 'acme/billing', title: 'Issue link'}),
          ],
          writeAssignee: (key, login) => {
            assignees.push(`${key}:${login}`);
          },
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const before = await readSnapshot(page.url);
          assert.equal(before.opened, undefined);
          const article = articleOf(await pageHtml(page.url), '7');
          const openForm = article.match(/<form class="open"[\s\S]*?<\/form>/)?.[0] ?? '';
          const key = article.match(/<a class="key" href="([^"]+)">7<\/a>/)?.[1];
          assert.ok(key);
          assert.equal(openForm.includes('<a class="key"'), false);
          assert.equal(key, 'https://github.com/acme/billing/issues/7');
          const nav = await fetch(key, {redirect: 'manual'});
          assert.ok(nav.status >= 200);
          const after = await readSnapshot(page.url);
          assert.equal(after.opened, undefined);
          assert.deepEqual(assignees, []);
        },
      );
    });
    scenario('Activating the key follows the link and does not close the sidebar', async () => {
      const assignees: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [
            held('7', 'implementing', {repo: 'acme/billing', title: 'Issue link'}),
          ],
          writeAssignee: (key, login) => {
            assignees.push(`${key}:${login}`);
          },
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '7'}).toString()))
              .status,
            200,
          );
          const opened = await readSnapshot(page.url);
          assert.equal(opened.opened?.key, '7');
          const article = articleOf(await pageHtml(page.url), '7');
          const openForm = article.match(/<form class="open"[\s\S]*?<\/form>/)?.[0] ?? '';
          const key = article.match(/<a class="key" href="([^"]+)">7<\/a>/)?.[1];
          assert.ok(key);
          assert.equal(openForm.includes('<a class="key"'), false);
          assert.equal(key, 'https://github.com/acme/billing/issues/7');
          const nav = await fetch(key, {redirect: 'manual'});
          assert.ok(nav.status >= 200);
          const after = await readSnapshot(page.url);
          assert.equal(after.opened?.key, '7');
          assert.deepEqual(assignees, []);
        },
      );
    });
    scenario('The first activation of the title opens the sidebar', async () => {
      const assignees: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [
            held('7', 'implementing', {repo: 'acme/billing', title: 'Title opens sidebar'}),
          ],
          writeAssignee: (key, login) => {
            assignees.push(`${key}:${login}`);
          },
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const before = await readSnapshot(page.url);
          assert.equal(before.opened, undefined);
          const article = articleOf(await pageHtml(page.url), '7');
          const gutter =
            article.match(/<div class="gutter[^"]*">([\s\S]*?)<\/div>\s*<div class="station"/)?.[1] ??
            '';
          assert.match(gutter, /^[\s\S]*<a class="key" href="[^"]+">7<\/a>[\s\S]*<form class="open"/);
          const titleForm =
            gutter.match(/<form class="open"[\s\S]*?<\/form>/g)?.find(form => form.includes('class="title"')) ??
            '';
          assert.ok(titleForm);
          assert.equal(titleForm.includes('<a class="key"'), false);
          assert.match(titleForm, /<button class="face" type="submit">\s*<h2 class="title">Title opens sidebar<\/h2>/);
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '7'}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          assert.match(articleOf(html, '7'), /class="ticket is-open"/);
          assert.match(html, /<aside class="sidebar" data-key="7"/);
          const after = await readSnapshot(page.url);
          assert.equal(after.opened?.key, '7');
          assert.deepEqual(assignees, []);
        },
      );
    });
    scenario('A second activation of the title closes the sidebar', async () => {
      const assignees: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [
            held('7', 'implementing', {repo: 'acme/billing', title: 'Title closes sidebar'}),
          ],
          writeAssignee: (key, login) => {
            assignees.push(`${key}:${login}`);
          },
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '7'}).toString()))
              .status,
            200,
          );
          assert.equal((await readSnapshot(page.url)).opened?.key, '7');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '7'}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          assert.equal(articleOf(html, '7').includes('is-open'), false);
          assert.equal(html.includes('<aside class="sidebar" data-key="7"'), false);
          const after = await readSnapshot(page.url);
          assert.equal(after.opened, undefined);
          assert.deepEqual(assignees, []);
        },
      );
    });
  });
});

spec('drawer', () => {
  requirement('The drawer holds one open cycle', () => {
    scenario('Opening another row closes the previous', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'proposing'), held('2', 'specifying')],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const first = await pageHtml(page.url);
          assert.match(articleOf(first, '1'), /class="ticket is-open"/);
          assert.equal(articleOf(first, '2').includes('is-open'), false);
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '2'}).toString()))
              .status,
            200,
          );
          const second = await pageHtml(page.url);
          assert.match(articleOf(second, '2'), /class="ticket is-open"/);
          assert.equal(articleOf(second, '1').includes('is-open'), false);
          assert.equal(second.match(/class="ticket is-open"/g)?.length, 1);
        },
      );
    });
    scenario('An open row does not narrow its neighbors', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'proposing'), held('2', 'specifying')],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const before = await pageHtml(page.url);
          const neighbor = articleOf(before, '2');
          assert.equal(neighbor.match(/data-station=/g)?.length, 7);
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const after = await pageHtml(page.url);
          assert.equal(articleOf(after, '2'), neighbor);
          assert.match(articleOf(after, '1'), /class="ticket is-open"/);
          assert.match(after, /<aside class="sidebar" data-key="1"/);
          assert.match(after, /\.sidebar\s*\{[^}]*position:\s*fixed/);
          assert.equal(stationOf(after, '1', 'proposing').includes('class="sidebar"'), false);
          assert.match(
            after,
            /\.stations\s*\{[^}]*grid-template-columns:\s*252px repeat\(7, minmax\(0, 1fr\)\)/,
          );
          assert.equal(/\.ticket\.is-open \.station\s*\{[^}]*width/.test(after), false);
        },
      );
    });
    scenario('A second click closes the cycle', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing')]},
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const opened = await pageHtml(page.url);
          assert.match(opened, /<aside class="sidebar" data-key="1"/);
          assert.match(articleOf(opened, '1'), /is-open/);
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const closed = await pageHtml(page.url);
          assert.equal(closed.includes('class="sidebar"'), false);
          assert.equal(articleOf(closed, '1').includes('is-open'), false);
        },
      );
    });
    scenario('The sidebar is a wide drawer', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing')]},
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          assert.match(html, /<aside class="sidebar" data-key="1"/);
          assert.match(
            html,
            /\.sidebar\s*\{[^}]*position:\s*fixed[^}]*right:\s*0[^}]*width:\s*min\(560px, 92vw\)/,
          );
          assert.match(
            html,
            /\.stations\s*\{[^}]*grid-template-columns:\s*252px repeat\(7, minmax\(0, 1fr\)\)/,
          );
        },
      );
    });
  });
});

spec('spine', () => {
  requirement('The spine lists the document rows', () => {
    scenario('The Change row stays out', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing')]},
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const side = bandOf(await pageHtml(page.url), '1');
          assert.equal(side.includes('id="spine-Change"'), false);
          assert.equal(side.includes('Двери читают'), false);
          const planPick = side.match(/id="spine-Plan"[^>]*/)?.[0] ?? '';
          assert.equal(planPick.includes('checked'), false);
        },
      );
    });
  });
  requirement('A document row keeps its focus sentence', () => {
    scenario('A solid sentence stays off the row', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [
            held('1', 'specifying', {
              comments: [{body: 'sdd:focus\nPlan solid\nSpecify thread 4\nCode solid\n'}],
            }),
          ],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          const planHead = spineOf(html, '1', 'Plan').split('<div class="fold">')[0] ?? '';
          const specifyHead = spineOf(html, '1', 'Specify').split('<div class="fold">')[0] ?? '';
          const codeHead = spineOf(html, '1', 'Code').split('<div class="fold">')[0] ?? '';
          assert.equal(planHead.includes('class="sentence"'), false);
          assert.equal(planHead.includes('solid'), false);
          assert.match(specifyHead, /<span class="sentence">thread 4<\/span>/);
          assert.equal(codeHead.includes('class="sentence"'), false);
          assert.equal(codeHead.includes('solid'), false);
        },
      );
    });
  });
  requirement('A row opens only when it has a fold', () => {
    scenario('An empty row stays closed', async () => {
      const quiet = {getAttribute: (name: string) => (name === 'class' ? 'is-quiet' : null)};
      const openRow = {getAttribute: () => null};
      assert.equal(rowHeadOpens(quiet), false);
      assert.equal(rowHeadOpens(openRow), true);
      assert.equal(rowHeadOpens(null), false);
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing')]},
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          const plan = spineOf(html, '1', 'Plan');
          assert.match(plan, /<section class="is-quiet">/);
          assert.equal(/id="spine-Plan"[^>]*checked/.test(plan), false);
          assert.equal(plan.includes('for="spine-Plan"'), false);
          assert.match(
            html,
            /\.spine > section\.is-quiet \.row,\s*\.spine > section\.is-quiet \.layer,\s*\.spine > section\.is-quiet \.rest\s*\{[^}]*cursor:\s*default/,
          );
        },
      );
    });
    scenario('The row head toggles outside its control', async () => {
      const label = {closest: (selector: string) => (selector === 'label' ? label : null)};
      const acts = {closest: (selector: string) => (selector === '.acts' ? acts : null)};
      assert.equal(headClickToggles(label), false);
      assert.equal(headClickToggles(acts), false);
      assert.equal(headClickToggles({closest: () => null}), true);
      assert.equal(headClickToggles(null), false);
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing')]},
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          assert.match(html, /\.spine \.row\s*\{[^}]*cursor:\s*pointer/);
          assert.match(html, /\.spine \.layer\s*\{[^}]*display:\s*flex[^}]*align-items:\s*center/);
        },
      );
    });
    scenario('The open row head sticks', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing')]},
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          assert.match(
            html,
            /\.spine > section:has\(\.spine-pick:checked\) \.row\s*\{[^}]*position:\s*sticky[^}]*top:\s*0[^}]*width:\s*auto[^}]*max-width:\s*none/,
          );
          assert.match(html, /<div class="side-scroll">/);
          assert.equal(bandOf(html, '1').includes('class="top"'), false);
          assert.match(html, /\.spine \.lead\s*\{[^}]*padding:\s*0/);
        },
      );
    });
  });
  requirement('A document row shows its file', () => {
    scenario('The Plan row shows the outcome', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'verifying')]},
        async (page, window, paths) => {
          writeChange(
            paths.arcadia,
            '1',
            'proposal.md',
            '## Outcome\n\nГодность или список проблем.\n\n## Open questions\n\n- [ ] Писать ли имя проверки?\n',
          );
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          const side = bandOf(html, '1');
          assert.match(side, /id="spine-Plan"/);
          assert.match(side, /Годность или список проблем/);
          assert.match(side, /- \[ \] Писать ли имя проверки\?/);
          const codePick = side.match(/id="spine-Code"[^>]*/)?.[0] ?? '';
          assert.equal(codePick.includes('checked'), false);
          assert.equal(
            window.sidebar().some(block => JSON.stringify(block).includes('Годность')),
            false,
          );
        },
      );
    });
    scenario('The Plan row shows every section', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing')]},
        async (page, window, paths) => {
          writeChange(
            paths.arcadia,
            '1',
            'proposal.md',
            [
              '## Scope',
              '',
              'Сайдбар читает план целиком.',
              '',
              'Второй абзац scope остаётся.',
              '',
              '## Out of scope',
              '',
              'Другие слои.',
              '',
            ].join('\n'),
          );
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const side = bandOf(await pageHtml(page.url), '1');
          assert.match(side, /<h3>Scope<\/h3>/);
          assert.match(side, /Сайдбар читает план целиком\./);
          assert.match(side, /Второй абзац scope остаётся\./);
          assert.match(side, /<h3>Out of scope<\/h3>/);
          assert.match(side, /Другие слои\./);
        },
      );
    });
    scenario('A collapsed Plan row shows one outcome line', async () => {
      const proposal = '## Outcome\n\nПервая строка исхода.\n\nВторая строка исхода.\n';
      const focus = {
        comments: [{body: 'sdd:focus\nPlan: Первая строка исхода.\nSpecify: Границы.\n'}],
      };
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'verifying', focus)]},
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'proposal.md', proposal);
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          const side = bandOf(html, '1');
          const planPick = side.match(/id="spine-Plan"[^>]*/)?.[0] ?? '';
          assert.equal(planPick.includes('checked'), false);
          const planHead = spineOf(html, '1', 'Plan').split('<div class="fold">')[0] ?? '';
          assert.match(planHead, /<span class="excerpt">Первая строка исхода\.<\/span>/);
          assert.equal(planHead.includes('class="sentence"'), false);
          assert.equal(planHead.split('Первая строка исхода.').length, 2);
          const specifyHead = spineOf(html, '1', 'Specify').split('<div class="fold">')[0] ?? '';
          assert.match(specifyHead, /<span class="sentence">Границы\.<\/span>/);
          assert.equal(side.includes('<span class="excerpt">Первая строка исхода. Вторая'), false);
          assert.match(side, /Вторая строка исхода\./);
          assert.match(html, /\.spine \.row\s*\{[^}]*align-items:\s*stretch[^}]*max-width:\s*100%/);
          assert.match(html, /\.spine \.excerpt\s*\{[^}]*text-overflow:\s*ellipsis/);
          assert.match(
            html,
            /\.spine > section:has\(\.spine-pick:checked\) \.excerpt\s*\{[^}]*display:\s*none/,
          );
        },
      );
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing', focus)]},
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'proposal.md', proposal);
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const planHead =
            spineOf(await pageHtml(page.url), '1', 'Plan').split(
              '<div class="fold">',
            )[0] ?? '';
          assert.match(planHead, /id="spine-Plan"[^>]*checked/);
          assert.equal(planHead.includes('class="sentence"'), false);
          assert.match(planHead, /<span class="excerpt">Первая строка исхода\.<\/span>/);
        },
      );
    });
    scenario('An empty plan section stays out', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing')]},
        async (page, window, paths) => {
          writeChange(
            paths.arcadia,
            '1',
            'proposal.md',
            '## Scope\n\nСайдбар.\n\n## Constraints\n\n',
          );
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const side = bandOf(await pageHtml(page.url), '1');
          assert.match(side, /<h3>Scope<\/h3>/);
          assert.match(side, /Сайдбар\./);
          assert.equal(side.includes('<h3>Constraints</h3>'), false);
        },
      );
    });
    scenario('Added and Modified are headings', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing')]},
        async (page, window, paths) => {
          writeChange(
            paths.arcadia,
            '1',
            'proposal.md',
            '## Capabilities\n\n### Added\n\n- sidebar План целиком.\n\n### Modified\n\n- board Колонки.\n',
          );
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const side = bandOf(await pageHtml(page.url), '1');
          assert.match(side, /<h4>Added<\/h4>/);
          assert.match(side, /<h4>Modified<\/h4>/);
          assert.equal(side.includes('### Added'), false);
          assert.equal(side.includes('### Modified'), false);
          assert.match(side, /sidebar План целиком\./);
          assert.match(side, /board Колонки\./);
        },
      );
    });
    scenario('An empty Open questions section stays out', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing')]},
        async (page, window, paths) => {
          writeChange(
            paths.arcadia,
            '1',
            'proposal.md',
            '## Outcome\n\nГодность.\n\n## Open questions\n\n',
          );
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const side = bandOf(await pageHtml(page.url), '1');
          assert.match(side, /Годность\./);
          assert.equal(side.includes('Open questions'), false);
        },
      );
    });
    scenario('An open question holds the plan', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing', {openPullRequests: 1})]},
        async (page, window, paths) => {
          writeChange(
            paths.arcadia,
            '1',
            'proposal.md',
            '## Open questions\n\n- [ ] Писать ли имя проверки?\n',
          );
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const side = bandOf(await pageHtml(page.url), '1');
          assert.match(side, /План принимается, когда открытых вопросов не останется\./);
          assert.match(side, /data-question="Писать ли имя проверки\?"/);
        },
      );
    });
    scenario('The Design row shows every section', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'designing')]},
        async (page, window, paths) => {
          writeChange(
            paths.arcadia,
            '1',
            'design.md',
            [
              'До секции.',
              '',
              '## Verification boundary',
              '',
              'Одна проверка.',
              '',
              'Лишнее.',
              '',
              '## Approach',
              '',
              'Один модуль.',
              '',
              '## Notes',
              '',
              'Не показывать.',
              '',
              'Отклонено: второй модуль.',
              '',
              '## Open decisions',
              '',
              '- [ ] имя',
              '',
            ].join('\n'),
          );
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const side = bandOf(await pageHtml(page.url), '1');
          assert.match(side, /Одна проверка/);
          assert.match(side, /Лишнее/);
          assert.match(side, /Один модуль/);
          assert.match(side, /Не показывать/);
          assert.match(side, /Отклонено: второй модуль/);
          assert.match(side, /- \[ \] имя/);
          assert.equal(side.includes('До секции.'), false);
          assert.match(side, /<p class="line"/);
          assert.equal(side.includes(`data-path="${DESIGN_PATH}"`), false);
        },
      );
    });
    scenario('The Code row shows that a diff is present', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'verifying', {diff: true})]},
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const side = bandOf(await pageHtml(page.url), '1');
          assert.match(side, /Diff есть/);
          assert.equal(side.includes('diff --git'), false);
        },
      );
    });
    scenario('The Plan row reads the issue branch', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing')]},
        async (page, window, paths) => {
          const checkout = path.join(paths.arcadia, 'services', 'billing');
          git(checkout, ['init', '-b', 'master']);
          git(checkout, ['config', 'user.email', 'test@example.com']);
          git(checkout, ['config', 'user.name', 'Test']);
          git(checkout, ['add', 'openspec']);
          git(checkout, ['commit', '-m', 'init']);
          git(checkout, ['checkout', '-b', 'sdd/1']);
          writeChange(paths.arcadia, '1', 'proposal.md', '## Outcome\n\nС ветки тикета.\n');
          git(checkout, ['add', 'openspec']);
          git(checkout, ['commit', '-m', 'plan']);
          git(checkout, ['checkout', 'master']);
          writeChange(paths.arcadia, '1', 'proposal.md', '## Outcome\n\nС рабочего дерева.\n');
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const side = bandOf(await pageHtml(page.url), '1');
          assert.match(side, /id="spine-Plan"/);
          assert.match(side, /С ветки тикета/);
          assert.equal(side.includes('С рабочего дерева'), false);
        },
      );
    });
    scenario('An answer is a review comment', async () => {
      const comments: string[] = [];
      const tickets = [held('1', 'verifying', {openPullRequests: 1})];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => tickets,
          commentPull: (_key, body) => {
            comments.push(body);
          },
        },
        async (page, window, paths) => {
          const file = path.join(
            paths.arcadia,
            'services',
            'billing',
            changeDir('1'),
            'proposal.md',
          );
          writeChange(
            paths.arcadia,
            '1',
            'proposal.md',
            '## Open questions\n\n- [ ] Писать ли имя проверки?\n',
          );
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const empty = await post(
            page.url,
            'act',
            new URLSearchParams({
              act: 'answer',
              key: '1',
              question: 'Писать ли имя проверки?',
              reply: '   ',
            }).toString(),
          );
          assert.equal(empty.status, 200);
          assert.match(statusOf(shown(empty.body)), /Ответ пустой/);
          assert.equal((await pageHtml(page.url)).includes('role="status"'), false);
          assert.equal(
            (
              await post(
                page.url,
                'act',
                new URLSearchParams({
                  act: 'answer',
                  key: '1',
                  question: 'Писать ли имя проверки?',
                  reply: 'Да, короткое имя.',
                }).toString(),
              )
            ).status,
            200,
          );
          assert.deepEqual(comments, ['- [ ] Писать ли имя проверки?\n\nДа, короткое имя.']);
          assert.match(readFileSync(file, 'utf8'), /- \[ \] Писать ли имя проверки\?/);
          assert.equal((await pageHtml(page.url)).includes('role="status"'), false);
        },
      );
    });
  });
});

spec('line-field', () => {
  requirement('A line field opens on a document line', () => {
    scenario('A typed line comment stays when another line opens', () => {
      assert.deepEqual(draftsAfterClick([{line: 'первая', text: 'черновик'}], 'вторая'), [
        {line: 'первая', text: 'черновик'},
        {line: 'вторая', text: ''},
      ]);
    });
    scenario('An empty line field closes when another line opens', () => {
      assert.deepEqual(draftsAfterClick([{line: 'первая', text: '   '}], 'вторая'), [
        {line: 'вторая', text: ''},
      ]);
    });
    scenario('An empty line field closes when its line is clicked again', () => {
      assert.deepEqual(draftsAfterClick([{line: 'первая', text: ''}], 'первая'), []);
      assert.deepEqual(draftsAfterClick([{line: 'первая', text: '  '}], 'первая'), []);
    });
    scenario('A typed line comment stays when its line is clicked again', () => {
      assert.deepEqual(draftsAfterClick([{line: 'первая', text: 'черновик'}], 'первая'), [
        {line: 'первая', text: 'черновик'},
      ]);
    });
    scenario('A line field uses the pool frame', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing', {openPullRequests: 1})]},
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'proposal.md', '## Scope\n\nСтрока.\n');
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          assert.match(html, /\.spine form\.line-note\s*\{[^}]*margin:\s*18px 10px 8px/);
          assert.match(html, /\.spine \.plan-foot\s*\{[^}]*margin:\s*10px 10px 8px/);
          assert.match(html, /\.spine \.plan-foot form\s*\{[^}]*margin:\s*0/);
          assert.match(
            html,
            /\.spine button\.line\s*\{[^}]*margin:\s*-4px -8px[^}]*padding:\s*4px 8px[^}]*border-radius:\s*8px/,
          );
          assert.match(
            html,
            /\.spine form\.line-note textarea,\s*\.spine \.plan-foot textarea\s*\{[^}]*padding:\s*8px 8px 28px[^}]*border-radius:\s*8px/,
          );
          assert.match(
            html,
            /\.spine form\.line-note textarea:focus,\s*\.spine \.plan-foot textarea:focus\s*\{[^}]*rgba\(230, 179, 90, 0\.45\)/,
          );
          assert.match(html, /\.spine \.shut\s*\{[^}]*border-radius:\s*50%/);
          assert.match(bandOf(html, '1'), /class="shut"[^>]*aria-label="Закрыть"/);
          assert.match(bandOf(html, '1'), /class="send"[^>]*aria-label="Записать"/);
        },
      );
    });
    scenario('A hovered line draws no bar on the left', () => {
      const css = readFileSync(new URL('./face.css', import.meta.url), 'utf8');
      assert.match(
        css,
        /\.spine button\.line:hover,\s*\.spine button\.line\.is-on\s*\{[^}]*background-image:/,
      );
      assert.doesNotMatch(
        css,
        /\.spine button\.line:hover,\s*\.spine button\.line\.is-on\s*\{[^}]*inset\s+3px/,
      );
    });
    scenario('Escape closes the line field', () => {
      assert.equal(lineFieldClosesOnEscape('Escape', true), true);
      assert.equal(lineFieldClosesOnEscape('Escape', false), false);
      assert.equal(lineFieldClosesOnEscape('Enter', true), false);
    });
  });
  requirement('A document remark is a review comment', () => {
    scenario('A remark on the plan is a review comment', async () => {
      const comments: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'proposing', {openPullRequests: 1})],
          commentPull: (_key, body) => {
            comments.push(body);
          },
        },
        async (page, window, paths) => {
          writeChange(
            paths.arcadia,
            '1',
            'proposal.md',
            '## Outcome\n\nГодность.\n\n## Open questions\n',
          );
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          assert.match(
            bandOf(await pageHtml(page.url), '1'),
            /<label class="draft">Комментарий/,
          );
          assert.equal(
            (
              await post(
                page.url,
                'act',
                new URLSearchParams({
                  act: 'answer',
                  key: '1',
                  reply: 'Сначала сократить Outcome.',
                }).toString(),
              )
            ).status,
            200,
          );
          assert.deepEqual(comments, ['Сначала сократить Outcome.']);
        },
      );
    });
  });
});

spec('acceptance', () => {
  requirement('The current phase offers acceptance in place of its gate', () => {
    scenario('The current phase shows acceptance instead of its gate', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing', {openPullRequests: 1})]},
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'proposal.md', '## Outcome\n\nГодность.\n');
          writeChange(paths.arcadia, '1', 'design.md', '# design\n');
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          const plan = spineOf(html, '1', 'Plan');
          assert.match(plan, /aria-label="Принять Plan"/);
          assert.match(
            html,
            /\.spine form\.accept \.cmd\s*\{[^}]*border-radius:\s*8px[^}]*padding:\s*4px 10px[^}]*font-size:\s*12px/,
          );
          assert.match(html, /\.plaque\s*\{[^}]*border-radius:\s*8px/);
          assert.equal(plan.includes('data-gate="proposing"'), false);
          assert.match(glineOf(html, '1', 'designing'), /гейт designing/);
        },
      );
    });
    scenario("An open question leaves the current gate's place empty", async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing', {openPullRequests: 1})]},
        async (page, window, paths) => {
          writeChange(
            paths.arcadia,
            '1',
            'proposal.md',
            '## Open questions\n\n- [ ] Писать ли имя проверки?\n',
          );
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const plan = spineOf(await pageHtml(page.url), '1', 'Plan');
          assert.equal(plan.includes('Принять Plan'), false);
          assert.equal(plan.includes('data-gate="proposing"'), false);
        },
      );
    });
    scenario('An empty delta offers acceptance', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying', {openPullRequests: 1})]},
        async (page, window, paths) => {
          writeChange(
            paths.arcadia,
            '1',
            'specs/section-text/spec.md',
            '## Purpose\n\nNo requirement yet.\n',
          );
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const specify = spineOf(await pageHtml(page.url), '1', 'Specify');
          assert.match(specify, /aria-label="Принять Specify"/);
          assert.equal(specify.includes('data-gate="specifying"'), false);
        },
      );
    });
    scenario('A spec turn hides acceptance', async () => {
      for (const action of ['restore-baseline', 'create-initial-specs', 'improve-specs']) {
        await hosted(
          {
            login: () => MANAGER,
            tickets: () => [held('1', 'specifying', {openPullRequests: 1})],
            turn: () => action,
          },
          async (page, window, paths) => {
            writeChange(paths.arcadia, '1', 'specs/section-text/spec.md', deltaRequirement());
            window.chooseAgent('cursor');
            assert.equal(
              (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
                .status,
              200,
            );
            const specify = spineOf(await pageHtml(page.url), '1', 'Specify');
            assert.equal(specify.includes('Принять Specify'), false, action);
            assert.equal(specify.includes('data-gate="specifying"'), false, action);
          },
        );
      }
    });
    scenario('A proposal with no capability offers acceptance', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying', {openPullRequests: 1})]},
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'proposal.md', '## Outcome\n\nНичего менять не нужно.\n');
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const specify = spineOf(await pageHtml(page.url), '1', 'Specify');
          assert.match(specify, /aria-label="Принять Specify"/);
          assert.equal(specify.includes('data-gate="specifying"'), false);
        },
      );
    });
    scenario('A named capability without a delta leaves the place empty', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying', {openPullRequests: 1})]},
        async (page, window, paths) => {
          const baseline = path.join(
            paths.arcadia,
            'services',
            'billing',
            'openspec',
            'specs',
            'section-text',
            'spec.md',
          );
          mkdirSync(path.dirname(baseline), {recursive: true});
          writeFileSync(baseline, deltaRequirement());
          writeChange(
            paths.arcadia,
            '1',
            'proposal.md',
            '## Capabilities\n\n### Added\n\n- section-text the row\n',
          );
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const specify = spineOf(await pageHtml(page.url), '1', 'Specify');
          assert.equal(specify.includes('Принять Specify'), false);
          assert.equal(specify.includes('data-gate="specifying"'), false);
        },
      );
    });
    scenario('A missing baseline leaves the place empty', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying', {openPullRequests: 1})]},
        async (page, window, paths) => {
          writeChange(
            paths.arcadia,
            '1',
            'proposal.md',
            '## Capabilities\n\n### Modified\n\n- section-text the row\n',
          );
          writeChange(paths.arcadia, '1', 'specs/section-text/spec.md', deltaRequirement());
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const specify = spineOf(await pageHtml(page.url), '1', 'Specify');
          assert.equal(specify.includes('Принять Specify'), false);
          assert.equal(specify.includes('data-gate="specifying"'), false);
        },
      );
    });
  });
  requirement('Accepting a writing phase adds its label', () => {
    scenario('Accepting the plan adds proposed', async () => {
      const tickets = [held('1', 'proposing', {openPullRequests: 1})];
      const phases: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => tickets,
          writePhase: (_key, phase) => {
            phases.push(phase);
          },
          editLabels: (_key, add, remove) => {
            const item = tickets[0];
            if (!item) {
              return;
            }
            item.labels = item.labels.filter(label => !remove?.includes(label));
            for (const label of add) {
              if (!item.labels.includes(label)) {
                item.labels = [...item.labels, label];
              }
            }
          },
        },
        async (page, window, paths) => {
          writeChange(
            paths.arcadia,
            '1',
            'proposal.md',
            '## Open questions\n\n- [ ] Писать ли имя проверки?\n',
          );
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const asking = bandOf(await pageHtml(page.url), '1');
          assert.match(asking, /<label class="draft">Комментарий/);
          assert.equal(asking.includes('Принять Plan'), false);
          writeChange(paths.arcadia, '1', 'proposal.md', '## Outcome\n\nГодность.\n');
          page.note();
          const side = bandOf(await pageHtml(page.url), '1');
          assert.match(side, /aria-label="Принять Plan"/);
          assert.equal(
            (
              await post(
                page.url,
                'act',
                new URLSearchParams({act: 'accept-review', key: '1'}).toString(),
              )
            ).status,
            200,
          );
          assert.ok(tickets[0]?.labels.includes('sdd:proposed'));
          assert.ok(tickets[0]?.labels.includes('sdd:proposing'));
          assert.deepEqual(phases, []);
          assert.equal((await pageHtml(page.url)).includes('role="status"'), false);
        },
      );
    });
    scenario('Accepting the spec adds specified', async () => {
      const tickets = [held('1', 'specifying', {openPullRequests: 1})];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => tickets,
          editLabels: (_key, add, remove) => {
            const item = tickets[0];
            if (!item) {
              return;
            }
            item.labels = item.labels.filter(label => !remove?.includes(label));
            for (const label of add) {
              if (!item.labels.includes(label)) {
                item.labels = [...item.labels, label];
              }
            }
          },
        },
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'specs/section-text/spec.md', deltaRequirement());
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          assert.match(bandOf(await pageHtml(page.url), '1'), /Принять Specify/);
          assert.equal(
            (
              await post(
                page.url,
                'act',
                new URLSearchParams({act: 'accept-review', key: '1'}).toString(),
              )
            ).status,
            200,
          );
          assert.ok(tickets[0]?.labels.includes('sdd:specified'));
          assert.ok(tickets[0]?.labels.includes('sdd:specifying'));
        },
      );
    });
    scenario('Accepting the design adds designed', async () => {
      const tickets = [held('1', 'designing', {openPullRequests: 1})];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => tickets,
          editLabels: (_key, add, remove) => {
            const item = tickets[0];
            if (!item) {
              return;
            }
            item.labels = item.labels.filter(label => !remove?.includes(label));
            for (const label of add) {
              if (!item.labels.includes(label)) {
                item.labels = [...item.labels, label];
              }
            }
          },
        },
        async (page, window, paths) => {
          writeChange(
            paths.arcadia,
            '1',
            'design.md',
            '## Approach\n\nОдин модуль.\n\n## Open decisions\n',
          );
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          assert.match(bandOf(await pageHtml(page.url), '1'), /Принять Design/);
          assert.equal(
            (
              await post(
                page.url,
                'act',
                new URLSearchParams({act: 'accept-review', key: '1'}).toString(),
              )
            ).status,
            200,
          );
          assert.ok(tickets[0]?.labels.includes('sdd:designed'));
          assert.ok(tickets[0]?.labels.includes('sdd:designing'));
        },
      );
    });
  });
});

spec('auto-gate', () => {
  requirement('The open row shows three gate lines', () => {
    scenario('A passed gate is controlled from the sidebar', async () => {
      const tickets = [
        held('1', 'implementing', {
          labels: ['sdd:cycle', 'sdd:implementing', 'sdd:auto-plan'],
        }),
      ];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => tickets,
          editLabels: (_key, add, remove) => {
            const item = tickets[0];
            if (!item) {
              return;
            }
            item.labels = item.labels.filter(label => !remove?.includes(label));
            for (const label of add) {
              if (!item.labels.includes(label)) {
                item.labels = [...item.labels, label];
              }
            }
          },
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const closed = await pageHtml(page.url);
          assert.match(stationOf(closed, '1', 'proposing'), /<span class="dot"/);
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          const line = glineOf(html, '1', 'proposing');
          assert.match(line, /aria-label="Поставить гейт proposing"/);
          assert.match(html, /\.tick\s*\{[^}]*width:\s*12px/);
          assert.match(html, /\.stop\s*\{[^}]*width:\s*18px/);
          assert.equal(line.includes('>Поставить'), false);
          assert.equal(line.includes('>Снять'), false);
          const posted = await post(
            page.url,
            'act',
            new URLSearchParams({
              act: 'gate',
              key: '1',
              station: 'proposing',
              where: 'side',
            }).toString(),
          );
          assert.equal(posted.status, 200);
          assert.equal(tickets[0]?.labels.includes('sdd:auto-plan'), false);
        },
      );
    });
    scenario('A future gate repeats the station button', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing')]},
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'design.md', '# design\n');
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          assert.match(glineOf(html, '1', 'designing'), /гейт designing/);
          assert.match(html, /\.stop\s*\{[^}]*width:\s*18px[^}]*height:\s*18px/);
          assert.match(html, /\.stop svg\s*\{[^}]*width:\s*18px[^}]*height:\s*18px/);
          assert.match(stationOf(html, '1', 'designing'), /aria-label="design"/);
          assert.equal(stationOf(html, '1', 'designing').includes('гейт'), false);
        },
      );
    });
  });
});

spec('settings', () => {
  requirement('Settings are two blocks and do not open themselves', () => {
    scenario('The settings sheet has one close button', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [bare('1', 'Quiet')]},
        async (page, window) => {
          window.chooseAgent('cursor');
          const closed = await pageHtml(page.url);
          assert.equal(closed.includes('role="dialog"'), false);
          assert.match(closed, /name="act" value="open-settings"/);
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open-settings'}).toString()))
              .status,
            200,
          );
          const sheet = await pageHtml(page.url);
          assert.match(sheet, /role="dialog" aria-label="Настройки"/);
          assert.equal(sheet.match(/value="close-settings"/g)?.length, 1);
          assert.match(sheet, /aria-label="Закрыть"/);
          assert.equal(/>\s*Закрыть\s*</.test(sheet), false);
          assert.match(sheet, /name="act" value="open-settings"/);
        },
      );
    });
  });
});

spec('spec-diff', () => {
  requirement('A line comment uses a thread when the line has an anchor', () => {
    scenario('A plan line opens a thread', async () => {
      const line = 'Сайдбар читает ветку.';
      const reply = 'Здесь узко.';
      const proposal = '## Scope\n\nСайдбар читает ветку.\n';
      const threads: {key: string; body: string; place: ThreadPlace}[] = [];
      const comments: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'proposing', {openPullRequests: 1})],
          commentPull: (_key, body) => {
            comments.push(body);
          },
          threadPull: async (key, body, place) => {
            threads.push({key, body, place});
          },
        },
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'proposal.md', proposal);
          await showCard(page, window);
          const html = await pageHtml(page.url);
          const button = lineButton(html, line);
          const at = sourceLine(proposal, line);
          assert.equal(at, 3);
          assert.equal(button.includes(`data-path="${PROPOSAL_PATH}"`), true);
          assert.equal(button.includes(`data-at="${at}"`), true);
          assert.equal(button.includes('data-side="right"'), true);
          assert.match(html, /\.spine button\.line:hover/);
          assert.equal(
            (
              await post(
                page.url,
                'act',
                answerFields({
                  line,
                  reply,
                  path: PROPOSAL_PATH,
                  at: String(at),
                  side: 'right',
                }),
              )
            ).status,
            200,
          );
          assert.deepEqual(threads, [
            {key: '1', body: reply, place: {path: PROPOSAL_PATH, line: at, side: 'right'}},
          ]);
          assert.deepEqual(comments, []);
        },
      );
    });
    scenario('A design line opens a thread', async () => {
      const line = 'Один модуль.';
      const reply = 'Здесь узко.';
      const design = '## Approach\n\nОдин модуль.\n';
      const threads: {key: string; body: string; place: ThreadPlace}[] = [];
      const comments: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'designing', {openPullRequests: 1})],
          commentPull: (_key, body) => {
            comments.push(body);
          },
          threadPull: async (key, body, place) => {
            threads.push({key, body, place});
          },
        },
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'design.md', design);
          await showCard(page, window);
          const html = await pageHtml(page.url);
          const button = lineButton(html, line);
          const at = sourceLine(design, line);
          assert.equal(at, 3);
          assert.equal(button.includes(`data-path="${DESIGN_PATH}"`), true);
          assert.equal(button.includes(`data-at="${at}"`), true);
          assert.equal(button.includes('data-side="right"'), true);
          assert.equal(
            (
              await post(
                page.url,
                'act',
                answerFields({
                  line,
                  reply,
                  path: DESIGN_PATH,
                  at: String(at),
                  side: 'right',
                }),
              )
            ).status,
            200,
          );
          assert.equal(threads[0]?.place.path, DESIGN_PATH);
          assert.deepEqual(threads, [
            {key: '1', body: reply, place: {path: DESIGN_PATH, line: at, side: 'right'}},
          ]);
          assert.deepEqual(comments, []);
        },
      );
    });
  });
});

spec('role', () => {
  requirement("Verbs list this manager's roles", () => {
    scenario('A closed row has no verbs', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'proposing'), held('2', 'specifying')],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          window.addRole({name: 'Page', outcome: 'html', text: '<p>страница</p>'});
          const closed = await pageHtml(page.url);
          assert.equal(articleOf(closed, '1').includes('class="verb"'), false);
          assert.equal(articleOf(closed, '2').includes('class="verb"'), false);
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          const verb = bandOf(html, '1');
          assert.match(verb, /Page/);
          assert.match(verb, /html/);
          assert.equal(articleOf(html, '2').includes('class="verb"'), false);
          assert.equal(articleOf(html, '2').includes('class="band"'), false);
        },
      );
    });
  });
});

const SPEC_ID = 'case-read';
const DELTA_PATH = 'openspec/changes/issue-1/specs/case-read/spec.md';
const PROPOSAL_PATH = 'openspec/changes/issue-1/proposal.md';
const DESIGN_PATH = 'openspec/changes/issue-1/design.md';

type ThreadPlace = {path: string; line: number; side: 'right' | 'left'};

function specText(lines: readonly string[]): string {
  return `${lines.join('\n')}\n`;
}

function sourceLine(source: string, needle: string): number {
  const index = source.split('\n').findIndex(line => line === needle);
  assert.notEqual(index, -1, needle);
  return index + 1;
}

function writeBaseline(arcadia: string, id: string, body: string): void {
  const file = path.join(arcadia, 'services', 'billing', 'openspec', 'specs', id, 'spec.md');
  mkdirSync(path.dirname(file), {recursive: true});
  writeFileSync(file, body);
}

async function showCard(page: {url: string}, window: ReturnType<typeof openWindow>): Promise<void> {
  window.chooseAgent('cursor');
  assert.equal(
    (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString())).status,
    200,
  );
}

async function drawSpec(
  page: {url: string},
  window: ReturnType<typeof openWindow>,
  arcadia: string,
  delta: string,
  baseline?: string,
): Promise<{shot: WindowSnapshot; html: string}> {
  if (baseline !== undefined) {
    writeBaseline(arcadia, SPEC_ID, baseline);
  }
  writeChange(arcadia, '1', `specs/${SPEC_ID}/spec.md`, delta);
  await showCard(page, window);
  const shot = await readSnapshot(page.url);
  return {shot, html: renderWindow(shot)};
}

function specView(shot: WindowSnapshot, id: string) {
  const cap = shot.opened?.spine.capabilities.find(item => item.id === id);
  assert.ok(cap, id);
  const flat = cap.rows.flatMap(entry => (entry.kind === 'gap' ? entry.hidden : [entry]));
  const gaps = cap.rows.flatMap(entry => (entry.kind === 'gap' ? [entry] : []));
  return {cap, flat, gaps};
}

function capHtml(html: string, id: string): string {
  const marker = `id="cap-${id}"`;
  const at = html.indexOf(marker);
  assert.ok(at >= 0, marker);
  const start = html.lastIndexOf('<details', at);
  const end = html.indexOf('</details>', at);
  assert.ok(end > start);
  return html.slice(start, end);
}

function summaryHtml(html: string, id: string): string {
  const cap = capHtml(html, id);
  const start = cap.indexOf('<summary>');
  const end = cap.indexOf('</summary>');
  assert.ok(end > start);
  return cap.slice(start, end + '</summary>'.length);
}

function assertNoSpineBadge(html: string): void {
  const row = spineOf(html, '1', 'Specify').split('<div class="fold">')[0] ?? '';
  assert.equal(row.includes('class="badge"'), false);
}

function assertBadge(html: string, id: string, badge: string | undefined): void {
  assertNoSpineBadge(html);
  const summary = summaryHtml(html, id);
  if (badge === undefined) {
    assert.equal(summary.includes('class="badge"'), false);
    return;
  }
  assert.match(summary, new RegExp(`<span class="badge">${badge}</span>`));
}

function diffBlock(html: string, id: string, kind: string, text: string): string {
  const chunks = capHtml(html, id).split('<div class="diff-row ').slice(1);
  const found = chunks.find(chunk => chunk.startsWith(kind) && chunk.includes(text));
  assert.ok(found, `${kind} ${text}`);
  return found;
}

function numCells(block: string): string[] {
  return [...block.matchAll(/<span class="num">([^<]*)<\/span>/g)].map(match => match[1] ?? '');
}

function lineButton(html: string, line: string): string {
  const marker = `data-line="${line}"`;
  const at = html.indexOf(marker);
  assert.ok(at >= 0, marker);
  const start = html.lastIndexOf('<button', at);
  return html.slice(start, html.indexOf('>', at) + 1);
}

function answerFields(fields: Record<string, string>): string {
  return new URLSearchParams({act: 'answer', key: '1', ...fields}).toString();
}

function replacedLines(): {baseline: string; delta: string; oldLine: string; newLine: string} {
  const oldLine = 'Старый текст.';
  const newLine = 'Новый текст.';
  return {
    oldLine,
    newLine,
    baseline: specText(['### Requirement: Чтение', '', oldLine]),
    delta: specText(['## MODIFIED Requirements', '', '### Requirement: Чтение', '', newLine]),
  };
}

spec('spec-diff', () => {
  requirement('A capability carries one badge', () => {
    scenario('A modified requirement is changed', async () => {
      const {baseline, delta} = replacedLines();
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying')]},
        async (page, window, paths) => {
          const {shot, html} = await drawSpec(page, window, paths.arcadia, delta, baseline);
          assert.equal(specView(shot, SPEC_ID).cap.badge, 'changed');
          assertBadge(html, SPEC_ID, 'changed');
        },
      );
    });
    scenario('A spec with no baseline is new', async () => {
      const lines = ['### Requirement: Чтение', '', 'Текст.'];
      const delta = specText(['## ADDED Requirements', '', ...lines]);
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying')]},
        async (page, window, paths) => {
          const {shot, html} = await drawSpec(page, window, paths.arcadia, delta);
          const view = specView(shot, SPEC_ID);
          assert.equal(view.cap.badge, 'new');
          assert.deepEqual(
            view.flat.map(row => row.text),
            lines,
          );
          assert.ok(view.flat.every(row => row.kind === 'add'));
          assertBadge(html, SPEC_ID, 'new');
        },
      );
    });
    scenario('An empty fold is removed', async () => {
      const lines = ['### Requirement: Чтение', '', 'Текст.'];
      const baseline = specText(lines);
      const delta = specText(['## REMOVED Requirements', '', '### Requirement: Чтение']);
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying')]},
        async (page, window, paths) => {
          const {shot, html} = await drawSpec(page, window, paths.arcadia, delta, baseline);
          const view = specView(shot, SPEC_ID);
          assert.equal(view.cap.badge, 'removed');
          assert.deepEqual(
            view.flat.map(row => row.text),
            lines,
          );
          assert.ok(view.flat.every(row => row.kind === 'del'));
          assertBadge(html, SPEC_ID, 'removed');
        },
      );
    });
    scenario('The same text has no badge', async () => {
      const lines = ['### Requirement: Чтение', '', 'Текст.'];
      const baseline = specText(lines);
      const delta = specText(['## MODIFIED Requirements', '', ...lines]);
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying')]},
        async (page, window, paths) => {
          const {shot, html} = await drawSpec(page, window, paths.arcadia, delta, baseline);
          const view = specView(shot, SPEC_ID);
          assert.equal(view.cap.badge, undefined);
          assert.ok(view.flat.length > 0);
          assert.ok(view.flat.every(row => row.kind === 'ctx'));
          const cap = capHtml(html, SPEC_ID);
          assert.equal(cap.includes('class="diff-row add"'), false);
          assert.equal(cap.includes('class="diff-row del"'), false);
          assertBadge(html, SPEC_ID, undefined);
        },
      );
    });
  });

  requirement('The drawer shows the folded spec', () => {
    scenario('A changed line shows both numbers and the changed words', async () => {
      const oldLine = 'Старый текст требования.';
      const newLine = 'Новый текст требования.';
      const baseline = specText(['### Requirement: Чтение', '', oldLine]);
      const folded = specText(['### Requirement: Чтение', '', newLine]);
      const delta = specText([
        '## MODIFIED Requirements',
        '',
        '### Requirement: Чтение',
        '',
        newLine,
      ]);
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying')]},
        async (page, window, paths) => {
          const {html} = await drawSpec(page, window, paths.arcadia, delta, baseline);
          const left = String(sourceLine(baseline, oldLine));
          const right = String(sourceLine(folded, newLine));
          const deletion = diffBlock(html, SPEC_ID, 'del', 'class="bit">Старый');
          const addition = diffBlock(html, SPEC_ID, 'add', 'class="bit">Новый');
          assert.deepEqual(numCells(deletion).slice(0, 2), [left, '']);
          assert.deepEqual(numCells(addition).slice(0, 2), ['', right]);
          assert.match(deletion, /<span class="bit">Старый<\/span>/);
          assert.match(addition, /<span class="bit">Новый<\/span>/);
          assert.match(deletion, /<span>текст<\/span>/);
          assert.match(addition, /<span>текст<\/span>/);
        },
      );
    });
    scenario('Unchanged lines between hunks sit in the gap', async () => {
      const between = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9', 'u10'];
      const baseline = specText(['### Requirement: Чтение', 'head-old', ...between, 'tail-old']);
      const delta = specText([
        '## MODIFIED Requirements',
        '',
        '### Requirement: Чтение',
        'head-new',
        ...between,
        'tail-new',
      ]);
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying')]},
        async (page, window, paths) => {
          const {shot} = await drawSpec(page, window, paths.arcadia, delta, baseline);
          const {gaps} = specView(shot, SPEC_ID);
          assert.equal(gaps.length, 1);
          const gap = gaps[0];
          assert.ok(gap);
          assert.deepEqual(
            gap.hidden.map(row => row.text),
            ['u4', 'u5', 'u6', 'u7'],
          );
        },
      );
    });
    scenario('Lines before the first change sit in a gap', async () => {
      const baseline = specText([
        '### Requirement: Чтение',
        'k1',
        'k2',
        'k3',
        'k4',
        'k5',
        'k6',
        'k7',
        'old-end',
      ]);
      const delta = specText([
        '## MODIFIED Requirements',
        '',
        '### Requirement: Чтение',
        'k1',
        'k2',
        'k3',
        'k4',
        'k5',
        'k6',
        'k7',
        'new-end',
      ]);
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying')]},
        async (page, window, paths) => {
          const {shot} = await drawSpec(page, window, paths.arcadia, delta, baseline);
          const {cap, gaps} = specView(shot, SPEC_ID);
          assert.equal(gaps.length, 1);
          const gap = gaps[0];
          assert.ok(gap);
          assert.deepEqual(
            gap.hidden.map(row => row.text),
            ['### Requirement: Чтение', 'k1', 'k2', 'k3', 'k4'],
          );
          const visible: string[] = [];
          for (const entry of cap.rows) {
            if (entry.kind === 'gap') {
              continue;
            }
            visible.push(entry.text);
          }
          assert.equal(visible.includes('k5'), true);
          assert.equal(visible.includes('k6'), true);
          assert.equal(visible.includes('k7'), true);
          assert.equal(visible.includes('k1'), false);
          assert.equal(visible.includes('k4'), false);
        },
      );
    });
    scenario('Added text keeps the purpose and drops the delta heading', async () => {
      const baseline = specText([
        '## Purpose',
        '',
        'Зачем эта возможность.',
        '',
        '## Requirements',
        '',
        '### Requirement: Есть',
        '',
        'Текст.',
      ]);
      const delta = specText([
        '## ADDED Requirements',
        '',
        '### Requirement: Новое',
        '',
        'Дописано.',
      ]);
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying')]},
        async (page, window, paths) => {
          const {shot, html} = await drawSpec(page, window, paths.arcadia, delta, baseline);
          const texts = specView(shot, SPEC_ID).flat.map(row => row.text);
          assert.equal(texts.includes('Зачем эта возможность.'), true);
          assert.equal(texts.includes('### Requirement: Новое'), true);
          assert.equal(texts.includes('Дописано.'), true);
          assert.equal(
            texts.some(text => text.includes('ADDED')),
            false,
          );
          assert.equal(capHtml(html, SPEC_ID).includes('ADDED'), false);
        },
      );
    });
  });

  requirement('The drawer shows the folded spec', () => {
    scenario('Earlier scenarios fold up to the requirement heading', async () => {
      const body = [
        '### Requirement: Чтение',
        'Тело требования.',
        '#### Scenario: Первый',
        '- **WHEN** первый',
        '- **THEN** первый',
        '#### Scenario: Второй',
        '- **WHEN** второй',
        '- **THEN** было',
      ];
      const baseline = specText(body);
      const delta = specText([
        '## MODIFIED Requirements',
        '',
        ...body.slice(0, -1),
        '- **THEN** стало',
      ]);
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying')]},
        async (page, window, paths) => {
          const {shot} = await drawSpec(page, window, paths.arcadia, delta, baseline);
          const {cap, gaps} = specView(shot, SPEC_ID);
          const visible = cap.rows.flatMap(entry => (entry.kind === 'gap' ? [] : [entry.text]));
          assert.deepEqual(visible, [
            '### Requirement: Чтение',
            '#### Scenario: Второй',
            '- **WHEN** второй',
            '- **THEN** было',
            '- **THEN** стало',
          ]);
          assert.equal(gaps.length, 1);
          assert.deepEqual(gaps[0]?.hidden.map(row => row.text), [
            'Тело требования.',
            '#### Scenario: Первый',
            '- **WHEN** первый',
            '- **THEN** первый',
          ]);
        },
      );
    });
  });

  requirement('The fold control sits apart from the spec text', () => {
    scenario('The fold control is centered and the list has no rule above it', () => {
      const css = readFileSync(new URL('./face.css', import.meta.url), 'utf8');
      assert.match(css, /\.spine button\.fold-bar \{[^}]*text-align: center/);
      assert.match(css, /\.spine \.fold > \.cap:first-child \{[^}]*border-top: 0/);
      assert.match(css, /\.spine button\.diff-row:hover/);
    });
    scenario('A diff row hover has no left bar', () => {
      const css = readFileSync(new URL('./face.css', import.meta.url), 'utf8');
      assert.match(
        css,
        /\.spine button\.diff-row:hover,\s*\.spine button\.diff-row\.is-on\s*\{[^}]*background-image:/,
      );
      assert.doesNotMatch(
        css,
        /\.spine button\.diff-row:hover,\s*\.spine button\.diff-row\.is-on\s*\{[^}]*inset\s+3px/,
      );
    });
  });

  requirement('A line comment uses a thread when the line has an anchor', () => {
    scenario('A line copied from the delta opens a thread', async () => {
      const {baseline, delta, newLine} = replacedLines();
      const reply = 'Смотрите сюда.';
      const threads: {key: string; body: string; place: ThreadPlace}[] = [];
      const comments: string[] = [];
      const spoken: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'specifying', {openPullRequests: 1})],
          commentPull: (_key, body) => {
            comments.push(body);
          },
          threadPull: async (key, body, place) => {
            threads.push({key, body, place});
          },
          speakPull: async (_key, body) => {
            spoken.push(body);
          },
        },
        async (page, window, paths) => {
          const {shot, html} = await drawSpec(page, window, paths.arcadia, delta, baseline);
          const added = specView(shot, SPEC_ID).flat.find(
            row => row.kind === 'add' && row.text === newLine,
          );
          assert.ok(added);
          assert.ok(added.anchor);
          assert.equal(added.anchor.path, DELTA_PATH);
          assert.equal(added.anchor.side, 'right');
          assert.equal(added.anchor.line, sourceLine(delta, newLine));
          assert.notEqual(added.anchor.line, added.right);
          const button = lineButton(html, newLine);
          assert.equal(button.includes(`data-path="${DELTA_PATH}"`), true);
          assert.equal(button.includes(`data-at="${added.anchor.line}"`), true);
          assert.equal(button.includes('data-side="right"'), true);
          const rowStart = html.lastIndexOf('<button', html.indexOf(`data-line="${newLine}"`));
          const row = html.slice(rowStart, html.indexOf('</button>', rowStart));
          assert.match(row, /class="diff-row /);
          assert.match(row, /class="num"/);
          assert.equal(
            (
              await post(
                page.url,
                'act',
                answerFields({
                  line: newLine,
                  reply,
                  path: added.anchor.path,
                  at: String(added.anchor.line),
                  side: added.anchor.side,
                }),
              )
            ).status,
            200,
          );
          assert.deepEqual(threads, [
            {
              key: '1',
              body: reply,
              place: {path: DELTA_PATH, line: added.anchor.line, side: 'right'},
            },
          ]);
          assert.deepEqual(comments, []);
          assert.deepEqual(spoken, []);
        },
      );
    });
    scenario('A baseline line quotes the pull request', async () => {
      const {baseline, delta, oldLine} = replacedLines();
      const reply = 'Здесь узко.';
      const threads: ThreadPlace[] = [];
      const comments: string[] = [];
      const spoken: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'specifying', {openPullRequests: 1})],
          commentPull: (_key, body) => {
            comments.push(body);
          },
          threadPull: async (_key, _body, place) => {
            threads.push(place);
          },
          speakPull: async (_key, body) => {
            spoken.push(body);
          },
        },
        async (page, window, paths) => {
          const {shot, html} = await drawSpec(page, window, paths.arcadia, delta, baseline);
          const visible = specView(shot, SPEC_ID).flat.find(
            row => row.kind === 'del' && row.text === oldLine,
          );
          assert.ok(visible);
          assert.equal(visible.anchor, undefined);
          const button = lineButton(html, oldLine);
          assert.equal(button.includes('data-path='), false);
          assert.equal(
            (
              await post(
                page.url,
                'act',
                answerFields({
                  line: oldLine,
                  reply,
                }),
              )
            ).status,
            200,
          );
          assert.deepEqual([...comments, ...spoken], [`> ${oldLine}\n\n${reply}`]);
          assert.deepEqual(threads, []);
        },
      );
    });
    scenario('A refused thread is quoted', async () => {
      const {baseline, delta, newLine} = replacedLines();
      const reply = 'Смотрите сюда.';
      const spoken: string[] = [];
      let threadCalls = 0;
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'specifying', {openPullRequests: 1})],
          threadPull: async () => {
            threadCalls += 1;
            throw new Error('host refused the thread');
          },
          speakPull: async (_key, body) => {
            spoken.push(body);
          },
        },
        async (page, window, paths) => {
          const {shot} = await drawSpec(page, window, paths.arcadia, delta, baseline);
          const added = specView(shot, SPEC_ID).flat.find(
            row => row.kind === 'add' && row.text === newLine,
          );
          assert.ok(added);
          const anchor = added.anchor;
          assert.ok(anchor);
          const posted = await post(
            page.url,
            'act',
            answerFields({
              line: newLine,
              reply,
              path: anchor.path,
              at: String(anchor.line),
              side: anchor.side,
            }),
          );
          assert.equal(posted.status, 200);
          const next = JSON.parse(posted.body) as WindowSnapshot;
          assert.equal(threadCalls, 1);
          assert.deepEqual(spoken, [`> ${newLine}\n\n${reply}`]);
          assert.equal(next.status, undefined);
          assert.equal(JSON.stringify(next).includes('host refused the thread'), false);
        },
      );
    });
    scenario('Both writes failing leave the comment unrecorded', async () => {
      const {baseline, delta, newLine} = replacedLines();
      const reply = 'Смотрите сюда.';
      let threadCalls = 0;
      let speakCalls = 0;
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'specifying', {openPullRequests: 1})],
          threadPull: async () => {
            threadCalls += 1;
            throw new Error('host refused the thread');
          },
          speakPull: async () => {
            speakCalls += 1;
            throw new Error('host refused the quote');
          },
        },
        async (page, window, paths) => {
          const {shot} = await drawSpec(page, window, paths.arcadia, delta, baseline);
          const added = specView(shot, SPEC_ID).flat.find(
            row => row.kind === 'add' && row.text === newLine,
          );
          assert.ok(added);
          const anchor = added.anchor;
          assert.ok(anchor);
          const posted = await post(
            page.url,
            'act',
            answerFields({
              line: newLine,
              reply,
              path: anchor.path,
              at: String(anchor.line),
              side: anchor.side,
            }),
          );
          assert.equal(posted.status, 200);
          const next = JSON.parse(posted.body) as WindowSnapshot;
          assert.equal(threadCalls, 1);
          assert.equal(speakCalls, 1);
          assert.equal(next.status, 'комментарий не записан');
          assert.equal(statusOf(renderWindow(next)), 'комментарий не записан');
          assert.equal(JSON.stringify(next).includes('host refused'), false);
        },
      );
    });
    scenario('A plan line opens a thread on proposal.md', async () => {
      const line = 'Годность проверки.';
      const reply = 'Сначала сократить.';
      const proposal = specText(['## Outcome', '', line]);
      const threads: {key: string; body: string; place: ThreadPlace}[] = [];
      const comments: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'proposing', {openPullRequests: 1})],
          commentPull: (_key, body) => {
            comments.push(body);
          },
          threadPull: async (key, body, place) => {
            threads.push({key, body, place});
          },
        },
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'proposal.md', proposal);
          await showCard(page, window);
          const html = renderWindow(await readSnapshot(page.url));
          const button = lineButton(html, line);
          const at = sourceLine(proposal, line);
          assert.equal(button.includes(`data-path="${PROPOSAL_PATH}"`), true);
          assert.equal(button.includes(`data-at="${at}"`), true);
          assert.equal(button.includes('data-side="right"'), true);
          assert.equal(
            (
              await post(
                page.url,
                'act',
                answerFields({
                  line,
                  reply,
                  path: PROPOSAL_PATH,
                  at: String(at),
                  side: 'right',
                }),
              )
            ).status,
            200,
          );
          assert.deepEqual(threads, [
            {key: '1', body: reply, place: {path: PROPOSAL_PATH, line: at, side: 'right'}},
          ]);
          assert.deepEqual(comments, []);
        },
      );
    });
    scenario('A design line opens a thread on design.md', async () => {
      const line = 'Один модуль.';
      const reply = 'Сначала сократить.';
      const design = '## Approach\n\nОдин модуль.\n';
      const threads: {key: string; body: string; place: ThreadPlace}[] = [];
      const comments: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'designing', {openPullRequests: 1})],
          commentPull: (_key, body) => {
            comments.push(body);
          },
          threadPull: async (key, body, place) => {
            threads.push({key, body, place});
          },
        },
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'design.md', design);
          await showCard(page, window);
          const html = renderWindow(await readSnapshot(page.url));
          const button = lineButton(html, line);
          const at = sourceLine(design, line);
          assert.equal(button.includes(`data-path="${DESIGN_PATH}"`), true);
          assert.equal(button.includes(`data-at="${at}"`), true);
          assert.equal(button.includes('data-side="right"'), true);
          assert.equal(
            (
              await post(
                page.url,
                'act',
                answerFields({
                  line,
                  reply,
                  path: DESIGN_PATH,
                  at: String(at),
                  side: 'right',
                }),
              )
            ).status,
            200,
          );
          assert.equal(threads.length, 1);
          assert.equal(threads[0]?.place.path, DESIGN_PATH);
          assert.deepEqual(comments, []);
        },
      );
    });
    scenario('An open question stays a conversation reply', async () => {
      const question = 'Писать ли имя проверки?';
      const reply = 'Да, короткое имя.';
      const line = `- [ ] ${question}`;
      const proposal = specText(['## Open questions', '', line]);
      const threads: ThreadPlace[] = [];
      const comments: string[] = [];
      const spoken: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'proposing', {openPullRequests: 1})],
          commentPull: (_key, body) => {
            comments.push(body);
          },
          threadPull: async (_key, _body, place) => {
            threads.push(place);
          },
          speakPull: async (_key, body) => {
            spoken.push(body);
          },
        },
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'proposal.md', proposal);
          await showCard(page, window);
          const html = renderWindow(await readSnapshot(page.url));
          const button = lineButton(html, line);
          const at = sourceLine(proposal, line);
          assert.equal(button.includes(`data-question="${question}"`), true);
          assert.equal(button.includes(`data-path="${PROPOSAL_PATH}"`), true);
          assert.equal(button.includes(`data-at="${at}"`), true);
          assert.equal(
            (
              await post(
                page.url,
                'act',
                answerFields({
                  question,
                  line,
                  reply,
                  path: PROPOSAL_PATH,
                  at: String(at),
                  side: 'right',
                }),
              )
            ).status,
            200,
          );
          assert.deepEqual([...comments, ...spoken], [`- [ ] ${question}\n\n${reply}`]);
          assert.deepEqual(threads, []);
        },
      );
    });
    scenario('An open design question stays a conversation reply', async () => {
      const question = 'Имя модуля?';
      const reply = 'Да.';
      const line = `- [ ] ${question}`;
      const design = specText(['## Open questions', '', line]);
      const threads: ThreadPlace[] = [];
      const comments: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'designing', {openPullRequests: 1})],
          commentPull: (_key, body) => {
            comments.push(body);
          },
          threadPull: async (_key, _body, place) => {
            threads.push(place);
          },
        },
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'design.md', design);
          await showCard(page, window);
          const html = renderWindow(await readSnapshot(page.url));
          const button = lineButton(html, line);
          assert.equal(button.includes(`data-question="${question}"`), true);
          assert.equal(
            (
              await post(
                page.url,
                'act',
                answerFields({
                  question,
                  line,
                  reply,
                  path: DESIGN_PATH,
                  at: String(sourceLine(design, line)),
                  side: 'right',
                }),
              )
            ).status,
            200,
          );
          assert.deepEqual(comments, [`- [ ] ${question}\n\n${reply}`]);
          assert.deepEqual(threads, []);
        },
      );
    });
    scenario('A design checkbox outside Open questions opens a thread', async () => {
      const line = '- [ ] не вопрос';
      const reply = 'Это заметка.';
      const design = '## Notes\n\n- [ ] не вопрос\n';
      const threads: {key: string; body: string; place: ThreadPlace}[] = [];
      const comments: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'designing', {openPullRequests: 1})],
          commentPull: (_key, body) => {
            comments.push(body);
          },
          threadPull: async (key, body, place) => {
            threads.push({key, body, place});
          },
        },
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'design.md', design);
          await showCard(page, window);
          const html = renderWindow(await readSnapshot(page.url));
          const button = lineButton(html, line);
          assert.equal(button.includes('data-question'), false);
          const at = sourceLine(design, line);
          assert.equal(
            (
              await post(
                page.url,
                'act',
                answerFields({
                  line,
                  reply,
                  path: DESIGN_PATH,
                  at: String(at),
                  side: 'right',
                }),
              )
            ).status,
            200,
          );
          assert.deepEqual(threads, [
            {key: '1', body: reply, place: {path: DESIGN_PATH, line: at, side: 'right'}},
          ]);
          assert.deepEqual(comments, []);
        },
      );
    });
    scenario('A repeated design checkbox outside Open questions opens a thread', async () => {
      const question = 'Имя модуля?';
      const line = `- [ ] ${question}`;
      const reply = 'Это заметка.';
      const design = specText(['## Open questions', '', line, '', '## Notes', '', line]);
      const threads: {key: string; body: string; place: ThreadPlace}[] = [];
      const comments: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'designing', {openPullRequests: 1})],
          commentPull: (_key, body) => {
            comments.push(body);
          },
          threadPull: async (key, body, place) => {
            threads.push({key, body, place});
          },
        },
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'design.md', design);
          await showCard(page, window);
          const html = renderWindow(await readSnapshot(page.url));
          const button = lineButton(html, line);
          assert.equal(button.includes(`data-question="${question}"`), true);
          const notesHeading = html.indexOf('<h3>Notes</h3>');
          assert.ok(notesHeading >= 0);
          const notesButton = lineButton(html.slice(notesHeading), line);
          assert.equal(notesButton.includes('data-question'), false);
          const openAt = sourceLine(design, line);
          const notesAt =
            design.split('\n').findIndex((row, index) => index >= openAt && row === line) + 1;
          assert.ok(notesAt > openAt);
          assert.equal(
            (
              await post(
                page.url,
                'act',
                answerFields({
                  line,
                  reply,
                  path: DESIGN_PATH,
                  at: String(notesAt),
                  side: 'right',
                }),
              )
            ).status,
            200,
          );
          assert.deepEqual(threads, [
            {key: '1', body: reply, place: {path: DESIGN_PATH, line: notesAt, side: 'right'}},
          ]);
          assert.deepEqual(comments, []);
        },
      );
    });
  });
});

function caseReadDelta(): {baseline: string; delta: string} {
  return {
    baseline: specText(['### Requirement: Чтение', '', 'Старый текст.']),
    delta: specText([
      '## MODIFIED Requirements',
      '',
      '### Requirement: Чтение',
      '',
      'Новый текст.',
    ]),
  };
}

function plantCaseRead(arcadia: string): void {
  const {baseline, delta} = caseReadDelta();
  writeBaseline(arcadia, SPEC_ID, baseline);
  writeChange(arcadia, '1', `specs/${SPEC_ID}/spec.md`, delta);
}

async function flushSpine(): Promise<void> {
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
}

function commitIssueBranch(checkout: string): void {
  git(checkout, ['init', '-b', 'master']);
  git(checkout, ['config', 'user.email', 'test@example.com']);
  git(checkout, ['config', 'user.name', 'Test']);
  git(checkout, ['add', 'openspec']);
  git(checkout, ['commit', '-m', 'spec']);
  git(checkout, ['checkout', '-b', 'sdd/1']);
}

function dropIssueSpec(checkout: string): void {
  git(checkout, ['rm', path.join(changeDir('1'), 'specs', SPEC_ID, 'spec.md')]);
  git(checkout, ['commit', '-m', 'drop']);
}

function restoreIssueBranch(checkout: string): void {
  git(checkout, ['checkout', 'master']);
  git(checkout, ['branch', '-f', 'sdd/1', 'master']);
}

/** Fail `git rev-parse --verify`. The board still answers; the deferred spine read throws. */
function failGitRevParse(): () => void {
  const real = execFileSync('/usr/bin/which', ['git'], {encoding: 'utf8'}).trim();
  const dir = mkdtempSync(path.join(tmpdir(), 'spine-git-'));
  const bin = path.join(dir, 'git');
  writeFileSync(
    bin,
    [
      '#!/bin/sh',
      'if [ "$1" = "rev-parse" ]; then',
      '  case " $* " in',
      '    *--verify*)',
      '      echo "fatal: rev-parse failed" >&2',
      '      exit 128',
      '      ;;',
      '  esac',
      'fi',
      `exec ${JSON.stringify(real)} "$@"`,
      '',
    ].join('\n'),
  );
  chmodSync(bin, 0o755);
  const saved = process.env.PATH;
  process.env.PATH = `${dir}${path.delimiter}${saved ?? ''}`;
  return () => {
    if (saved === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = saved;
    }
    rmSync(dir, {recursive: true, force: true});
  };
}

/** Fail the deferred spine read of `proposal.md`. The board still answers; that read throws. */
function failGitShow(): () => void {
  const real = execFileSync('/usr/bin/which', ['git'], {encoding: 'utf8'}).trim();
  const dir = mkdtempSync(path.join(tmpdir(), 'spine-git-'));
  const bin = path.join(dir, 'git');
  writeFileSync(
    bin,
    [
      '#!/bin/sh',
      'if [ "$1" = "show" ]; then',
      '  case " $* " in',
      '    *proposal.md*)',
      '      echo "fatal: not a git repository (or any of the parent directories): .git" >&2',
      '      exit 128',
      '      ;;',
      '  esac',
      'fi',
      'if [ "$1" = "cat-file" ] && [ "$2" = "--batch" ]; then',
      '  echo "fatal: not a git repository (or any of the parent directories): .git" >&2',
      '  exit 128',
      'fi',
      `exec ${JSON.stringify(real)} "$@"`,
      '',
    ].join('\n'),
  );
  chmodSync(bin, 0o755);
  const saved = process.env.PATH;
  process.env.PATH = `${dir}${path.delimiter}${saved ?? ''}`;
  return () => {
    if (saved === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = saved;
    }
    rmSync(dir, {recursive: true, force: true});
  };
}

async function firstChange(url: string): Promise<{
  generation: number;
  kind: string;
  changed: {key: string; revision: string}[];
}> {
  const controller = new AbortController();
  const response = await fetch(new URL('/events', url), {signal: controller.signal});
  assert.equal(response.status, 200);
  const reader = response.body?.getReader();
  assert.ok(reader);
  const decoder = new TextDecoder();
  let text = '';
  try {
    while (!text.includes('\n\n')) {
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }
      text += decoder.decode(chunk.value, {stream: true});
    }
  } finally {
    controller.abort();
    await reader?.cancel().catch(() => undefined);
  }
  const line = text.split('\n').find(item => item.startsWith('data: '));
  assert.ok(line);
  return JSON.parse(line.slice('data: '.length)) as {
    generation: number;
    kind: string;
    changed: {key: string; revision: string}[];
  };
}

async function snapshotOnce(url: string): Promise<WindowSnapshot> {
  const response = await fetch(new URL('/snapshot', url));
  assert.equal(response.status, 200);
  return response.json() as Promise<WindowSnapshot>;
}

spec('live-frame', () => {
  requirement('The snapshot does not wait to read the spine', () => {
    scenario('The next frame fills the spine in the same drawer', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying')]},
        async (page, window, paths) => {
          plantCaseRead(paths.arcadia);
          window.chooseAgent('cursor');
          const response = await fetch(new URL('act', page.url), {
            method: 'POST',
            headers: {'content-type': 'application/x-www-form-urlencoded'},
            body: new URLSearchParams({act: 'open', key: '1'}).toString(),
          });
          const first = (await response.json()) as WindowSnapshot;
          assert.equal(first.opened?.key, '1');
          assert.equal(first.opened?.spineReady, false);
          assert.equal(
            first.opened?.spine.capabilities.some(item => item.id === SPEC_ID),
            false,
          );
          await flushSpine();
          const second = await snapshotOnce(page.url);
          assert.equal(second.opened?.spineReady, true);
          assert.ok(second.opened?.spine.capabilities.some(item => item.id === SPEC_ID));
        },
      );
    });

    scenario('A spy snapshot keeps the previous spine until the next one is ready', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying')]},
        async (page, window, paths) => {
          plantCaseRead(paths.arcadia);
          window.chooseAgent('cursor');
          const response = await fetch(new URL('act', page.url), {
            method: 'POST',
            headers: {'content-type': 'application/x-www-form-urlencoded'},
            body: new URLSearchParams({act: 'open', key: '1'}).toString(),
          });
          assert.equal(response.status, 200);
          await response.json();
          await flushSpine();
          const ready = await snapshotOnce(page.url);
          assert.equal(ready.opened?.spineReady, true);
          assert.ok(ready.opened?.spine.capabilities.some(item => item.id === SPEC_ID));
          page.note();
          const during = await snapshotOnce(page.url);
          assert.equal(during.opened?.spineReady, false);
          assert.ok(during.opened?.spine.capabilities.some(item => item.id === SPEC_ID));
          await flushSpine();
          const after = await snapshotOnce(page.url);
          assert.equal(after.opened?.spineReady, true);
        },
      );
    });

    scenario('A failed read keeps the previous spine', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying')]},
        async (page, window, paths) => {
          const checkout = path.join(paths.arcadia, 'services', 'billing');
          plantCaseRead(paths.arcadia);
          commitIssueBranch(checkout);
          let restoreBranch = false;
          try {
            window.chooseAgent('cursor');
            assert.equal(
              (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
                .status,
              200,
            );
            await flushSpine();
            const ready = await snapshotOnce(page.url);
            assert.equal(ready.opened?.key, '1');
            assert.equal(ready.opened?.spineReady, true);
            assert.ok(ready.opened?.spine.capabilities.some(item => item.id === SPEC_ID));
            dropIssueSpec(checkout);
            restoreBranch = true;
            const logged: unknown[] = [];
            const report = console.error;
            const restoreGit = failGitShow();
            console.error = (...args: unknown[]) => {
              logged.push(args[0]);
            };
            try {
              page.note();
              const during = await snapshotOnce(page.url);
              assert.equal(during.opened?.key, '1');
              assert.equal(during.opened?.spineReady, false);
              assert.ok(during.opened?.spine.capabilities.some(item => item.id === SPEC_ID));
              await flushSpine();
            } finally {
              console.error = report;
              restoreGit();
            }
            assert.equal(logged.length, 1);
            const after = await snapshotOnce(page.url);
            assert.equal(after.opened?.key, ready.opened?.key);
            assert.equal(after.opened?.spineReady, true);
            assert.deepEqual(
              after.opened?.spine.capabilities.map(item => item.id),
              ready.opened?.spine.capabilities.map(item => item.id),
            );
            assert.equal(after.status, undefined);
          } finally {
            if (restoreBranch) {
              restoreIssueBranch(checkout);
            }
          }
        },
      );
    });

    scenario('A fatal ref lookup keeps the previous spine', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying')]},
        async (page, window, paths) => {
          const checkout = path.join(paths.arcadia, 'services', 'billing');
          const specFile = path.join(checkout, changeDir('1'), 'specs', SPEC_ID, 'spec.md');
          plantCaseRead(paths.arcadia);
          commitIssueBranch(checkout);
          let restoreTree = false;
          try {
            window.chooseAgent('cursor');
            assert.equal(
              (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
                .status,
              200,
            );
            await flushSpine();
            const ready = await snapshotOnce(page.url);
            assert.equal(ready.opened?.key, '1');
            assert.equal(ready.opened?.spineReady, true);
            assert.ok(ready.opened?.spine.capabilities.some(item => item.id === SPEC_ID));
            rmSync(specFile);
            assert.equal(existsSync(specFile), false);
            restoreTree = true;
            const logged: unknown[] = [];
            const report = console.error;
            const restoreGit = failGitRevParse();
            console.error = (...args: unknown[]) => {
              logged.push(args[0]);
            };
            try {
              page.note();
              const during = await snapshotOnce(page.url);
              assert.equal(during.opened?.key, '1');
              assert.equal(during.opened?.spineReady, false);
              assert.ok(during.opened?.spine.capabilities.some(item => item.id === SPEC_ID));
              await flushSpine();
            } finally {
              console.error = report;
              restoreGit();
            }
            assert.equal(logged.length, 1);
            const after = await snapshotOnce(page.url);
            assert.equal(after.opened?.key, ready.opened?.key);
            assert.equal(after.opened?.spineReady, true);
            assert.deepEqual(
              after.opened?.spine.capabilities.map(item => item.id),
              ready.opened?.spine.capabilities.map(item => item.id),
            );
            assert.equal(after.status, undefined);
          } finally {
            if (restoreTree) {
              git(checkout, [
                'checkout',
                'HEAD',
                '--',
                path.join(changeDir('1'), 'specs', SPEC_ID, 'spec.md'),
              ]);
            }
          }
        },
      );
    });

    scenario('Opening the same ticket again keeps the ready spine', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying')]},
        async (page, window, paths) => {
          plantCaseRead(paths.arcadia);
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          await flushSpine();
          const ready = await snapshotOnce(page.url);
          assert.equal(ready.opened?.spineReady, true);
          const ids = ready.opened?.spine.capabilities.map(item => item.id);
          assert.ok(ids?.includes(SPEC_ID));
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'close-card'}).toString()))
              .status,
            200,
          );
          const again = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'open', key: '1'}).toString(),
          );
          assert.equal(again.status, 200);
          const shot = JSON.parse(again.body) as WindowSnapshot;
          assert.equal(shot.opened?.key, '1');
          assert.equal(shot.opened?.spineReady, true);
          assert.equal(typeof shot.opened?.revision, 'string');
          assert.equal(shot.opened?.revision, ready.opened?.revision);
          assert.deepEqual(
            shot.opened?.spine.capabilities.map(item => item.id),
            ids,
          );
        },
      );
    });

    scenario('Switching back to a ticket keeps the spine already read', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'specifying'), held('2', 'specifying')],
        },
        async (page, window, paths) => {
          plantCaseRead(paths.arcadia);
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          await flushSpine();
          const ready = await snapshotOnce(page.url);
          assert.equal(ready.opened?.spineReady, true);
          const ids = ready.opened?.spine.capabilities.map(item => item.id);
          assert.ok(ids?.includes(SPEC_ID));
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '2'}).toString()))
              .status,
            200,
          );
          await flushSpine();
          const other = await snapshotOnce(page.url);
          assert.equal(other.opened?.key, '2');
          assert.equal(other.opened?.spineReady, true);
          const again = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'open', key: '1'}).toString(),
          );
          assert.equal(again.status, 200);
          const shot = JSON.parse(again.body) as WindowSnapshot;
          assert.equal(shot.opened?.key, '1');
          assert.equal(shot.opened?.spineReady, true);
          assert.equal(shot.opened?.revision, ready.opened?.revision);
          assert.deepEqual(
            shot.opened?.spine.capabilities.map(item => item.id),
            ids,
          );
          await flushSpine();
          const stayed = await snapshotOnce(page.url);
          assert.equal(stayed.generation, shot.generation);
          assert.equal(stayed.opened?.spineReady, true);
        },
      );
    });
  });

  requirement('A matching revision omits the spine', () => {
    scenario('A matching revision omits the spine', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying')]},
        async (page, window, paths) => {
          plantCaseRead(paths.arcadia);
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          await flushSpine();
          const ready = await snapshotOnce(page.url);
          const revision = ready.opened?.revision;
          assert.equal(typeof revision, 'string');
          assert.ok(ready.opened?.spine);
          const heldShot = await fetch(new URL(`/snapshot?have=${revision}`, page.url));
          const thin = (await heldShot.json()) as WindowSnapshot;
          assert.equal(thin.opened?.revision, revision);
          assert.equal(thin.opened !== undefined && 'spine' in thin.opened, false);
          const full = await snapshotOnce(page.url);
          assert.ok(full.opened?.spine.capabilities.length !== undefined);
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'close-card'}).toString()))
              .status,
            200,
          );
          const again = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'open', key: '1', have: revision ?? ''}).toString(),
          );
          assert.equal(again.status, 200);
          const shot = JSON.parse(again.body) as WindowSnapshot;
          assert.equal(shot.opened?.revision, revision);
          assert.equal(shot.opened?.spineReady, true);
          assert.equal(shot.opened !== undefined && 'spine' in shot.opened, false);
          assert.ok(Array.isArray(shot.opened?.blocks));
        },
      );
    });

    scenario('A change event names the open spine revision', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying')]},
        async (page, window, paths) => {
          plantCaseRead(paths.arcadia);
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          await flushSpine();
          const ready = await snapshotOnce(page.url);
          const revision = ready.opened?.revision;
          assert.equal(typeof revision, 'string');
          const note = await firstChange(page.url);
          assert.equal(note.kind, 'frame');
          assert.equal(typeof note.generation, 'number');
          assert.deepEqual(note.changed, [{key: '1', revision}]);
        },
      );
    });
  });
});

spec('ticket-heading', () => {
  requirement('The ticket heading names the issue', () => {
    scenario('The board shows the issue link beside the title', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [
            held('1', 'specifying', {
              repo: 'acme/billing',
              title: 'Take me',
              sddService: 'services/billing',
            }),
          ],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          const article = articleOf(html, '1');
          const href = 'href="https://github.com/acme/billing/issues/1"';
          assert.match(article, new RegExp(`<a class="key" ${href}>#1</a>`));
          assert.match(article, /: Take me/);
          const face = article.slice(
            article.indexOf('<button class="face"'),
            article.indexOf('</button>'),
          );
          assert.equal(face.includes(href), false);
        },
      );
    });

    scenario('A long board title ends on the third line', () => {
      const html = readFileSync(new URL('./face.css', import.meta.url), 'utf8');
      assert.match(html, /\.ident > \.name\s*\{[^}]*-webkit-line-clamp:\s*3/);
      assert.match(html, /\.ident > \.name \.open,\s*\.ident > \.name \.face\s*\{[^}]*display:\s*contents/);
      assert.match(html, /\.ident > \.name \.title\s*\{[^}]*display:\s*inline/);
      assert.match(html, /\.sidebar header \.name\s*\{[^}]*display:\s*flex[^}]*flex-wrap:\s*wrap/);
      assert.doesNotMatch(html, /\.ident > \.name \.title\s*\{[^}]*white-space:\s*nowrap/);
      assert.doesNotMatch(html, /(?:^|[{}])\s*\.name\s*\{\s*display:\s*flex/);
    });

    scenario('The plaque opens outside the issue link', () => {
      const gutter = {closest: (selector: string) => (selector === '.gutter' ? gutter : null)};
      const link = {
        closest: (selector: string) => (selector === 'a' || selector === '.gutter' ? link : null),
      };
      const corner = {
        closest: (selector: string) =>
          selector === '.corner' || selector === '.gutter' ? corner : null,
      };
      const button = {
        closest: (selector: string) => (selector === 'button' || selector === '.gutter' ? button : null),
      };
      assert.equal(plaqueClickOpens(gutter), true);
      assert.equal(plaqueClickOpens(link), false);
      assert.equal(plaqueClickOpens(corner), false);
      assert.equal(plaqueClickOpens(button), false);
      assert.equal(plaqueClickOpens(null), false);
    });

    scenario('A ticket without a repo has no link', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'specifying', {title: 'Take me'})],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const article = articleOf(await pageHtml(page.url), '1');
          const text = article.replace(/>\s+</g, '><').replace(/<[^>]+>/g, '');
          assert.match(text, /#1: Take me/);
          assert.equal(article.includes('github.com'), false);
        },
      );
    });
  });

  requirement('The sidebar names the one open pull request', () => {
    scenario('One pull request is a muted link in the sidebar', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [
            held('1', 'specifying', {
              repo: 'acme/billing',
              pull: '11',
              openPullRequests: 1,
              title: 'Take me',
            }),
          ],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          const article = articleOf(html, '1');
          const side = bandOf(html, '1');
          assert.match(side, /https:\/\/github\.com\/acme\/billing\/pull\/11/);
          assert.match(side, /\(PR:/);
          assert.equal(article.includes('/pull/11'), false);
          assert.match(html, /\.pull\s*\{[^}]*color:\s*var\(--muted\)/);
          assert.match(html, /\.pull a\s*\{[^}]*color:\s*inherit/);
        },
      );
    });

    scenario('Several pull requests omit the parenthesis', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [
            held('1', 'specifying', {repo: 'acme/billing', pull: '11', openPullRequests: 2}),
          ],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const side = bandOf(await pageHtml(page.url), '1');
          assert.equal(side.includes('(PR:'), false);
          assert.equal(side.includes('/pull/11'), false);
        },
      );
    });
  });

  requirement('The project badge links to the project root', () => {
    scenario('A service path badges its last segment', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [
            held('1', 'specifying', {
              repo: 'acme/billing',
              pull: '11',
              openPullRequests: 1,
              title: 'Take me',
            }),
          ],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          const href = 'href="https://github.com/acme/billing/tree/HEAD/services/billing"';
          assert.match(bandOf(html, '1'), new RegExp(`<a class="project" ${href}>billing</a>`));
          assert.equal(articleOf(html, '1').includes('class="project"'), false);
        },
      );
    });

    scenario('An empty service badges the repository root', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'specifying', {repo: 'acme/billing', sddService: ''})],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          const article = articleOf(html, '1');
          const badge = bandOf(html, '1').match(/<a class="project" href="([^"]+)">billing<\/a>/);
          assert.ok(badge);
          assert.equal(badge[1], 'https://github.com/acme/billing');
          assert.equal(badge[1].includes('/issues/'), false);
          assert.equal(article.includes('class="project"'), false);
          assert.match(article, /\/issues\//);
        },
      );
    });

    scenario('An unnamed service has no badge', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [
            {...held('1', 'specifying', {repo: 'acme/billing'}), sddService: undefined},
          ],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          assert.match(html, /https:\/\/github\.com\/acme\/billing\/issues\/1/);
          assert.equal(html.includes('class="project"'), false);
        },
      );
    });
  });
});
