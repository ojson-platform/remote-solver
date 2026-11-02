import assert from 'node:assert/strict';
import {existsSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {parse, stringify} from 'yaml';
import {test} from 'vitest';

import {COLUMN_NAMES, type RoleRecord} from './types.ts';
import {openWindow} from './window.ts';
import {focusStaysInForm, gesture, payload, SHEET_FIELD_KEY, SHEET_SCROLL_KEY} from './client/gesture.ts';
import {serveBoard} from './page.ts';
import type {WindowSnapshot} from './snapshot.ts';
import {
  MANAGER,
  articleOf,
  bandOf,
  beginPost,
  between,
  boardState,
  delay,
  formsOf,
  hosted,
  idle,
  pageHtml,
  paint,
  pool,
  post,
  prepare,
  readSnapshot,
  saveControl,
  settingsState,
  shown,
  stationOf,
  statusOf,
  ticket,
  writeQueues,
  yard,
} from './page.harness.ts';

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
        }).toString(),
      );
      assert.equal(empty.status, 200);
      assert.deepEqual(agents, ['cursor']);
      assert.deepEqual(roles, []);
      const drafted = await post(
        page.url,
        'act',
        new URLSearchParams({
          act: 'add-role',
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
    assert.match(html, /\.sidebar\s*\{[^}]*position:\s*fixed[^}]*right:/);
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
