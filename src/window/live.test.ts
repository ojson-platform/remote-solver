import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {homedir, tmpdir} from 'node:os';
import path from 'node:path';
import {requirement, scenario, spec} from '@ojson/spec-coverage';
import {test, vi} from 'vitest';

import {machine} from '../adapters/compose.ts';
import {memoryPorts} from '../adapters/github.ts';
import type {RunningTurn} from '../main.ts';
import type {IssueRecord, Runtime, Vcs} from '../machine/port.ts';
import {modelFor} from '../machine/skill.ts';
import {
  applyTurn,
  boardModel,
  defaultHomePath,
  noteTurn,
  openLiveBoard,
  REFRESH_MS,
  serveLiveBoard,
  turnsLine,
  watchSpy,
  type LiveReview,
  type LiveTracker,
} from './live.ts';
import type {WindowSnapshot} from './snapshot.ts';
import {openWindow, type WindowTicket} from './window.ts';

const MANAGER = 'ada';

/** One worker commits create-proposal, then restore-baseline commits nothing. Waits through the next poll. */
async function laterTurn(): Promise<{lines: string[]; runs: number}> {
  const {tracker, review} = memoryPorts({
    user: MANAGER,
    issues: [
      {
        key: '6',
        title: 'Show the whole Plan',
        body: '',
        state: 'OPEN',
        labels: ['remote-solver', 'sdd:cycle', 'sdd:proposing', 'sdd:auto-plan'],
        assignee: MANAGER,
      },
    ],
    pulls: {6: [{id: '11', title: '#6: Show the whole Plan', state: 'OPEN'}]},
  });
  const proposalPath = path.join('openspec', 'changes', 'issue-6', 'proposal.md');
  const proposal = [
    '## Capabilities',
    '',
    '### Modified',
    '',
    '- section-text rows show the whole section',
    '',
  ].join('\n');
  let written = false;
  const vcs: Vcs = {
    prepare: async () => '',
    tip: async () => 'abc',
    filesAt: () => ({
      exists: rel => written && rel === proposalPath,
      read: rel => (written && rel === proposalPath ? proposal : ''),
      list: () => [],
    }),
    compare: async () => null,
    push: async () => {},
    head: async () => 'abc',
    published: async () => true,
    dirty: async () => [],
  };
  const lines: string[] = [];
  const turns = new Map<string, RunningTurn>();
  let cleared = false;
  let pollsAfter = 0;
  let release: () => void = () => {};
  const settled = new Promise<void>(resolve => {
    release = resolve;
  });
  let runs = 0;
  const runtime: Runtime = {
    async run() {
      runs += 1;
      if (runs === 1) {
        written = true;
        return {commits: 1};
      }
      return {commits: 0};
    },
    async ask() {
      return {text: ''};
    },
  };
  const box = machine(tmpdir(), {
    config: {
      queues: [{name: 'remote-solver'}],
      base: 'master',
      branchScope: 'sdd',
      ignoreComments: [],
    },
    tracker,
    review,
    vcs,
    runtime,
  });
  const controller = new AbortController();
  const done = watchSpy(
    box,
    {
      running: new Set<string>(),
      setTurn(issue, turn) {
        applyTurn(turns, issue, turn);
        const line = turnsLine([...turns.values()]);
        lines.push(line);
        if (line === '' && lines.some(item => item.includes('restore-baseline'))) {
          cleared = true;
        }
      },
      async refresh() {
        if (!cleared) {
          return;
        }
        pollsAfter += 1;
        if (pollsAfter >= 2) {
          release();
        }
      },
    },
    controller.signal,
  );
  const outcome = await Promise.race([
    settled.then(() => 'gone' as const),
    new Promise<'stuck'>(resolve => {
      setTimeout(() => resolve('stuck'), 8000);
    }),
  ]);
  controller.abort();
  await done;
  assert.equal(outcome, 'gone', lines.join('\n'));
  return {lines, runs};
}

function articleOf(html: string, key: string): string {
  const at = html.indexOf(`data-key="${key}"`);
  assert.ok(at >= 0, key);
  return html.slice(html.lastIndexOf('<article', at), html.indexOf('</article>', at));
}

function stationOf(html: string, key: string, name: string): string {
  const article = articleOf(html, key);
  const marker = `data-station="${name}"`;
  const at = article.indexOf(marker);
  assert.ok(at >= 0, name);
  const next = article.indexOf('data-station="', at + marker.length);
  return article.slice(at, next === -1 ? article.length : next);
}

