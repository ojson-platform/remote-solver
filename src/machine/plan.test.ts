import assert from 'node:assert/strict';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {machine} from '../adapters/compose.ts';
import {memoryPorts} from '../adapters/github.ts';
import {runSdd} from '../sdd.ts';
import {planFiles, planIssue} from './harness.ts';
import type {Decision} from './policy.ts';

async function runPlan(
  issues: {key: string; title: string; body: string; state: string; labels: string[]}[],
  pulls: Record<string, {id: string; title: string; state: string}[]> = {},
  queues: {name: string}[] = [{name: 'Sandcastle'}],
): Promise<{printed: Decision; labels: (key: string) => Promise<string[]>; calls: string[]}> {
  const {tracker, review, calls} = memoryPorts({
    issues,
    pulls,
    checks: {'9': {checks: 'green'}},
  });
  const box = machine(process.cwd(), {
    config: {queues},
    tracker,
    review,
    vcs: {
      filesAt: planFiles,
      compare: () => null,
      push() {},
      head: () => '',
      published: () => true,
      dirty: () => [],
      tipMessage: async key => (key === '3' ? 'Sdd-Archive: issue-3\n' : ''),
    },
  });
  const logged = console.log;
  const lines: string[] = [];
  console.log = line => {
    lines.push(String(line));
  };
  try {
    await runSdd(['plan'], box);
  } finally {
    console.log = logged;
  }
  return {
    printed: JSON.parse(lines.at(-1) ?? '{}') as Decision,
    labels: key => tracker.labels(key),
    calls,
  };
}

spec('plan', () => {
  requirement('Plan applies mechanical moves and prints one decision', () => {
    scenario('A phase move is applied and the first skill is printed', async () => {
      const {printed, labels, calls} = await runPlan(
        [
          planIssue('1', ['Sandcastle', 'sdd:cycle', 'sdd:proposed']),
          planIssue('2', ['Sandcastle', 'sdd:cycle', 'sdd:implementing']),
          planIssue('3', ['Sandcastle', 'sdd:cycle', 'sdd:accepting', 'sdd:auto-merge']),
        ],
        {'3': [{id: '9', title: '#3: title', state: 'OPEN'}]},
      );
      assert.ok((await labels('1')).includes('sdd:proposing'));
      assert.equal(printed.kind, 'agent');
      if (printed.kind === 'agent') {
        assert.equal(printed.issue, '1');
      }
      assert.ok((await labels('2')).includes('sdd:implementing'));
      assert.ok((await labels('3')).includes('sdd:accepting'));
      assert.equal(calls.includes('merge:9'), false);
    });
    scenario('A merge is printed and not performed', async () => {
      const {printed, labels, calls} = await runPlan(
        [planIssue('3', ['Sandcastle', 'sdd:cycle', 'sdd:accepting', 'sdd:auto-merge'])],
        {'3': [{id: '9', title: '#3: title', state: 'OPEN'}]},
      );
      assert.equal(printed.kind, 'merge');
      if (printed.kind === 'merge') {
        assert.equal(printed.issue, '3');
      }
      assert.ok((await labels('3')).includes('sdd:accepting'));
      assert.equal(calls.includes('merge:9'), false);
    });
    scenario('Several waits are printed as one', async () => {
      const {printed} = await runPlan([
        planIssue('1', ['Sandcastle', 'sdd:cycle', 'sdd:verifying']),
        planIssue('4', ['Sandcastle', 'sdd:cycle', 'sdd:verifying']),
      ]);
      assert.equal(printed.kind, 'wait');
      if (printed.kind === 'wait') {
        assert.match(printed.reason, /#1/);
        assert.match(printed.reason, /#4/);
      }
    });
    scenario('A decision with no issue names the first queue', async () => {
      const {printed} = await runPlan([], {}, [{name: 'FIRST'}, {name: 'SECOND'}]);
      assert.equal(printed.issue, null);
      const named = printed as typeof printed & {queue?: string; base?: string};
      assert.equal(named.queue, 'FIRST');
      assert.equal(named.base, 'trunk');
    });
    scenario('Another assignee is left out', async () => {
      const {printed} = await runPlan([
        planIssue('1', ['Sandcastle', 'sdd:cycle', 'sdd:proposed'], '', 'other'),
        planIssue('2', ['Sandcastle', 'sdd:cycle', 'sdd:proposed']),
      ]);
      assert.equal(printed.kind, 'agent');
      if (printed.kind === 'agent') {
        assert.equal(printed.issue, '2');
      }
    });
  });
});
