import assert from 'node:assert/strict';
import {rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {test} from 'vitest';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {machine} from '../adapters/compose.ts';
import {memoryPorts} from '../adapters/github.ts';
import type {Runtime, Vcs} from '../machine/port.ts';
import type {ThreadTarget} from '../machine/port.ts';
import {openLiveBoard, watchSpy, type LiveReview} from './live.ts';
import {yard} from './live.harness.ts';

const MANAGER = 'ada';

function twentyOneReadyCycles() {
  const issues = Array.from({length: 21}, (_, index) => {
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

function liveAnchor(head = 'abc123', pullId = '11') {
  const staged = yard();
  const opened: {pull: string; target: ThreadTarget}[] = [];
  const spoken: {pull: string; body: string}[] = [];
  let ranges = 0;
  staged.review.pulls = async () => [
    {id: pullId, title: '#6: Show the whole Plan', state: 'OPEN', checks: 'green'},
  ];
  staged.review.range = async () => {
    ranges += 1;
    return {head, base: 'base1'};
  };
  staged.review.speak = async (pull, body) => {
    spoken.push({pull, body});
  };
  const review = staged.review as LiveReview & {
    openThread: (pull: string, target: ThreadTarget) => Promise<void>;
  };
  review.openThread = async (pull, target) => {
    opened.push({pull, target});
  };
  const live = openLiveBoard({
    homePath: staged.homePath,
    repo: 'acme/billing',
    tracker: staged.tracker,
    review,
    githubRoot: staged.github,
  });
  return {staged, live, opened, spoken, review, ranges: () => ranges};
}

test('a live anchor opens a plain thread on the pull head', async () => {
  const hosted = liveAnchor();
  try {
    await hosted.live.refresh();
    const status = await hosted.live.window.answer(
      '6',
      '',
      'смотрите сюда',
      'строка',
      'src/a.ts',
      '4',
      '',
    );
    assert.equal(status, undefined);
    assert.deepEqual(hosted.spoken, []);
    assert.deepEqual(hosted.opened, [
      {
        pull: '11',
        target: {
          commit: 'abc123',
          path: 'src/a.ts',
          line: 4,
          body: 'смотрите сюда',
          plain: true,
          side: 'right',
        },
      },
    ]);
  } finally {
    rmSync(hosted.staged.dir, {recursive: true, force: true});
  }
});

test('a refused live thread falls back to the quoted line', async () => {
  const hosted = liveAnchor();
  let tried = false;
  hosted.review.openThread = async () => {
    tried = true;
    throw new Error('host refused the thread');
  };
  try {
    await hosted.live.refresh();
    const status = await hosted.live.window.answer(
      '6',
      '',
      'ответ',
      'строка',
      'src/a.ts',
      '4',
      'right',
    );
    assert.equal(tried, true);
    assert.equal(status, undefined);
    assert.equal(String(status).includes('host refused the thread'), false);
    assert.deepEqual(hosted.spoken, [{pull: '11', body: '> строка\n\nответ'}]);
  } finally {
    rmSync(hosted.staged.dir, {recursive: true, force: true});
  }
});

test('an empty pull head falls back to the quoted line', async () => {
  const hosted = liveAnchor('');
  try {
    await hosted.live.refresh();
    const status = await hosted.live.window.answer(
      '6',
      '',
      'ответ',
      'строка',
      'src/a.ts',
      '4',
      'right',
    );
    assert.equal(hosted.ranges() > 0, true);
    assert.equal(status, undefined);
    assert.deepEqual(hosted.opened, []);
    assert.deepEqual(hosted.spoken, [{pull: '11', body: '> строка\n\nответ'}]);
  } finally {
    rmSync(hosted.staged.dir, {recursive: true, force: true});
  }
});

test('a refused live thread and a refused quote are not written', async () => {
  const hosted = liveAnchor();
  let triedThread = false;
  let triedSpeak = false;
  hosted.review.openThread = async () => {
    triedThread = true;
    throw new Error('host refused the thread');
  };
  hosted.review.speak = async () => {
    triedSpeak = true;
    throw new Error('host refused the quote');
  };
  try {
    await hosted.live.refresh();
    const status = await hosted.live.window.answer(
      '6',
      '',
      'ответ',
      'строка',
      'src/a.ts',
      '4',
      'right',
    );
    assert.equal(triedThread, true);
    assert.equal(triedSpeak, true);
    assert.equal(status, 'комментарий не записан');
    assert.equal(status.includes('host refused'), false);
  } finally {
    rmSync(hosted.staged.dir, {recursive: true, force: true});
  }
});

test('an empty pull id writes nothing', async () => {
  const hosted = liveAnchor('abc123', '');
  try {
    await hosted.live.refresh();
    const status = await hosted.live.window.answer(
      '6',
      '',
      'ответ',
      'строка',
      'src/a.ts',
      '4',
      'right',
    );
    assert.equal(status, 'комментарий не записан');
    assert.deepEqual(hosted.opened, []);
    assert.deepEqual(hosted.spoken, []);
  } finally {
    rmSync(hosted.staged.dir, {recursive: true, force: true});
  }
});

spec('parallel-cap', () => {
  requirement('The board runs its spy at a cap of 20', () => {
    scenario('The board runs its spy with a parallel cap of 20', async () => {
      const ports = twentyOneReadyCycles();
      const notes: string[] = [];
      const box = spyMachine(ports, idleRuntime);
      const controller = new AbortController();
      const seen = new Promise<void>(resolve => {
        void watchSpy(
          box,
          {
            running: new Set<string>(),
            setNote(line: string) {
              notes.push(line);
              if (/parallel 20\b/.test(line)) {
                resolve();
              }
            },
            refresh: async () => {},
          },
          controller.signal,
        );
      });
      await seen;
      controller.abort();
      assert.ok(notes.some(line => /parallel 20\b/.test(line)));
    });

    scenario('A poll that finds twenty ready cycles starts twenty agents', async () => {
      const ports = twentyOneReadyCycles();
      const starts: string[] = [];
      const box = spyMachine(ports, idleRuntime);
      const controller = new AbortController();
      const done = watchSpy(
        box,
        {
          running: new Set<string>(),
          setNote(line: string) {
            if (line.includes(' start proposing → create-proposal')) {
              starts.push(line);
            }
          },
          refresh: async () => {},
          apply() {
            controller.abort();
          },
        },
        controller.signal,
      );
      await done;
      assert.equal(starts.length, 20);
    });

    scenario('The twenty-first waits until one of those workers leaves', async () => {
      const ports = twentyOneReadyCycles();
      const runs: string[] = [];
      const releases = new Map<string, () => void>();
      const runtime: Runtime = {
        async run(skill) {
          runs.push(skill.key);
          if (runs.length <= 20) {
            await new Promise<void>(resolve => {
              releases.set(skill.key, resolve);
            });
          }
          return {commits: 0};
        },
        async ask() {
          return {text: ''};
        },
      };
      const box = spyMachine(ports, runtime);
      const controller = new AbortController();
      let starts = 0;
      const filled = new Promise<void>(resolve => {
        void watchSpy(
          box,
          {
            running: new Set<string>(),
            setNote(line: string) {
              if (line.includes(' start proposing → create-proposal')) {
                starts += 1;
                if (starts >= 20) {
                  resolve();
                }
              }
            },
            refresh: async () => {},
          },
          controller.signal,
        );
      });
      await filled;
      await new Promise<void>(resolve => {
        const wait = setInterval(() => {
          if (runs.length >= 20) {
            clearInterval(wait);
            resolve();
          }
        }, 5);
      });
      assert.equal(runs.length, 20);
      assert.equal(runs.includes('21'), false);
      releases.get('1')?.();
      const started = await Promise.race([
        new Promise<boolean>(resolve => {
          const watch = setInterval(() => {
            if (runs.includes('21')) {
              clearInterval(watch);
              resolve(true);
            }
          }, 10);
        }),
        new Promise<boolean>(resolve => {
          setTimeout(() => resolve(false), 5000);
        }),
      ]);
      controller.abort();
      assert.equal(started, true);
    });
  });
});