function writeQueues(checkout: string): void {
  const dir = path.join(checkout, 'openspec');
  mkdirSync(dir, {recursive: true});
  writeFileSync(
    path.join(dir, 'config.yaml'),
    ['sdd:', '  queues:', '    - name: remote-solver', ''].join('\n'),
  );
}

async function post(url: string, pathname: string, body: string): Promise<number> {
  const response = await fetch(new URL(pathname, url), {
    method: 'POST',
    headers: {'content-type': 'application/x-www-form-urlencoded'},
    body,
    redirect: 'manual',
  });
  return response.status;
}

async function readSnapshot(url: string): Promise<WindowSnapshot> {
  const response = await fetch(new URL('/snapshot', url));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  return response.json() as Promise<WindowSnapshot>;
}

function yard(): {
  dir: string;
  github: string;
  homePath: string;
  cycle: IssueRecord;
  tracker: LiveTracker;
  review: LiveReview;
} {
  const dir = mkdtempSync(path.join(tmpdir(), 'board-live-'));
  const github = path.join(dir, 'github');
  writeQueues(path.join(github, 'acme', 'billing'));
  const cycle: IssueRecord = {
    key: '6',
    title: 'Show the whole Plan',
    body: '',
    state: 'OPEN',
    labels: ['sdd:cycle', 'remote-solver'],
    assignee: '',
    dependsOn: [],
  };
  const other: IssueRecord = {
    key: '9',
    title: 'Not a cycle',
    body: '',
    state: 'OPEN',
    labels: ['remote-solver'],
    assignee: '',
    dependsOn: [],
  };
  const tracker: LiveTracker = {
    login: async () => MANAGER,
    listOpen: async () => [cycle, other],
    async assign(key, login) {
      const found = [cycle, other].find(item => item.key === key);
      if (found) {
        found.assignee = login;
      }
    },
    async editLabels(key, add, remove) {
      const found = [cycle, other].find(item => item.key === key);
      if (!found) {
        return;
      }
      found.labels = found.labels.filter(label => !remove.includes(label));
      for (const label of add) {
        if (!found.labels.includes(label)) {
          found.labels.push(label);
        }
      }
    },
    comments: async () => [],
  };
  const review: LiveReview = {
    pulls: async () => [],
    threadList: async () => [],
    comments: async () => [],
    range: async () => ({head: '', base: null}),
    speak: async () => {},
  };
  return {dir, github, homePath: path.join(dir, 'home.yaml'), cycle, tracker, review};
}

