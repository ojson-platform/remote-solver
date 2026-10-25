import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {request as httpRequest} from 'node:http';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
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
import {draftsAfterClick, headClickToggles, lineFieldClosesOnEscape, serveBoard} from './page.ts';
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
      const html = await response.text();
      assert.equal(html.includes('<h1>'), false);
      assert.match(html, /<span class="key">1<\/span>/);
      assert.match(html, /<h2 class="title">Take me<\/h2>/);
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
      assert.equal(taken.status, 303);
      assert.deepEqual(assignees, [{key: '1', login: MANAGER}]);
      assert.deepEqual(phases, [{key: '1', phase: 'proposing'}]);
      const after = await (await fetch(page.url)).text();
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
      const first = await (await fetch(page.url)).text();
      assert.equal(first.includes('openspec/config.yaml'), false);
      assert.equal(first.includes('class="sidebar"'), false);
      assert.equal(first.includes('role="dialog"'), false);
      const opened = await fetch(new URL('act', page.url), {
        method: 'POST',
        headers: {'content-type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({act: 'open', key: '1'}),
      });
      const withSide = await opened.text();
      assert.match(withSide, /<aside class="sidebar"/);
      assert.match(withSide, /Take me/);
      const settings = await fetch(new URL('act', page.url), {
        method: 'POST',
        headers: {'content-type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({act: 'open-settings'}),
      });
      const sheet = await settings.text();
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
  const start = band.lastIndexOf('<section>', at);
  const next = band.indexOf('class="spine-pick"', at + marker.length);
  return band.slice(start, next === -1 ? band.length : band.lastIndexOf('<section>', next));
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

async function readSnapshot(url: string): Promise<WindowSnapshot> {
  const response = await fetch(new URL('/snapshot', url));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  return response.json() as Promise<WindowSnapshot>;
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
    page: {url: string},
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

function pageFns(html: string) {
  const script = html.slice(
    html.indexOf('<script>') + '<script>'.length,
    html.lastIndexOf('</script>'),
  );
  const source = script.slice(
    script.indexOf('function payload'),
    script.indexOf('document.querySelectorAll'),
  );
  return new Function(`${source}\nreturn {payload, gesture};`)() as {
    payload: (event: {
      dataTransfer: {getData: (type: string) => string} | null;
    }) => [string, string];
    gesture: (type: string, value: string, kind: string) => string;
  };
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
      const html = await response.text();
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
      const first = await (await fetch(page.url)).text();
      assert.match(articleOf(first, '2'), /aria-label="Поломка"/);
      assert.equal(first.includes('<select'), false);
      assert.equal(first.includes('role="dialog"'), false);
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'repair', key: '2'}).toString()))
          .status,
        303,
      );
      const popup = await (await fetch(page.url)).text();
      const dialog = between(popup, '<div class="popup repair"', '</div></div>');
      assert.match(dialog, /aria-label="Поломка"/);
      assert.equal(popup.includes('aria-label="Настройки"'), false);
      assert.match(dialog, /<option disabled selected>—<\/option>/);
      assert.equal(dialog.includes('<option disabled selected value='), false);
      assert.match(dialog, /<option value="">/);
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
      assert.equal(root.status, 303);
      assert.deepEqual(writes, [{key: '2', service: ''}]);
      const cleared = await (await fetch(page.url)).text();
      assert.equal(cleared.includes('<select'), false);
      assert.equal(cleared.includes('role="dialog"'), false);
      const nested = await post(
        page.url,
        'act',
        new URLSearchParams({act: 'choose-service', key: '2', service: 'services/api'}).toString(),
      );
      assert.equal(nested.status, 303);
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
    assert.equal(applied.status, 303);
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
      const html = await (await fetch(page.url)).text();
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
      assert.equal((await post(page.url, 'act', pair.toString())).status, 303);
      assert.deepEqual(seen.at(-1), {action: 'specify', point: 'before', values: ['one', 'two']});
      const indented = new URLSearchParams();
      indented.set('act', 'set-service-hook');
      indented.set('hook-action', 'specify');
      indented.set('point', 'after');
      indented.set('values', '  indented');
      assert.equal((await post(page.url, 'act', indented.toString())).status, 303);
      assert.deepEqual(seen.at(-1)?.values, ['  indented']);
      const kept = new URLSearchParams();
      kept.set('act', 'set-service-hook');
      kept.set('hook-action', 'specify');
      kept.set('point', 'after');
      kept.set('values', 'keep\n\nrest');
      assert.equal((await post(page.url, 'act', kept.toString())).status, 303);
      assert.deepEqual(seen.at(-1)?.values, ['keep\n\nrest']);
      const edited = new URLSearchParams();
      edited.set('act', 'set-service-hook');
      edited.set('hook-action', 'specify');
      edited.set('point', 'before');
      edited.set('values', 'line1\nline2 tail');
      assert.equal((await post(page.url, 'act', edited.toString())).status, 303);
      assert.deepEqual(seen.at(-1)?.values, ['line1\nline2 tail']);
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'save-service'}).toString())).status,
        303,
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
      const sheet = await opened.text();
      const addForm = formsOf(sheet).find(form => form.includes('class="add"'));
      assert.ok(addForm);
      assert.match(addForm, /name="name"/);
      assert.match(addForm, /name="outcome"/);
      assert.match(addForm, /name="text"/);
      assert.match(addForm, /onchange="this\.form\.submit\(\)"/);
      assert.ok(
        formsOf(sheet).some(
          form => form.includes('name="first"') && form.includes('onchange="this.form.submit()"'),
        ),
      );
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
      assert.equal(empty.status, 303);
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
      assert.equal(drafted.status, 303);
      assert.deepEqual(roles, [{name: 'editor', outcome: 'html', text: 'черновик'}]);
      assert.match(await (await fetch(page.url)).text(), /черновик/);
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
      assert.equal(blank.status, 303);
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
      assert.equal(hooked.status, 303);
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
    const response = await fetch(boardPage.url);
    const body = await response.text();
    assert.equal(response.status, 500);
    assert.ok(body.length > 0);
  } finally {
    await boardPage.close();
  }
});

