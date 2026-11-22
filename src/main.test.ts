import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {machine} from './adapters/compose.ts';
import {memoryPorts} from './adapters/tracker/github.ts';
import {runSpy} from './main.ts';
import type {Decision} from './machine/decide/policy.ts';
import type {Runtime, Vcs} from './machine/port.ts';
import {tick, type State} from './machine/spy/scheduler.ts';
import {openLiveBoard} from './window/live.ts';

const MANAGER = 'ada';

function readyCycles(count: number) {
  const issues = Array.from({length: count}, (_, index) => {
    const key = String(index + 1);
    return {
      key,
      title: `#${key}: title`,
      body: '',
      state: 'OPEN' as const,
      labels: ['remote-solver', 'sdd:cycle', 'sdd:proposing'],
      assignee: MANAGER,
    };
  });
  const pulls: Record<string, {id: string; title: string; state: 'OPEN'}[]> = {};
  for (const issue of issues) {
    pulls[issue.key] = [{id: `pull-${issue.key}`, title: issue.title, state: 'OPEN'}];
  }
  return memoryPorts({user: MANAGER, issues, pulls});
}

function spyMachine(ports: ReturnType<typeof memoryPorts>, runtime: Runtime) {
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
  return machine(tmpdir(), {
    config: {
      queues: [{name: 'remote-solver'}],
      base: 'master',
      branchScope: 'sdd',
      ignoreComments: [],
    },
    tracker: ports.tracker,
    review: ports.review,
    vcs,
    runtime,
  });
}

const idleRuntime: Runtime = {
  async run() {
    return {commits: 0};
  },
  async ask() {
    return {text: ''};
  },
};

function agent(issue: string): Extract<Decision, {kind: 'agent'}> {
  return {
    kind: 'agent',
    issue,
    action: 'create-proposal',
    skill: 'plan',
    phase: 'proposing',
    pr: '',
    reason: 'write proposal.md',
  };
}

const emptyCapState: State = {running: [], reported: {}};

spec('parallel-cap', () => {
  requirement('A poll starts at most the cap', () => {
    scenario('A cap of 2 starts two of three', () => {
      const turned = tick(
        emptyCapState,
        [agent('1'), agent('2'), agent('3')],
        2,
      );
      assert.deepEqual(
        turned.start.map(item => item.issue),
        ['1', '2'],
      );
    });

    scenario('Running workers fill the cap', () => {
      const running: State = {...emptyCapState, running: ['1', '2']};
      const turned = tick(running, [agent('3')], 2);
      assert.deepEqual(turned.start, []);
    });

    scenario('One free slot starts one ready cycle', () => {
      const state: State = {running: ['1'], reported: {}};
      const turned = tick(state, [agent('2'), agent('3')], 2);
      assert.deepEqual(
        turned.start.map(item => item.issue),
        ['2'],
      );
    });
  });

  requirement('The spy command defaults to 2 and honors --parallel', () => {
    scenario('No flag uses a cap of 2', async () => {
      const ports = readyCycles(3);
      const starts: string[] = [];
      const box = spyMachine(ports, idleRuntime);
      const controller = new AbortController();
      const done = runSpy(
        box,
        [],
        {
          signal: controller.signal,
          onReport(line: string) {
            if (line.includes(' start proposing → create-proposal')) {
              starts.push(line);
            }
            if (starts.length >= 2) {
              controller.abort();
            }
          },
        },
      );
      await done;
      assert.equal(starts.length, 2);
    });

    scenario('A positive --parallel is the cap', async () => {
      const ports = readyCycles(2);
      const starts: string[] = [];
      const box = spyMachine(ports, idleRuntime);
      const controller = new AbortController();
      const done = runSpy(
        box,
        ['--parallel', '1'],
        {
          signal: controller.signal,
          onReport(line: string) {
            if (line.includes(' start proposing → create-proposal')) {
              starts.push(line);
            }
            if (starts.length >= 1) {
              controller.abort();
            }
          },
        },
      );
      await done;
      assert.equal(starts.length, 1);
    });

    scenario('The spy keeps the default cap of 2 and honors --parallel', async () => {
      const ports = readyCycles(1);
      const notes: string[] = [];
      const box = spyMachine(ports, idleRuntime);

      const controllerDefault = new AbortController();
      const seenDefault = new Promise<void>(resolve => {
        void runSpy(box, [], {
          signal: controllerDefault.signal,
          onReport(line: string) {
            notes.push(line);
            if (/parallel 2\b/.test(line)) {
              resolve();
            }
          },
        });
      });
      await seenDefault;
      controllerDefault.abort();

      const controllerFlag = new AbortController();
      const seenFlag = new Promise<void>(resolve => {
        void runSpy(box, ['--parallel', '4'], {
          signal: controllerFlag.signal,
          onReport(line: string) {
            notes.push(line);
            if (/parallel 4\b/.test(line)) {
              resolve();
            }
          },
        });
      });
      await seenFlag;
      controllerFlag.abort();

      assert.ok(notes.some(line => /parallel 2\b/.test(line)));
      assert.ok(notes.some(line => /parallel 4\b/.test(line)));
    });
  });
});

