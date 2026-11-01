import assert from 'node:assert/strict';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {type Machine} from '../adapters/compose.ts';
import {memoryPorts} from '../adapters/github.ts';
import {tryHoldIssue} from '../adapters/lock.ts';
import {resolveCycle} from './flow.ts';
import {files} from './harness.ts';
import type {Decision} from './policy.ts';
import {loadCycle} from './snapshot.ts';
import {exited, signature, tick, type State} from './scheduler.ts';
import {driveIssue} from '../main.ts';
import {laterTurn} from '../window/live.harness.ts';

spec('idle', () => {
  requirement('A run with no commit is not repeated', () => {
    scenario('A later turn with no commit stays idle', async () => {
      const {lines, runs} = await laterTurn();
      assert.equal(runs, 2);
      assert.equal(lines.filter(line => line.includes('restore-baseline')).length, 1);
      assert.equal(lines.at(-1), '');
    });
    scenario('The same decision stays idle', () => {
      const empty: State = {running: [], idle: {}, reported: {}};
      const decision: Extract<Decision, {kind: 'agent'}> = {
        kind: 'agent',
        issue: '1',
        action: 'create-proposal',
        skill: 'plan',
        phase: 'proposing',
        pr: '',
        reason: 'write proposal.md',
      };
      const running = {...tick(empty, [decision], 1).state, running: ['1']};
      const idle = exited(running, '1', 2, signature(decision));
      const again = tick(idle, [decision], 1);
      assert.deepEqual(again.start, []);
      assert.equal(again.report.length, 1);
      const quiet = tick(again.state, [decision], 1);
      assert.deepEqual(quiet.report, []);
    });
    scenario('A different action starts', () => {
      const empty: State = {running: [], idle: {}, reported: {}};
      const first: Extract<Decision, {kind: 'agent'}> = {
        kind: 'agent',
        issue: '1',
        action: 'create-proposal',
        skill: 'plan',
        phase: 'proposing',
        pr: '',
        reason: 'write proposal.md',
      };
      const idle = exited({...empty, running: ['1']}, '1', 0, signature(first));
      const next = tick(
        idle,
        [{...first, action: 'create-initial-specs', reason: 'write the delta'}],
        1,
      );
      assert.equal(next.start[0]?.action, 'create-initial-specs');
    });
  });

  requirement('A running issue and the parallel cap are left alone', () => {
    scenario('A running issue is not moved', async () => {
      const {tracker, review, calls} = memoryPorts({
        issues: [
          {
            key: '7',
            title: '#7: title',
            body: '',
            state: 'OPEN',
            labels: ['Sandcastle', 'sdd:cycle', 'sdd:proposed'],
          },
        ],
      });
      const snapshot = await loadCycle(tracker, review, () => files, [{name: 'Sandcastle'}]);
      const decisions = await resolveCycle(
        snapshot,
        tracker,
        [{name: 'Sandcastle'}],
        new Set(['7']),
      );
      assert.deepEqual(decisions, []);
      assert.equal(calls.includes('editLabels'), false);
      assert.deepEqual(await tracker.labels('7'), ['Sandcastle', 'sdd:cycle', 'sdd:proposed']);
    });
    scenario('Parallel 1 starts one of two ready issues', () => {
      const empty: State = {running: [], idle: {}, reported: {}};
      const one: Extract<Decision, {kind: 'agent'}> = {
        kind: 'agent',
        issue: '1',
        action: 'create-proposal',
        skill: 'plan',
        phase: 'proposing',
        pr: '',
        reason: 'write proposal.md',
      };
      const turned = tick(empty, [one, {...one, issue: '2', reason: 'other'}], 1);
      assert.deepEqual(
        turned.start.map(item => item.issue),
        ['1'],
      );
    });
  });

  requirement('Another process does not start a held issue', () => {
    scenario('A held issue does not start an agent', async () => {
      const root = mkdtempSync(path.join(tmpdir(), 'sdd-hold-'));
      const held = tryHoldIssue(root, '7');
      assert.ok(held);
      let ran = false;
      const box = {
        root,
        runtime: {
          async run() {
            ran = true;
            return {commits: 0};
          },
        },
      } as Machine;
      const result = await driveIssue(box, '7');
      assert.equal(ran, false);
      assert.equal(result.busy, true);
      assert.equal(result.code, 0);
      assert.equal(result.idle, undefined);
      held.release();
    });
    scenario('A dead holder releases the issue', () => {
      const root = mkdtempSync(path.join(tmpdir(), 'sdd-hold-dead-'));
      const file = path.join(root, '.sandcastle', 'locks', '7');
      mkdirSync(path.dirname(file), {recursive: true});
      writeFileSync(file, '99999999\n');
      const held = tryHoldIssue(root, '7');
      assert.ok(held);
      assert.equal(readFileSync(file, 'utf8').trim(), String(process.pid));
      held.release();
      assert.equal(existsSync(file), false);
    });
  });
});