test('the drag payload falls back to text/plain', async () => {
  const page = await serveBoard(idle());
  try {
    const html = await (await fetch(page.url)).text();
    assert.match(html, /setData\('text\/plain'/);
    assert.match(html, /getData\('text\/plain'\)/);
    const fns = pageFns(html);
    assert.deepEqual(
      fns.payload({
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
    assert.equal(fns.gesture('pool', '1', 'station'), 'take');
    assert.equal(fns.gesture('pool', '1', 'card'), '');
    assert.deepEqual(
      fns.payload({
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
    assert.equal(fns.gesture('role', 'editor', 'card'), '');
    assert.deepEqual(fns.payload({dataTransfer: {getData: () => ''}}), ['', '']);
    assert.deepEqual(fns.payload({dataTransfer: null}), ['', '']);
    assert.equal(fns.gesture('', '', 'card'), '');
    assert.equal(fns.gesture('', '', 'station'), '');
  } finally {
    await page.close();
  }
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
    const first = await (await fetch(page.url)).text();
    assert.equal(articleOf(first, '1').includes('draggable="true"'), true);
    assert.equal(articleOf(first, '3').includes('draggable="true"'), false);
    assert.equal(first.includes('class="band"'), false);
    const opened = await post(
      page.url,
      'act',
      new URLSearchParams({act: 'open', key: '3'}).toString(),
    );
    assert.equal(opened.status, 303);
    const html = await (await fetch(page.url)).text();
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
    assert.equal(opened.status, 303);
    assert.deepEqual(calls, ['1']);
    const html = await (await fetch(page.url)).text();
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
      303,
    );
    const shown = await (await fetch(page.url)).text();
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
      303,
    );
    assert.deepEqual(calls, ['html-role:1', 'missing:1']);
    assert.match(await (await fetch(page.url)).text(), /SECRET/);
    assert.equal(
      (await post(page.url, 'act', new URLSearchParams({act: 'close-popup'}).toString())).status,
      303,
    );
    assert.equal((await (await fetch(page.url)).text()).includes('SECRET'), false);
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
    assert.equal(late.status, 303);
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
    assert.equal(newer.status, 303);
    assert.deepEqual(calls, ['BBB']);
    const late = await finish();
    finish = undefined;
    assert.equal(late.status, 409);
    assert.ok(late.body.length > 0);
    assert.deepEqual(calls, ['BBB']);
    const band = bandOf(await (await fetch(page.url)).text(), 'BBB');
    assert.match(band, /<p class="kicker">BBB<\/p>/);
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
      303,
    );
    const late = await finish();
    finish = undefined;
    assert.equal(late.status, 409);
    assert.ok(late.body.length > 0);
    const html = await (await fetch(page.url)).text();
    assert.match(html, /FINISHED/);
    assert.match(html, /class="popup"/);
  } finally {
    if (finish) {
      await finish().catch(() => undefined);
    }
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
      const sheet = await opened.text();
      assert.match(sheet, /form="down-0"[^>]*disabled[^>]*>↓<\/button>/);
      const moved = await post(
        page.url,
        'act',
        new URLSearchParams({act: 'move-service-queue', from: '0', to: '1'}).toString(),
      );
      assert.equal(moved.status, 409);
      assert.ok(moved.body.length > 0);
      assert.equal(moves, 0);
      assert.match(await (await fetch(page.url)).text(), /value="alpha"/);
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
    const html = await (await fetch(page.url)).text();
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
    assert.equal(early.status, 303);
    const quiet = await (await fetch(page.url)).text();
    assert.equal(quiet.includes('class="sidebar"'), false);
    assert.equal(quiet.includes('class="band"'), false);
    const opened = await fetch(new URL('act', page.url), {
      method: 'POST',
      headers: {'content-type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({act: 'open', key: '9'}).toString(),
    });
    const html = await opened.text();
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
    assert.equal(gone.status, 303);
    assert.equal(closed.length, before + 1);
    const cleared = await (await fetch(page.url)).text();
    assert.equal(cleared.includes('class="sidebar"'), false);
    assert.equal(cleared.includes('class="band"'), false);
    const again = await post(
      page.url,
      'act',
      new URLSearchParams({act: 'close-card', key: '9'}).toString(),
    );
    assert.equal(again.status, 303);
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
    const script = await (await fetch(page.url)).text();
    assert.match(script, /getAttribute\('data-show'\)/);
    assert.match(script, /article\[data-key=/);
    assert.match(script, /\.board/);
    assert.match(script, /scrollTop/);
    assert.equal(
      (await post(page.url, 'take', new URLSearchParams({key: '7'}).toString())).status,
      303,
    );
    assert.match(await (await fetch(page.url)).text(), /<body[^>]*data-show="7"/);
    assert.equal(
      (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '8'}).toString())).status,
      303,
    );
    assert.match(await (await fetch(page.url)).text(), /<body[^>]*data-show="8"/);
    assert.equal(
      (
        await post(
          page.url,
          'act',
          new URLSearchParams({act: 'drag', name: 'Gates', key: '8'}).toString(),
        )
      ).status,
      303,
    );
    assert.match(await (await fetch(page.url)).text(), /<body[^>]*data-show="8"/);
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
      const side = await opened.text();
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
      assert.equal(pageFns(side).gesture('role', 'Gates', 'card'), '');
      assert.equal(
        (
          await post(
            page.url,
            'act',
            new URLSearchParams({act: 'drag', name: 'Gates', key: '4'}).toString(),
          )
        ).status,
        303,
      );
      const wrote = await (await fetch(page.url)).text();
      const written = statusOf(wrote);
      assert.match(written, /Gates/);
      assert.match(written, /\b4\b/);
      assert.ok(labels.includes('sdd:auto-plan'));
      assert.equal(
        (
          await post(
            page.url,
            'act',
            new URLSearchParams({act: 'drag', name: 'File', key: '4'}).toString(),
          )
        ).status,
        303,
      );
      assert.match(await (await fetch(page.url)).text(), /файла нет/);
      assert.equal(
        (
          await post(
            page.url,
            'act',
            new URLSearchParams({act: 'drag', name: 'Page', key: '4'}).toString(),
          )
        ).status,
        303,
      );
      assert.match(await (await fetch(page.url)).text(), /class="popup"/);
      assert.equal(
        (
          await post(
            page.url,
            'act',
            new URLSearchParams({act: 'drag', name: 'Note', key: '4'}).toString(),
          )
        ).status,
        303,
      );
      const skipped = await (await fetch(page.url)).text();
      assert.match(statusOf(skipped), /комментарий не записан/);
      assert.equal((await (await fetch(page.url)).text()).includes('role="status"'), false);
      assert.match(skipped, /class="popup"/);
      assert.match(skipped, /hi/);
      assert.equal(
        (
          await post(
            page.url,
            'act',
            new URLSearchParams({act: 'drag', name: 'Note', key: '5'}).toString(),
          )
        ).status,
        303,
      );
      assert.match(statusOf(await (await fetch(page.url)).text()), /комментарий не записан/);
      assert.deepEqual(comments, []);
      assert.equal(
        (
          await post(
            page.url,
            'act',
            new URLSearchParams({act: 'drag', name: 'missing', key: '4'}).toString(),
          )
        ).status,
        303,
      );
      const kept = await (await fetch(page.url)).text();
      assert.match(kept, /class="popup"/);
      assert.match(kept, /hi/);
    },
  );
});

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
      const html = await opened.text();
      const focus = bandOf(html, '1');
      assert.match(focus, /<a href="https:\/\/arcanum\.example\/review\/42">src\/a\.ts:4<\/a>/);
      assert.match(focus, /Code solid/);
      assert.match(focus, /src\/b\.ts:9/);
      assert.equal(focus.includes('https://arcanum.example/other'), false);
      assert.equal(/<a\b[^>]*>[^<]*solid/.test(focus), false);
      assert.equal(/<a\b[^>]*>[^<]*src\/b\.ts:9/.test(focus), false);
      assert.deepEqual(calls, [{file: 'src/a.ts', line: 4}]);
      assert.ok(window.sidebar().some(block => block.kind === 'focus'));
      const closed = await post(
        page.url,
        'act',
        new URLSearchParams({act: 'close-card'}).toString(),
      );
      assert.equal(closed.status, 303);
      assert.deepEqual(window.sidebar(), []);
      const cleared = await (await fetch(page.url)).text();
      assert.equal(cleared.includes('class="sidebar"'), false);
      assert.equal(cleared.includes('class="band"'), false);
      const missing = await post(
        page.url,
        'act',
        new URLSearchParams({act: 'close-card', key: 'absent'}).toString(),
      );
      assert.equal(missing.status, 303);
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
      const fresh = await opened.text();
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
        303,
      );
      const dirty = await (await fetch(page.url)).text();
      assert.equal(saveControl(dirty).disabled, false);
      assert.match(dirty, /сервис не записан/);
      assert.match(dirty, /Закрыть без записи/);
      assert.equal(readFileSync(file, 'utf8'), before);
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'save-service'}).toString())).status,
        303,
      );
      const saved = await (await fetch(page.url)).text();
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
        303,
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
        303,
      );
      assert.match(await (await fetch(page.url)).text(), /Закрыть без записи/);
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'close-settings'}).toString()))
          .status,
        303,
      );
      assert.equal(readFileSync(file, 'utf8'), before);
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'open-settings'}).toString()))
          .status,
        303,
      );
      const again = await (await fetch(page.url)).text();
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
        303,
      );
      assert.equal(
        (
          await post(
            page.url,
            'act',
            new URLSearchParams({act: 'add-service-ignore', value: '('}).toString(),
          )
        ).status,
        303,
      );
      const ignored = await (await fetch(page.url)).text();
      assert.equal(saveControl(ignored).disabled, true);
      assert.match(ignored, /правку нельзя записать/);
      assert.equal(readFileSync(file, 'utf8'), before);
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'close-settings'}).toString()))
          .status,
        303,
      );
      assert.equal(readFileSync(file, 'utf8'), before);
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'open-settings'}).toString()))
          .status,
        303,
      );
      assert.equal(
        (
          await post(
            page.url,
            'act',
            new URLSearchParams({act: 'remove-service-queue', index: '0'}).toString(),
          )
        ).status,
        303,
      );
      const emptied = await (await fetch(page.url)).text();
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
    const html = await (await fetch(page.url)).text();
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
    assert.match(queueForm, /onchange="this\.form\.submit\(\)"/);
    assert.match(html, /querySelectorAll\('form\.pair'\)/);
    assert.match(html, /focusout/);
    assert.match(html, /relatedTarget/);
    assert.match(html, /contains\(next\)/);
    assert.match(html, /sessionStorage/);
    assert.match(html, /scrollTop/);
    assert.match(html, /ai-factory-sheet-scroll/);
    assert.match(html, /ai-factory-sheet-field/);
    assert.equal(
      (
        await post(
          page.url,
          'act',
          new URLSearchParams({act: 'leave-roots', arcadia: '/arc', github: '/hub'}).toString(),
        )
      ).status,
      303,
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
      303,
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
    const html = await (await fetch(page.url)).text();
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
      const html = await opened.text();
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
        303,
      );
      const open = await (await fetch(page.url)).text();
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
        303,
      );
      assert.equal(readFileSync(file, 'utf8'), 'sdd:\n  queues:\n    - name: "alpha"\n');
      const next = await (await fetch(page.url)).text();
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
          const html = await (await fetch(page.url)).text();
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
          assert.equal(opened.status, 303);
          const html = await (await fetch(page.url)).text();
          assert.match(html, /class="ticket pool is-open"/);
          assert.equal(html.includes('name="phase"'), false);
          assert.deepEqual(phases, []);
        },
      );
    });
    scenario('An empty pool draws no tile', async () => {
      await hosted({login: () => MANAGER, tickets: () => []}, async (page, window) => {
        window.chooseAgent('cursor');
        const html = await (await fetch(page.url)).text();
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
          const html = await (await fetch(page.url)).text();
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
          const html = await (await fetch(page.url)).text();
          const fns = pageFns(html);
          assert.equal(fns.gesture('pool', '1', 'station'), 'take');
          const takeBranch = html.slice(
            html.indexOf("which === 'take'"),
            html.indexOf("which === 'drag'"),
          );
          assert.match(takeBranch, /field\(form, 'key', value\)/);
          assert.equal(takeBranch.includes('phase'), false);
          assert.equal(takeBranch.includes('data-station'), false);
          const taken = await post(page.url, 'take', new URLSearchParams({key: '1'}).toString());
          assert.equal(taken.status, 303);
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
          const html = await (await fetch(page.url)).text();
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
          const html = await (await fetch(page.url)).text();
          const row = articleOf(html, '1');
          assert.match(
            row,
            /<button class="round play off" type="submit" disabled aria-label="Взять">/,
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
          const html = await (await fetch(page.url)).text();
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
          const html = await (await fetch(page.url)).text();
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
          const html = await (await fetch(page.url)).text();
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
          const html = await (await fetch(page.url)).text();
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
          const door = stationOf(await (await fetch(page.url)).text(), '1', 'proposing');
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
          const closed = await (await fetch(page.url)).text();
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
          assert.equal(opened.status, 303);
          const html = await (await fetch(page.url)).text();
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
          const html = await (await fetch(page.url)).text();
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
          const html = await (await fetch(page.url)).text();
          assert.match(stationOf(html, '1', 'implementing'), /class="plaque"/);
          assert.match(stationOf(html, '1', 'designing'), /aria-label="design"/);
          assert.match(stationOf(html, '1', 'designing'), /class="pip"/);
          assert.deepEqual(phases, []);
          assert.deepEqual(tickets[0]?.labels, ['sdd:cycle', 'sdd:implementing']);
        },
      );
    });
  });
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
          const before = stationOf(await (await fetch(page.url)).text(), '1', 'designing');
          assert.match(before, /aria-label="Снять гейт designing"/);
          assert.match(before, /M8 0\.4/);
          assert.equal(before.includes('class="tick"'), false);
          const posted = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'gate', key: '1', station: 'designing'}).toString(),
          );
          assert.equal(posted.status, 303);
          assert.ok(tickets[0]?.labels.includes('sdd:auto-design'));
          assert.equal(tickets[0]?.labels.includes('sdd:designed'), false);
          assert.equal(tickets[0]?.labels.includes('sdd:proposed'), false);
          assert.equal(tickets[0]?.labels.includes('sdd:specified'), false);
          assert.equal(tickets[0]?.labels.includes('sdd:accepted'), false);
          assert.deepEqual(phases, []);
          const after = stationOf(await (await fetch(page.url)).text(), '1', 'designing');
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
          const before = stationOf(await (await fetch(page.url)).text(), '1', 'specifying');
          assert.match(before, /aria-label="Поставить гейт specifying"/);
          assert.match(before, /class="tick"/);
          assert.equal(before.includes('<svg'), false);
          const posted = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'gate', key: '1', station: 'specifying'}).toString(),
          );
          assert.equal(posted.status, 303);
          assert.equal(tickets[0]?.labels.includes('sdd:auto-spec'), false);
          assert.ok(tickets[0]?.labels.includes('sdd:auto-plan'));
          assert.ok(tickets[0]?.labels.includes('sdd:proposing'));
          const after = stationOf(await (await fetch(page.url)).text(), '1', 'specifying');
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
          const html = await (await fetch(page.url)).text();
          assert.equal(stationOf(html, '1', 'proposing').includes('гейт'), false);
          assert.equal(stationOf(html, '1', 'specifying').includes('гейт'), false);
          assert.match(stationOf(html, '1', 'specifying'), /class="plaque"/);
          const posted = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'gate', key: '1', station: 'proposing'}).toString(),
          );
          assert.equal(posted.status, 303);
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
          const closed = await (await fetch(page.url)).text();
          const station = stationOf(closed, '1', 'designing');
          assert.match(station, /aria-label="design"/);
          assert.equal(station.includes('гейт'), false);
          const opened = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'open', key: '1'}).toString(),
          );
          assert.equal(opened.status, 303);
          const html = await (await fetch(page.url)).text();
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
          assert.equal(posted.status, 303);
          assert.ok(tickets[0]?.labels.includes('sdd:auto-spec'));
          assert.ok(tickets[0]?.labels.includes('sdd:wait-human'));
          const plaque = stationOf(await (await fetch(page.url)).text(), '1', 'proposing');
          assert.match(plaque, /<span class="kicker">ask<\/span>/);
        },
      );
    });
    scenario('A station behind the plaque with no file is a dot', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'implementing')]},
        async (page, window) => {
          window.chooseAgent('cursor');
          const station = stationOf(await (await fetch(page.url)).text(), '1', 'tasking');
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
          const html = await (await fetch(page.url)).text();
          assert.match(stationOf(html, '1', 'proposing'), /aria-label="Снять гейт proposing"/);
          assert.match(stationOf(html, '1', 'accepting'), /aria-label="Снять гейт accepting"/);
          assert.match(stationOf(html, '1', 'implementing'), /<span class="dot"/);
          const posted = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'gate', key: '1', station: 'proposing'}).toString(),
          );
          assert.equal(posted.status, 303);
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
          assert.equal(posted.status, 303);
          assert.ok(tickets[0]?.labels.includes('sdd:auto-merge'));
          assert.equal(tickets[0]?.labels.includes('sdd:accepted'), false);
          assert.deepEqual(phases, []);
          const station = stationOf(await (await fetch(page.url)).text(), '1', 'accepting');
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
          assert.equal(asked.status, 303);
          const dialog = await (await fetch(page.url)).text();
          assert.match(dialog, /aria-label="Без контроля"/);
          assert.match(dialog, /Тикет останется без контроля/);
          assert.equal(tickets[0]?.labels.includes('sdd:auto-merge'), false);
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'close-ask'}).toString()))
              .status,
            303,
          );
          const kept = await (await fetch(page.url)).text();
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
            303,
          );
          assert.ok(tickets[0]?.labels.includes('sdd:auto-merge'));
          assert.equal(tickets[0]?.labels.includes('sdd:accepted'), false);
        },
      );
    });
  });
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
        const waiting = stationOf(await (await fetch(page.url)).text(), '1', 'proposing');
        assert.match(waiting, /<span class="kicker">ask<\/span>/);
        assert.match(waiting, /Review the proposal and accept it\./);
        assert.equal(waiting.includes('class="stat"'), false);
        tickets[0]?.labels.splice(tickets[0].labels.indexOf('sdd:wait-human'), 1);
        const cleared = stationOf(await (await fetch(page.url)).text(), '1', 'proposing');
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
          const plaque = stationOf(await (await fetch(page.url)).text(), '1', 'specifying');
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
          const plaque = stationOf(await (await fetch(page.url)).text(), '1', 'proposing');
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
          const plaque = stationOf(await (await fetch(page.url)).text(), '1', 'specifying');
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
          const plaque = stationOf(await (await fetch(page.url)).text(), '1', 'verifying');
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
          assert.equal(opened.status, 303);
          const html = await (await fetch(page.url)).text();
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
          const closed = await (await fetch(page.url)).text();
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
          assert.equal(opened.status, 303);
          const html = await (await fetch(page.url)).text();
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
          const html = await (await fetch(page.url)).text();
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
          const plaque = stationOf(await (await fetch(page.url)).text(), '1', 'specifying');
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
          const face = await (await fetch(page.url)).text();
          assert.match(articleOf(face, '1'), /aria-label="Поломка"/);
          assert.equal(face.includes('role="dialog"'), false);
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'repair', key: '1'}).toString()))
              .status,
            303,
          );
          const html = await (await fetch(page.url)).text();
          const dialog = between(html, '<div class="popup repair"', '</div></div>');
          assert.match(dialog, /каталога нет/);
          assert.equal(dialog.includes('<select'), false);
          assert.equal(dialog.includes('name="name"'), false);
          assert.equal(html.includes('aria-label="Настройки"'), false);
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
          const html = await (await fetch(page.url)).text();
          const row = articleOf(html, '1');
          assert.match(html, /нужна модель judgment/);
          assert.match(
            row,
            /<button class="round play off" type="submit" disabled aria-label="Взять">/,
          );
          assert.equal(row.includes('aria-label="Поломка"'), false);
          assert.equal(html.includes('role="dialog"'), false);
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'repair', key: '1'}).toString()))
              .status,
            303,
          );
          const after = await (await fetch(page.url)).text();
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
        const face = await (await fetch(page.url)).text();
        assert.match(articleOf(face, '1'), /aria-label="Поломка"/);
        assert.equal(
          (await post(page.url, 'act', new URLSearchParams({act: 'repair', key: '1'}).toString()))
            .status,
          303,
        );
        const html = await (await fetch(page.url)).text();
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
            303,
          );
          const shot = await readSnapshot(page.url);
          assert.ok(shot.opened);
          assert.equal(shot.opened.spine.pull, true);
          assert.ok(shot.opened.spine.capabilities.some(item => item.id === 'section-text'));
          assert.equal(
            shot.opened.spine.capabilities.every(item => item.requirements.length === 0),
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
            303,
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
          assert.equal(
            (
              await post(
                page.url,
                'act',
                new URLSearchParams({act: 'answer', key: '1', reply: ''}).toString(),
              )
            ).status,
            303,
          );
          const first = await readSnapshot(page.url);
          assert.equal(first.status, 'Комментарий пустой. Напишите его в поле.');
          const second = await readSnapshot(page.url);
          assert.equal(second.status, undefined);
        },
      );
    });
  });
});

