import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {vi} from 'vitest';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import type {AgentRun} from '../../adapters/runtime/agent.ts';
import {launcherRuntime} from '../../cli.ts';
import {decide} from './policy.ts';
import type {Vcs} from '../port.ts';
import {action, change, issue, pull, ready} from '../__tests__/harness.ts';

const runAgent = vi.hoisted(() => vi.fn(async (_run: AgentRun) => ({text: ''})));

vi.mock('../../adapters/runtime/agent.ts', () => ({runAgent}));

function idleVcs(root: string): Vcs {
  return {
    prepare: async () => root,
    tip: async () => 'abc',
    filesAt: () => ({exists: () => false, read: () => '', list: () => []}),
    compare: async () => null,
    push: async () => {},
    head: async () => 'abc',
    published: async () => true,
    dirty: async () => [],
  };
}

function promptFile(): string {
  return readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../prompts/sdd.md'),
    'utf8',
  );
}

spec('artifact', () => {
  requirement('A writing phase publishes its own file', () => {
    scenario('Proposing without a proposal writes one', () => {
      const decision = decide(issue(1, ['sdd:proposing']), [], [pull(9)], change());
      assert.equal(action(decision), 'create-proposal');
    });
    scenario('A proposal with no pull request is published', () => {
      const decision = decide(issue(1, ['sdd:proposing']), [], [], change({proposal: true}));
      assert.equal(action(decision), 'create-proposal');
    });
    scenario('Specifying with a named capability writes the delta', () => {
      const decision = decide(
        issue(1, ['sdd:specifying']),
        [],
        [pull(9)],
        change({proposal: true, capabilities: ['section-text']}),
      );
      assert.equal(action(decision), 'create-initial-specs');
    });
    scenario('Specifying with no named capability opens the review', () => {
      const decision = decide(
        issue(1, ['sdd:specifying']),
        [],
        [pull(9)],
        change({proposal: true}),
      );
      assert.equal(decision.kind, 'wait');
      if (decision.kind === 'wait') {
        assert.deepEqual(decision.gate, {artifact: 'spec', from: 'specifying', to: 'specified'});
      }
    });
    scenario('Specifying with no named capability and no pull request waits', () => {
      const decision = decide(issue(1, ['sdd:specifying']), [], [], change({proposal: true}));
      assert.equal(decision.kind, 'wait');
      if (decision.kind === 'wait') {
        assert.equal(decision.reason, 'no open pull request');
      }
    });
  });

  requirement('A missing earlier file returns one phase', () => {
    scenario('Specifying without a proposal returns to proposing', () => {
      const decision = decide(issue(1, ['sdd:specifying']), [], [pull(9)], change({delta: true}));
      assert.deepEqual(decision, {
        kind: 'advance',
        issue: '1',
        to: 'proposing',
        reason: 'proposal.md is missing',
      });
    });
    scenario('Designing with a delta and no proposal stays', () => {
      const decision = decide(issue(1, ['sdd:designing']), [], [pull(9)], change({delta: true}));
      assert.equal(action(decision), 'create-design');
    });
    scenario('Designing without a delta returns to specifying', () => {
      const decision = decide(
        issue(1, ['sdd:designing']),
        [],
        [pull(9)],
        change({proposal: true, design: true, capabilities: ['section-text']}),
      );
      assert.deepEqual(decision, {
        kind: 'advance',
        issue: '1',
        to: 'specifying',
        reason: 'delta spec is missing',
      });
    });
    scenario('Designing with no named capability stays without a delta', () => {
      const decision = decide(
        issue(1, ['sdd:designing']),
        [],
        [pull(9)],
        change({proposal: true, design: true}),
      );
      assert.equal(decision.kind, 'wait');
      if (decision.kind === 'wait') {
        assert.deepEqual(decision.gate, {artifact: 'design', from: 'designing', to: 'designed'});
      }
    });
  });

  requirement('Open items hold only their own file', () => {
    scenario('Open questions hold proposing under auto-plan', () => {
      const decision = decide(
        issue(1, ['sdd:proposing', 'sdd:auto-plan']),
        [],
        [pull(9)],
        change({proposal: true, openQuestions: 2}),
      );
      assert.equal(decision.kind, 'wait');
    });
    scenario('An open task stays in implementing', () => {
      const decision = decide(issue(1, ['sdd:implementing']), [], [pull(9)], {
        ...ready,
        openTasks: 1,
      });
      assert.equal(action(decision), 'implement-next-task');
    });
  });

  requirement('The writing prompt carries the issue text', () => {
    scenario('The prompt includes the issue and forbids a search', async () => {
      runAgent.mockClear();
      const root = mkdtempSync(path.join(tmpdir(), 'sdd-issue-text-'));
      const runtime = launcherRuntime({
        root,
        vcs: idleVcs(root),
        config: {queues: [{name: 'FIRST'}], branchScope: 'sdd', base: 'trunk'},
      });
      const title = 'Show the whole outcome';
      const body = 'The Plan row stops at the first blank line.';
      await runtime.run({
        skill: 'plan',
        action: 'create-proposal',
        key: '6',
        phase: 'proposing',
        pull: '',
        mode: 'judgment',
        issue: {title, body},
      });
      const text = runAgent.mock.calls[0]?.[0].promptArgs.ISSUE_TEXT ?? '';
      assert.match(text, /# Show the whole outcome/);
      assert.match(text, /The Plan row stops at the first blank line\./);
      assert.match(text, /Do not search the repository for this issue/);
      assert.match(text, /do not read the service source to recover it/);
      const prompt = promptFile();
      const issueAt = prompt.indexOf('{{ISSUE_TEXT}}');
      const upstreamAt = prompt.indexOf('{{UPSTREAM}}');
      const stepAt = prompt.indexOf('{{STEP}}');
      assert.ok(issueAt >= 0 && issueAt < upstreamAt && upstreamAt < stepAt);
      assert.match(prompt, /Do not search for `sdd\.mjs`, `bin\/`, or `node_modules`, and do not read them/);
    });

    scenario('An empty issue stays empty', async () => {
      runAgent.mockClear();
      const root = mkdtempSync(path.join(tmpdir(), 'sdd-issue-empty-'));
      const runtime = launcherRuntime({
        root,
        vcs: idleVcs(root),
        config: {queues: [{name: 'FIRST'}], branchScope: 'sdd', base: 'trunk'},
      });
      await runtime.run({
        skill: 'plan',
        action: 'create-proposal',
        key: '6',
        phase: 'proposing',
        pull: '',
        mode: 'judgment',
        issue: {title: '  ', body: '\n'},
      });
      const text = runAgent.mock.calls[0]?.[0].promptArgs.ISSUE_TEXT ?? '';
      assert.match(text, /^# \n\n\n\nThe issue has no description\.$/m);
      assert.equal(text.includes('# Issue'), false);
      assert.match(text, /Do not search the repository for this issue/);
    });
  });
});