function until(ready: () => boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (ready()) {
        clearInterval(timer);
        resolve();
        return;
      }
      if (Date.now() - started > 3_000) {
        clearInterval(timer);
        reject(new Error('timed out'));
      }
    }, 10);
  });
}

spec('board-command', () => {
  requirement('A page write starts the next poll', () => {
    scenario('A successful label write nudges the spy', async () => {
      const ports = memoryPorts({
        user: MANAGER,
        issues: [
          {
            key: '90',
            title: '#90: title',
            body: '',
            state: 'OPEN',
            labels: ['remote-solver', 'sdd:cycle', 'sdd:specifying'],
            assignee: MANAGER,
          },
        ],
        pulls: {'90': [{id: '93', title: '#90: title', state: 'OPEN'}]},
      });
      let nudges = 0;
      const home = mkdtempSync(path.join(tmpdir(), 'nudge-'));
      const live = openLiveBoard({
        homePath: path.join(home, 'config.yaml'),
        repo: 'acme/billing',
        tracker: ports.tracker,
        review: ports.review,
        nudge: () => {
          nudges += 1;
        },
      });
      await live.refresh();
      assert.equal(live.window.acceptReview('90'), undefined);
      await until(() => nudges === 1);
      assert.equal(nudges, 1);
    });

    scenario('A nudge during the wait reads again before the interval', async () => {
      const ports = memoryPorts({
        user: MANAGER,
        issues: [
          {
            key: '90',
            title: '#90: title',
            body: '',
            state: 'OPEN',
            labels: ['remote-solver', 'sdd:cycle', 'sdd:specifying', 'sdd:wait-human'],
            assignee: MANAGER,
          },
        ],
        pulls: {'90': [{id: '93', title: '#90: title', state: 'OPEN'}]},
      });
      let reads = 0;
      const listOpen = ports.tracker.listOpen.bind(ports.tracker);
      ports.tracker.listOpen = async () => {
        reads += 1;
        return listOpen();
      };
      const box = spyMachine(ports, idleRuntime);
      let nudge = () => {};
      let settled = false;
      const controller = new AbortController();
      const done = runSpy(box, ['--interval', '60'], {
        signal: controller.signal,
        onNudge(fn) {
          nudge = fn;
        },
        onReport(line) {
          if (line.startsWith('Poll settled')) {
            settled = true;
          }
        },
      });
      try {
        await until(() => settled);
        await new Promise(resolve => setTimeout(resolve, 50));
        const started = Date.now();
        nudge();
        await until(() => reads >= 2);
        assert.ok(Date.now() - started < 2_000);
      } finally {
        controller.abort();
        await done;
      }
    });

    scenario('A poll already reading finishes, then reads again at once', async () => {
      const ports = memoryPorts({
        user: MANAGER,
        issues: [
          {
            key: '90',
            title: '#90: title',
            body: '',
            state: 'OPEN',
            labels: ['remote-solver', 'sdd:cycle', 'sdd:specifying', 'sdd:wait-human'],
            assignee: MANAGER,
          },
        ],
        pulls: {'90': [{id: '93', title: '#90: title', state: 'OPEN'}]},
      });
      let reads = 0;
      let release: (() => void) | undefined;
      const listOpen = ports.tracker.listOpen.bind(ports.tracker);
      ports.tracker.listOpen = async () => {
        reads += 1;
        if (reads === 1) {
          await new Promise<void>(resolve => {
            release = resolve;
          });
        }
        return listOpen();
      };
      const box = spyMachine(ports, idleRuntime);
      let nudge = () => {};
      const controller = new AbortController();
      const done = runSpy(box, ['--interval', '60'], {
        signal: controller.signal,
        onNudge(fn) {
          nudge = fn;
        },
      });
      try {
        await until(() => reads === 1);
        nudge();
        const started = Date.now();
        release?.();
        await until(() => reads >= 2);
        assert.ok(Date.now() - started < 2_000);
      } finally {
        release?.();
        controller.abort();
        await done;
      }
    });

    scenario('A failed write leaves the interval', async () => {
      const ports = memoryPorts({
        user: MANAGER,
        issues: [
          {
            key: '90',
            title: '#90: title',
            body: '',
            state: 'OPEN',
            labels: ['remote-solver', 'sdd:cycle', 'sdd:specifying'],
            assignee: MANAGER,
          },
        ],
        pulls: {'90': [{id: '93', title: '#90: title', state: 'OPEN'}]},
      });
      ports.tracker.editLabels = async () => {
        throw new Error('github refused');
      };
      let nudges = 0;
      const home = mkdtempSync(path.join(tmpdir(), 'nudge-fail-'));
      const live = openLiveBoard({
        homePath: path.join(home, 'config.yaml'),
        repo: 'acme/billing',
        tracker: ports.tracker,
        review: ports.review,
        nudge: () => {
          nudges += 1;
        },
      });
      await live.refresh();
      assert.equal(live.window.acceptReview('90'), undefined);
      await new Promise(resolve => setTimeout(resolve, 30));
      assert.equal(nudges, 0);
    });
  });
});