spec('sidebar', () => {
  requirement('The open row shows only the blocks the cycle has', () => {
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
            303,
          );
          const first = await (await fetch(page.url)).text();
          assert.match(articleOf(first, '1'), /class="ticket is-open"/);
          assert.equal(articleOf(first, '2').includes('is-open'), false);
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '2'}).toString()))
              .status,
            303,
          );
          const second = await (await fetch(page.url)).text();
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
          const before = await (await fetch(page.url)).text();
          const neighbor = articleOf(before, '2');
          assert.equal(neighbor.match(/data-station=/g)?.length, 7);
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            303,
          );
          const after = await (await fetch(page.url)).text();
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
    scenario('The settings sheet has one close button', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [bare('1', 'Quiet')]},
        async (page, window) => {
          window.chooseAgent('cursor');
          const closed = await (await fetch(page.url)).text();
          assert.equal(closed.includes('role="dialog"'), false);
          assert.match(closed, /name="act" value="open-settings"/);
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open-settings'}).toString()))
              .status,
            303,
          );
          const sheet = await (await fetch(page.url)).text();
          assert.match(sheet, /role="dialog" aria-label="Настройки"/);
          assert.equal(sheet.match(/value="close-settings"/g)?.length, 1);
          assert.match(sheet, /aria-label="Закрыть"/);
          assert.equal(/>\s*Закрыть\s*</.test(sheet), false);
          assert.match(sheet, /name="act" value="open-settings"/);
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
            303,
          );
          const opened = await (await fetch(page.url)).text();
          assert.match(opened, /<aside class="sidebar" data-key="1"/);
          assert.match(articleOf(opened, '1'), /is-open/);
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            303,
          );
          const closed = await (await fetch(page.url)).text();
          assert.equal(closed.includes('class="sidebar"'), false);
          assert.equal(articleOf(closed, '1').includes('is-open'), false);
        },
      );
    });
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
            303,
          );
          const html = await (await fetch(page.url)).text();
          const side = bandOf(html, '1');
          assert.match(side, /id="spine-Plan"/);
          assert.match(side, /Годность или список проблем/);
          assert.match(side, /- \[ \] Писать ли имя проверки\?/);
          assert.match(side, /id="spine-Code"[^>]*checked/);
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
            303,
          );
          const side = bandOf(await (await fetch(page.url)).text(), '1');
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
            303,
          );
          const html = await (await fetch(page.url)).text();
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
            303,
          );
          const planHead =
            spineOf(await (await fetch(page.url)).text(), '1', 'Plan').split(
              '<div class="fold">',
            )[0] ?? '';
          assert.match(planHead, /id="spine-Plan"[^>]*checked/);
          assert.equal(planHead.includes('class="sentence"'), false);
          assert.match(planHead, /<span class="excerpt">Первая строка исхода\.<\/span>/);
        },
      );
    });
    scenario('A line comment quotes the line', async () => {
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
          writeChange(paths.arcadia, '1', 'proposal.md', '## Scope\n\nСайдбар читает ветку.\n');
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            303,
          );
          const html = await (await fetch(page.url)).text();
          const side = bandOf(html, '1');
          assert.match(
            side,
            /<button type="button" class="line" data-line="Сайдбар читает ветку\."/,
          );
          assert.match(html, /\.spine button\.line:hover/);
          assert.equal(
            (
              await post(
                page.url,
                'act',
                new URLSearchParams({
                  act: 'answer',
                  key: '1',
                  line: 'Сайдбар читает ветку.',
                  reply: 'Здесь узко.',
                }).toString(),
              )
            ).status,
            303,
          );
          assert.deepEqual(comments, ['> Сайдбар читает ветку.\n\nЗдесь узко.']);
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
            303,
          );
          const side = bandOf(await (await fetch(page.url)).text(), '1');
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
            303,
          );
          const side = bandOf(await (await fetch(page.url)).text(), '1');
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
            303,
          );
          const side = bandOf(await (await fetch(page.url)).text(), '1');
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
            303,
          );
          const side = bandOf(await (await fetch(page.url)).text(), '1');
          assert.match(side, /План принимается, когда открытых вопросов не останется\./);
          assert.match(side, /data-question="Писать ли имя проверки\?"/);
        },
      );
    });
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
            303,
          );
          const html = await (await fetch(page.url)).text();
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
          assert.match(html, /draftsAfterClick\(openDrafts\(\), targetLine\)/);
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
            303,
          );
          const html = await (await fetch(page.url)).text();
          assert.match(html, /headClickToggles\(event\.target\)/);
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
            303,
          );
          const html = await (await fetch(page.url)).text();
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
    scenario('Escape closes the line field', async () => {
      assert.equal(lineFieldClosesOnEscape('Escape', true), true);
      assert.equal(lineFieldClosesOnEscape('Escape', false), false);
      assert.equal(lineFieldClosesOnEscape('Enter', true), false);
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing')]},
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            303,
          );
          const html = await (await fetch(page.url)).text();
          assert.match(html, /lineFieldClosesOnEscape\(event\.key, Boolean\(form\)\)/);
        },
      );
    });
    scenario('The Design row shows the named parts', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'designing')]},
        async (page, window, paths) => {
          writeChange(
            paths.arcadia,
            '1',
            'design.md',
            [
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
            303,
          );
          const side = bandOf(await (await fetch(page.url)).text(), '1');
          assert.match(side, /Одна проверка/);
          assert.match(side, /Один модуль/);
          assert.match(side, /Отклонено: второй модуль/);
          assert.match(side, /- \[ \] имя/);
          assert.equal(side.includes('Лишнее'), false);
          assert.equal(side.includes('Не показывать'), false);
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
            303,
          );
          const side = bandOf(await (await fetch(page.url)).text(), '1');
          assert.match(side, /Diff есть/);
          assert.equal(side.includes('diff --git'), false);
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
            303,
          );
          const html = await (await fetch(page.url)).text();
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
            303,
          );
          const side = bandOf(await (await fetch(page.url)).text(), '1');
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
            303,
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
          assert.equal(empty.status, 303);
          assert.match(statusOf(await (await fetch(page.url)).text()), /Ответ пустой/);
          assert.equal((await (await fetch(page.url)).text()).includes('role="status"'), false);
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
            303,
          );
          assert.deepEqual(comments, ['- [ ] Писать ли имя проверки?\n\nДа, короткое имя.']);
          assert.match(readFileSync(file, 'utf8'), /- \[ \] Писать ли имя проверки\?/);
          assert.equal((await (await fetch(page.url)).text()).includes('role="status"'), false);
        },
      );
    });
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
            303,
          );
          assert.match(
            bandOf(await (await fetch(page.url)).text(), '1'),
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
            303,
          );
          assert.deepEqual(comments, ['Сначала сократить Outcome.']);
        },
      );
    });
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
            303,
          );
          const asking = bandOf(await (await fetch(page.url)).text(), '1');
          assert.match(asking, /<label class="draft">Комментарий/);
          assert.equal(asking.includes('Принять Plan'), false);
          writeChange(paths.arcadia, '1', 'proposal.md', '## Outcome\n\nГодность.\n');
          const side = bandOf(await (await fetch(page.url)).text(), '1');
          assert.match(side, /aria-label="Принять Plan"/);
          assert.equal(
            (
              await post(
                page.url,
                'act',
                new URLSearchParams({act: 'accept-review', key: '1'}).toString(),
              )
            ).status,
            303,
          );
          assert.ok(tickets[0]?.labels.includes('sdd:proposed'));
          assert.ok(tickets[0]?.labels.includes('sdd:proposing'));
          assert.deepEqual(phases, []);
          assert.equal((await (await fetch(page.url)).text()).includes('role="status"'), false);
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
            303,
          );
          assert.match(bandOf(await (await fetch(page.url)).text(), '1'), /Принять Specify/);
          assert.equal(
            (
              await post(
                page.url,
                'act',
                new URLSearchParams({act: 'accept-review', key: '1'}).toString(),
              )
            ).status,
            303,
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
            303,
          );
          assert.match(bandOf(await (await fetch(page.url)).text(), '1'), /Принять Design/);
          assert.equal(
            (
              await post(
                page.url,
                'act',
                new URLSearchParams({act: 'accept-review', key: '1'}).toString(),
              )
            ).status,
            303,
          );
          assert.ok(tickets[0]?.labels.includes('sdd:designed'));
          assert.ok(tickets[0]?.labels.includes('sdd:designing'));
        },
      );
    });
  });
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
          const closed = await (await fetch(page.url)).text();
          assert.match(stationOf(closed, '1', 'proposing'), /<span class="dot"/);
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            303,
          );
          const html = await (await fetch(page.url)).text();
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
          assert.equal(posted.status, 303);
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
            303,
          );
          const html = await (await fetch(page.url)).text();
          assert.match(glineOf(html, '1', 'designing'), /гейт designing/);
          assert.match(html, /\.stop\s*\{[^}]*width:\s*18px[^}]*height:\s*18px/);
          assert.match(html, /\.stop svg\s*\{[^}]*width:\s*18px[^}]*height:\s*18px/);
          assert.match(stationOf(html, '1', 'designing'), /aria-label="design"/);
          assert.equal(stationOf(html, '1', 'designing').includes('гейт'), false);
        },
      );
    });
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
            303,
          );
          const html = await (await fetch(page.url)).text();
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
            303,
          );
          const plan = spineOf(await (await fetch(page.url)).text(), '1', 'Plan');
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
            303,
          );
          const specify = spineOf(await (await fetch(page.url)).text(), '1', 'Specify');
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
              303,
            );
            const specify = spineOf(await (await fetch(page.url)).text(), '1', 'Specify');
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
            303,
          );
          const specify = spineOf(await (await fetch(page.url)).text(), '1', 'Specify');
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
            303,
          );
          const specify = spineOf(await (await fetch(page.url)).text(), '1', 'Specify');
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
            303,
          );
          const specify = spineOf(await (await fetch(page.url)).text(), '1', 'Specify');
          assert.equal(specify.includes('Принять Specify'), false);
          assert.equal(specify.includes('data-gate="specifying"'), false);
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
          const closed = await (await fetch(page.url)).text();
          assert.equal(articleOf(closed, '1').includes('class="verb"'), false);
          assert.equal(articleOf(closed, '2').includes('class="verb"'), false);
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            303,
          );
          const html = await (await fetch(page.url)).text();
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
