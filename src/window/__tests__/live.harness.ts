import type {IssueRecord, Runtime, Vcs} from '../../machine/port.ts';
import type {RunningTurn} from '../../main.ts';
import type {WindowSnapshot} from '../snapshot.ts';

import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

import {machine} from '../../adapters/compose.ts';
import {memoryPorts} from '../../adapters/tracker/github.ts';
import {applyTurn, turnsLine, watchSpy, type LiveReview, type LiveTracker} from '../live.ts';


const MANAGER = 'ada';

function writeQueues(checkout: string): void {
  const dir = path.join(checkout, 'openspec');
  mkdirSync(dir, {recursive: true});
  writeFileSync(
    path.join(dir, 'config.yaml'),
    ['sdd:', '  queues:', '    - name: remote-solver', ''].join('\n'),
  );
}

export function yard(): {
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
    blockedBy: [],
    blocks: [],
  };
  const other: IssueRecord = {
    key: '9',
    title: 'Not a cycle',
    body: '',
    state: 'OPEN',
    labels: ['remote-solver'],
    assignee: '',
    dependsOn: [],
    blockedBy: [],
    blocks: [],
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
    openThread: async () => {},
  };
  return {dir, github, homePath: path.join(dir, 'home.yaml'), cycle, tracker, review};
}

/** One worker commits create-proposal, then restore-baseline commits nothing. Waits through the next poll. */
export async function laterTurn(): Promise<{lines: string[]; runs: number}> {
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
  const root = mkdtempSync(path.join(tmpdir(), 'later-turn-'));
  const box = machine(root, {
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
  const beat = async () => {
    if (!cleared) {
      return;
    }
    pollsAfter += 1;
    if (pollsAfter >= 2) {
      release();
    }
  };
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
        await beat();
      },
      apply() {
        return beat();
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
  rmSync(root, {recursive: true, force: true});
  assert.equal(outcome, 'gone', lines.join('\n'));
  return {lines, runs};
}

export async function post(url: string, pathname: string, body: string): Promise<number> {
  const response = await fetch(new URL(pathname, url), {
    method: 'POST',
    headers: {'content-type': 'application/x-www-form-urlencoded'},
    body,
    redirect: 'manual',
  });
  return response.status;
}

export async function readSnapshot(url: string): Promise<WindowSnapshot> {
  const response = await fetch(new URL('/snapshot', url));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  return response.json() as Promise<WindowSnapshot>;
}