spec('board', () => {
  requirement('The board command serves this repository', () => {
    scenario('The home file is the factory file when the command names none', () => {
      assert.equal(defaultHomePath(), path.join(homedir(), '.aifactory', 'config.yaml'));
    });

    scenario('The served page answers at its URL', async () => {
      const staged = yard();
      const page = await serveLiveBoard({
        homePath: staged.homePath,
        repo: 'acme/billing',
        tracker: staged.tracker,
        review: staged.review,
        githubRoot: staged.github,
      });
      try {
        assert.match(page.url, /^http:\/\/127\.0\.0\.1:\d+\/$/);
        assert.equal((await fetch(page.url)).status, 200);
      } finally {
        await page.close();
        rmSync(staged.dir, {recursive: true, force: true});
      }
    });

    scenario('Another repository stays under the GitHub root', () => {
      const staged = yard();
      const here = path.join(staged.dir, 'here');
      const other = path.join(staged.github, 'acme', 'other');
      mkdirSync(here, {recursive: true});
      mkdirSync(path.join(other, 'openspec'), {recursive: true});
      writeFileSync(
        path.join(other, 'openspec', 'config.yaml'),
        ['sdd:', '  queues:', '    - name: remote-solver', ''].join('\n'),
      );
      writeFileSync(
        staged.homePath,
        [
          'watch:',
          '  - acme/billing',
          '  - acme/other',
          'roots:',
          `  github: ${staged.github}`,
          '',
        ].join('\n'),
      );
      const tickets: WindowTicket[] = [
        {
          key: '6',
          title: 'Here',
          labels: ['sdd:cycle', 'remote-solver'],
          assignee: '',
          repo: 'acme/billing',
          sddService: '',
        },
        {
          key: '7',
          title: 'Other',
          labels: ['sdd:cycle', 'remote-solver'],
          assignee: '',
          repo: 'acme/other',
          sddService: '',
        },
      ];
      try {
        const window = openWindow(
          {
            homePath: staged.homePath,
            adapter: 'github',
            repoDir: {repo: 'acme/billing', dir: here},
          },
          {tickets: () => tickets, login: () => MANAGER},
        );
        const cards = [
          ...window.board().pool,
          ...window.board().columns.flatMap(column => column.cards),
        ];
        assert.equal(cards.find(card => card.key === '6')?.checkout, here);
        assert.equal(cards.find(card => card.key === '7')?.checkout, other);
      } finally {
        rmSync(staged.dir, {recursive: true, force: true});
      }
    });

    scenario('The page reads the tracker again while it stays open', async () => {
      vi.useFakeTimers();
      const staged = yard();
      let reads = 0;
      const listOpen = staged.tracker.listOpen;
      staged.tracker.listOpen = async () => {
        reads += 1;
        return listOpen();
      };
      const page = await serveLiveBoard({
        homePath: staged.homePath,
        repo: 'acme/billing',
        tracker: staged.tracker,
        review: staged.review,
        githubRoot: staged.github,
      });
      try {
        const afterOpen = reads;
        await vi.advanceTimersByTimeAsync(REFRESH_MS);
        assert.ok(reads > afterOpen);
      } finally {
        await page.close();
        vi.useRealTimers();
        rmSync(staged.dir, {recursive: true, force: true});
      }
    });

    scenario('The page pool lists a cycle in this repository', async () => {
      const staged = yard();
      const page = await serveLiveBoard({
        homePath: staged.homePath,
        repo: 'acme/billing',
        tracker: staged.tracker,
        review: staged.review,
        githubRoot: staged.github,
      });
      try {
        const html = await (await fetch(page.url)).text();
        assert.match(articleOf(html, '6'), /class="ticket pool"/);
        assert.match(html, /Show the whole Plan/);
        assert.equal(html.includes('data-key="9"'), false);
        assert.match(readFileSync(staged.homePath, 'utf8'), /acme\/billing/);
      } finally {
        await page.close();
        rmSync(staged.dir, {recursive: true, force: true});
      }
    });

    scenario('A taken cycle gains proposing on the page', async () => {
      const staged = yard();
      const page = await serveLiveBoard({
        homePath: staged.homePath,
        repo: 'acme/billing',
        tracker: staged.tracker,
        review: staged.review,
        githubRoot: staged.github,
      });
      try {
        assert.equal(await post(page.url, '/act', 'act=choose-agent&agent=cursor'), 303);
        assert.equal(await post(page.url, '/take', 'key=6'), 303);
        const html = await (await fetch(page.url)).text();
        assert.equal(staged.cycle.assignee, MANAGER);
        assert.ok(staged.cycle.labels.includes('sdd:proposing'));
        assert.match(stationOf(html, '6', 'proposing'), /class="plaque"/);
        assert.doesNotMatch(articleOf(html, '6'), /class="ticket pool"/);
      } finally {
        await page.close();
        rmSync(staged.dir, {recursive: true, force: true});
      }
    });

    scenario('The working directory is the gathered checkout', async () => {
      const staged = yard();
      const service = path.join(staged.github, 'acme', 'billing');
      const live = openLiveBoard({
        homePath: staged.homePath,
        repo: 'acme/billing',
        tracker: staged.tracker,
        review: staged.review,
        githubRoot: path.join(staged.dir, 'empty-root'),
        checkout: service,
      });
      try {
        await live.refresh();
        const card = live.window.board().pool.find(item => item.key === '6');
        assert.equal(card?.checkout, service);
        assert.equal(card?.reason ?? '', '');
      } finally {
        rmSync(staged.dir, {recursive: true, force: true});
      }
    });

    scenario('The spy starts an agent for a proposing cycle', async () => {
      const {tracker, review} = memoryPorts({
        user: MANAGER,
        issues: [
          {
            key: '6',
            title: 'Show the whole Plan',
            body: '',
            state: 'OPEN',
            labels: ['remote-solver', 'sdd:cycle', 'sdd:proposing'],
            assignee: MANAGER,
          },
        ],
      });
      const vcs: Vcs = {
        prepare: async () => '',
        tip: async () => 'abc',
        filesAt: () => ({exists: () => false, read: () => '', list: () => []}),
        compare: async () => null,
        push: async () => {},
        head: async () => 'abc',
        published: async () => true,
        dirty: async () => [],
      };
      const notes: string[] = [];
      const turns = new Map<string, RunningTurn>();
      const sink = {
        running: new Set<string>(),
        setNote(line: string) {
          notes.push(line);
        },
        setTurn(issue: string, turn: RunningTurn | undefined) {
          applyTurn(turns, issue, turn);
        },
        refresh: async () => {},
      };
      let leading = false;
      const runs: string[] = [];
      let release: () => void = () => {};
      const started = new Promise<void>(resolve => {
        release = resolve;
      });
      const runtime: Runtime = {
        async run(skill) {
          runs.push(`${skill.key} ${skill.action}`);
          leading = sink.running.has(skill.key);
          assert.equal(turnsLine([...turns.values()]), '#6 proposing → create-proposal');
          release();
          return {commits: 0};
        },
        async ask() {
          return {text: ''};
        },
      };
      const box = machine(tmpdir(), {
        config: {
          queues: [{name: 'remote-solver'}],
          base: 'master',
          branchScope: 'sdd',
          ignoreComments: [],
        },
        tracker,
        review,
        vcs,
        runtime,
      });
      const controller = new AbortController();
      const done = watchSpy(box, sink, controller.signal);
      await started;
      controller.abort();
      await done;
      assert.deepEqual(runs, ['6 create-proposal']);
      assert.equal(leading, true);
      assert.ok(notes.some(line => line.includes('#6 start proposing → create-proposal')));
    });

    scenario('The spy line follows the next turn and then goes', async () => {
      const {lines} = await laterTurn();
      assert.ok(lines.includes('#6 specifying → restore-baseline'));
      assert.equal(lines.at(-1), '');
    });

    scenario("Another worker's line stays", () => {
      const turns = new Map<string, RunningTurn>();
      applyTurn(turns, '6', {issue: '6', phase: 'specifying', action: 'restore-baseline'});
      applyTurn(turns, '7', {issue: '7', phase: 'proposing', action: 'create-proposal'});
      applyTurn(turns, '6', undefined);
      assert.equal(turnsLine([...turns.values()]), '#7 proposing → create-proposal');
    });

    scenario('The page shows the spy line', async () => {
      const staged = yard();
      const page = await serveLiveBoard({
        homePath: staged.homePath,
        repo: 'acme/billing',
        tracker: staged.tracker,
        review: staged.review,
        githubRoot: staged.github,
        spyNote: () => '#6 start proposing → create-proposal',
      });
      try {
        const html = await (await fetch(page.url)).text();
        assert.match(html, /#6 start proposing → create-proposal/);
      } finally {
        await page.close();
        rmSync(staged.dir, {recursive: true, force: true});
      }
    });

    scenario('A cursor home model is the step model', () => {
      const dir = mkdtempSync(path.join(tmpdir(), 'board-model-'));
      const home = path.join(dir, 'home.yaml');
      const checkout = path.join(dir, 'repo');
      mkdirSync(checkout);
      writeFileSync(
        home,
        [
          'agent: cursor',
          'models:',
          '  mechanical: custom-mechanical',
          '  judgment: grok-4.7-high-fast',
          '',
        ].join('\n'),
      );
      try {
        assert.equal(boardModel(home, checkout, 'mechanical'), 'custom-mechanical');
        assert.equal(boardModel(home, checkout, 'judgment'), 'grok-4.7-high-fast');
      } finally {
        rmSync(dir, {recursive: true, force: true});
      }
    });

    scenario('An empty home agent keeps the built-in model', () => {
      const dir = mkdtempSync(path.join(tmpdir(), 'board-model-empty-'));
      const home = path.join(dir, 'home.yaml');
      const checkout = path.join(dir, 'repo');
      mkdirSync(checkout);
      writeFileSync(home, ['models:', '  mechanical: custom-mechanical', ''].join('\n'));
      try {
        assert.equal(boardModel(home, checkout, 'mechanical'), modelFor('mechanical'));
      } finally {
        rmSync(dir, {recursive: true, force: true});
      }
    });

    scenario('A home agent other than cursor keeps the built-in model', () => {
      const dir = mkdtempSync(path.join(tmpdir(), 'board-model-other-'));
      const home = path.join(dir, 'home.yaml');
      const checkout = path.join(dir, 'repo');
      mkdirSync(checkout);
      writeFileSync(
        home,
        ['agent: codex', 'models:', '  mechanical: custom-mechanical', ''].join('\n'),
      );
      try {
        assert.equal(boardModel(home, checkout, 'mechanical'), modelFor('mechanical'));
      } finally {
        rmSync(dir, {recursive: true, force: true});
      }
    });

    scenario('The snapshot is JSON beside the page', async () => {
      const staged = yard();
      const page = await serveLiveBoard({
        homePath: staged.homePath,
        repo: 'acme/billing',
        tracker: staged.tracker,
        review: staged.review,
        githubRoot: staged.github,
      });
      try {
        const html = await fetch(page.url);
        assert.equal(html.status, 200);
        assert.match(html.headers.get('content-type') ?? '', /^text\/html/);
        assert.match(await html.text(), /<!doctype html>/);
        const shot = await readSnapshot(page.url);
        assert.equal(shot.generation, 0);
        assert.equal(typeof shot.lamp, 'boolean');
        assert.equal(shot.spy, '');
        assert.ok(shot.rows.some(row => row.key === '6'));
      } finally {
        await page.close();
        rmSync(staged.dir, {recursive: true, force: true});
      }
    });

    scenario('The snapshot generation moves', async () => {
      const staged = yard();
      const turns = new Map<string, RunningTurn>();
      const page = await serveLiveBoard({
        homePath: staged.homePath,
        repo: 'acme/billing',
        tracker: staged.tracker,
        review: staged.review,
        githubRoot: staged.github,
        spyNote: () => turnsLine([...turns.values()]),
        turn: key => turns.get(key)?.action,
      });
      try {
        const read = () => readSnapshot(page.url);
        assert.equal((await read()).generation, 0);
        assert.equal((await read()).spy, '');
        const html = await fetch(page.url);
        assert.match(await html.text(), /<!doctype html>/);
        assert.equal((await read()).generation, 0);
        assert.equal(await post(page.url, '/act', 'act=not-a-gesture'), 400);
        assert.equal((await read()).generation, 0);
        const turn = {issue: '6', phase: 'specifying', action: 'restore-baseline'};
        noteTurn(turns, '6', turn, () => {
          page.note();
        });
        const named = await read();
        assert.equal(named.generation, 1);
        assert.equal(named.spy, '#6 specifying → restore-baseline');
        noteTurn(turns, '6', {...turn}, () => {
          page.note();
        });
        assert.equal((await read()).generation, 1);
        assert.equal(await post(page.url, '/act', 'act=open&key=6'), 303);
        assert.equal((await read()).generation, 2);
        await page.refresh();
        assert.equal((await read()).generation, 3);
        noteTurn(turns, '6', undefined, () => {
          page.note();
        });
        const gone = await read();
        assert.equal(gone.generation, 4);
        assert.equal(gone.spy, '');
      } finally {
        await page.close();
        rmSync(staged.dir, {recursive: true, force: true});
      }
    });
  });

  requirement("A column shows this manager's cycles", () => {
    scenario('One open pull request leaves proposing in place', async () => {
      const staged = yard();
      staged.cycle.labels = ['sdd:cycle', 'remote-solver', 'sdd:proposing'];
      staged.cycle.assignee = MANAGER;
      staged.review.pulls = async () => [
        {id: '11', title: '#6: Show the whole Plan', state: 'OPEN', checks: 'green'},
      ];
      const live = openLiveBoard({
        homePath: staged.homePath,
        repo: 'acme/billing',
        tracker: staged.tracker,
        review: staged.review,
        githubRoot: staged.github,
      });
      try {
        await live.refresh();
        const board = live.window.board();
        const proposing = board.columns.find(column => column.name === 'proposing');
        const card = proposing?.cards.find(item => item.key === '6');
        assert.ok(card);
        assert.equal(card.reason?.includes('мерж') ?? false, false);
        assert.equal(
          board.columns.some(
            column => column.name === 'accepting' && column.cards.some(item => item.key === '6'),
          ),
          false,
        );
      } finally {
        rmSync(staged.dir, {recursive: true, force: true});
      }
    });
  });

  requirement('A station door opens the port and does not write a phase', () => {
    scenario('A door opens the port and does not write a phase', async () => {
      const staged = yard();
      staged.cycle.labels = ['sdd:cycle', 'remote-solver', 'sdd:specifying'];
      staged.review.pulls = async () => [
        {id: '11', title: '#6: Show the whole Plan', state: 'OPEN', checks: 'green'},
      ];
      const live = openLiveBoard({
        homePath: staged.homePath,
        repo: 'acme/billing',
        tracker: staged.tracker,
        review: staged.review,
        githubRoot: staged.github,
      });
      try {
        await live.refresh();
        assert.equal(
          live.window.doorPlace('openspec/changes/issue-6/proposal.md'),
          'https://github.com/acme/billing/blob/refs/pull/11/head/openspec/changes/issue-6/proposal.md#L1',
        );
      } finally {
        rmSync(staged.dir, {recursive: true, force: true});
      }
    });
  });
});

spec('idle', () => {
  requirement('A run with no commit is not repeated', () => {
    scenario('A later turn with no commit stays idle', async () => {
      const {lines, runs} = await laterTurn();
      assert.equal(runs, 2);
      assert.equal(lines.filter(line => line.includes('restore-baseline')).length, 1);
      assert.equal(lines.at(-1), '');
    });
  });
});
