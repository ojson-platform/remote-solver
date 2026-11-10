import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, realpathSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {machine} from '../adapters/compose.ts';
import {memoryPorts} from '../adapters/github.ts';
import {runSdd} from '../sdd.ts';
import {planFiles, planIssue} from './harness.ts';
import type {Decision} from './policy.ts';
import type {FileSource} from './port.ts';

function proposalFiles(key: string): FileSource {
  const proposal = `openspec/changes/issue-${key}/proposal.md`;
  return {
    exists: rel => rel === proposal,
    read: () => '# Proposal\n\n## Why\n\nBecause.\n',
    list: () => [],
  };
}

async function runStep(
  argv: string[],
  issues: {key: string; title: string; body: string; state: string; labels: string[]}[],
  filesAt: (key: string) => FileSource,
  pulls: Record<string, {id: string; title: string; state: string}[]> = {},
  queues: {name: string}[] = [{name: 'Sandcastle'}],
  base?: string,
): Promise<{printed: Decision; labels: (key: string) => Promise<string[]>; calls: string[]}> {
  const {tracker, review, calls} = memoryPorts({
    issues,
    pulls,
    checks: {'9': {checks: 'green'}},
  });
  const box = machine(process.cwd(), {
    config: base === undefined ? {queues} : {queues, base},
    tracker,
    review,
    vcs: {
      filesAt,
      compare: () => null,
      push() {},
      head: () => '',
      published: () => true,
      dirty: () => [],
      tipMessage: async key => (key === '3' ? 'Sdd-Archive: issue-3\n' : ''),
    },
    runtime: {
      async run() {
        calls.push('runtime');
        return {commits: 0};
      },
      async ask() {
        return {text: ''};
      },
    },
  });
  const logged = console.log;
  const lines: string[] = [];
  console.log = line => {
    lines.push(String(line));
  };
  try {
    await runSdd(argv, box);
  } finally {
    console.log = logged;
  }
  return {
    printed: JSON.parse(lines.at(-1) ?? '{}') as Decision,
    labels: key => tracker.labels(key),
    calls,
  };
}

function serviceRepo(): string {
  const service = mkdtempSync(path.join(tmpdir(), 'sdd-wt-'));
  const git = (args: string[]) => execFileSync('git', args, {cwd: service, encoding: 'utf8'});
  git(['init', '-q']);
  git(['symbolic-ref', 'HEAD', 'refs/heads/master']);
  writeFileSync(path.join(service, 'README'), 'x\n');
  git(['add', '.']);
  git(['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'base']);
  git(['update-ref', 'refs/remotes/origin/trunk', 'HEAD']);
  return service;
}

async function runWorktree(service: string, key: string): Promise<string> {
  const {tracker, review} = memoryPorts({issues: [planIssue(key, ['sdd:cycle'])]});
  const box = machine(service, {
    config: {queues: [{name: 'Sandcastle'}]},
    tracker,
    review,
  });
  const logged = console.log;
  const lines: string[] = [];
  console.log = line => {
    lines.push(String(line));
  };
  try {
    await runSdd(['worktree', key], box);
  } finally {
    console.log = logged;
  }
  return lines.at(-1) ?? '';
}

spec('step', () => {
  requirement('Step settles one issue and prints its decision', () => {
    scenario('One issue moves and another stays', async () => {
      const {printed, labels, calls} = await runStep(
        ['step', '1'],
        [
          planIssue('1', ['Sandcastle', 'sdd:cycle', 'sdd:proposed']),
          planIssue('2', ['Sandcastle', 'sdd:cycle', 'sdd:implementing']),
        ],
        planFiles,
      );
      assert.ok((await labels('1')).includes('sdd:proposing'));
      assert.equal(printed.kind, 'agent');
      if (printed.kind === 'agent') {
        assert.equal(printed.issue, '1');
      }
      assert.ok((await labels('2')).includes('sdd:implementing'));
      assert.equal(calls.includes('runtime'), false);
    });
    scenario('The printed decision names the queue and the base', async () => {
      const {printed} = await runStep(
        ['step', '1'],
        [planIssue('1', ['Sandcastle', 'sdd:cycle', 'sdd:proposed'])],
        planFiles,
        {},
        [{name: 'Sandcastle'}],
        'master',
      );
      const named = printed as typeof printed & {queue?: string; base?: string};
      assert.equal(named.queue, 'Sandcastle');
      assert.equal(named.base, 'master');
    });
    scenario('The printed queue is the issue queue', async () => {
      const {printed} = await runStep(
        ['step', '1'],
        [planIssue('1', ['SECOND', 'sdd:cycle', 'sdd:proposed'])],
        planFiles,
        {},
        [{name: 'FIRST'}, {name: 'SECOND'}],
      );
      const named = printed as typeof printed & {queue?: string; base?: string};
      assert.equal(named.queue, 'SECOND');
      assert.equal(named.base, 'trunk');
    });
    scenario('A decision outside the cycle still names them', async () => {
      const {printed} = await runStep(
        ['step', '7'],
        [planIssue('7', ['sdd:proposing'])],
        planFiles,
        {},
        [{name: 'Sandcastle'}],
        'master',
      );
      assert.equal(printed.kind, 'done');
      const named = printed as typeof printed & {queue?: string; base?: string};
      assert.equal(named.queue, 'Sandcastle');
      assert.equal(named.base, 'master');
    });
    scenario('A merge is performed', async () => {
      const {printed, labels, calls} = await runStep(
        ['step', '3'],
        [planIssue('3', ['Sandcastle', 'sdd:cycle', 'sdd:accepting', 'sdd:auto-merge'])],
        planFiles,
        {'3': [{id: '9', title: '#3: title', state: 'OPEN'}]},
      );
      assert.equal(printed.kind, 'done');
      if (printed.kind === 'done') {
        assert.equal(printed.reason, 'finished cycle');
      }
      assert.equal((await labels('3')).includes('sdd:accepted'), false);
      assert.equal((await labels('3')).includes('sdd:accepting'), true);
      assert.equal(calls.filter(call => call === 'merge:9').length, 1);
      assert.ok(calls.some(call => call.startsWith('close:')));
    });
    scenario('An unassigned issue is claimed', async () => {
      const {printed, calls} = await runStep(
        ['step', '1'],
        [planIssue('1', ['Sandcastle', 'sdd:cycle', 'sdd:proposed'], '', '')],
        planFiles,
      );
      assert.ok(calls.includes('assign'));
      assert.equal(printed.kind, 'agent');
    });
    scenario("Someone else's issue waits", async () => {
      const {printed, calls} = await runStep(
        ['step', '1'],
        [planIssue('1', ['Sandcastle', 'sdd:cycle', 'sdd:proposed'], '', 'other')],
        planFiles,
      );
      assert.equal(calls.includes('assign'), false);
      assert.equal(printed.kind, 'wait');
      if (printed.kind === 'wait') {
        assert.equal(printed.reason, 'assigned to other');
      }
    });
    scenario('A service field for another directory waits', async () => {
      const {printed, labels} = await runStep(
        ['step', '1'],
        [
          planIssue(
            '1',
            ['Sandcastle', 'sdd:cycle', 'sdd:proposed'],
            '',
            undefined,
            'taxi/other/service',
          ),
        ],
        planFiles,
      );
      assert.equal(printed.kind, 'wait');
      if (printed.kind === 'wait') {
        assert.equal(printed.reason, 'service is taxi/other/service');
      }
      assert.ok((await labels('1')).includes('sdd:proposed'));
    });
    scenario('A Service line in the body is not the service', async () => {
      const {printed} = await runStep(
        ['step', '1'],
        [
          planIssue(
            '1',
            ['Sandcastle', 'sdd:cycle', 'sdd:proposed'],
            'Service: taxi/other/service\n',
          ),
        ],
        planFiles,
      );
      assert.equal(printed.kind, 'agent');
    });
  });

  requirement('Auto tags are written only inside the cycle', () => {
    scenario('Auto-plan advances a ready proposal', async () => {
      const {labels} = await runStep(
        ['step', '1', '--auto-plan', '--auto-spec', '--auto-design'],
        [planIssue('1', ['Sandcastle', 'sdd:cycle', 'sdd:proposing'])],
        proposalFiles,
        {'1': [{id: '8', title: '#1: title', state: 'OPEN'}]},
      );
      assert.ok((await labels('1')).includes('sdd:auto-plan'));
      assert.ok((await labels('1')).includes('sdd:auto-spec'));
      assert.ok((await labels('1')).includes('sdd:auto-design'));
      assert.ok((await labels('1')).includes('sdd:designing'));
    });
    scenario('A flag outside the cycle writes nothing', async () => {
      const {printed, labels} = await runStep(
        ['step', '7', '--auto-plan'],
        [planIssue('7', ['sdd:proposing'])],
        proposalFiles,
      );
      assert.equal(printed.kind, 'done');
      assert.equal((await labels('7')).includes('sdd:auto-plan'), false);
    });
  });

  requirement('Worktree prepares the session checkout', () => {
    scenario('A missing checkout is created', async () => {
      const service = serviceRepo();
      const printed = await runWorktree(service, '1');
      const checkout = path.join(service, '.worktrees', 'sdd-1');
      assert.equal(printed, checkout);
      assert.equal(existsSync(checkout), true);
      const head = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd: checkout,
        encoding: 'utf8',
      }).trim();
      assert.equal(head, 'sdd/1');
      assert.equal(lstatSync(path.join(checkout, '.sandcastle', 'prompts')).isSymbolicLink(), true);
      assert.equal(
        readFileSync(path.join(checkout, '.sandcastle', 'service-root'), 'utf8').trim(),
        service,
      );
      const status = execFileSync('git', ['status', '--porcelain'], {
        cwd: service,
        encoding: 'utf8',
      });
      assert.equal(status.includes('.worktrees'), false);
    });
    scenario('A dirty checkout is reused', async () => {
      const service = serviceRepo();
      const checkout = await runWorktree(service, '1');
      writeFileSync(path.join(checkout, 'note.txt'), 'keep\n');
      const again = await runWorktree(service, '1');
      assert.equal(again, checkout);
      assert.equal(readFileSync(path.join(checkout, 'note.txt'), 'utf8'), 'keep\n');
    });
    scenario('A branch already checked out elsewhere is reused', async () => {
      const service = serviceRepo();
      const held = path.join(service, '.sandcastle', 'worktrees', 'sdd-1');
      mkdirSync(path.dirname(held), {recursive: true});
      execFileSync('git', ['worktree', 'add', '-q', '-b', 'sdd/1', held], {cwd: service});
      writeFileSync(path.join(held, 'note.txt'), 'keep\n');
      const printed = await runWorktree(service, '1');
      assert.equal(realpathSync(printed), realpathSync(held));
      assert.equal(readFileSync(path.join(held, 'note.txt'), 'utf8'), 'keep\n');
      assert.equal(existsSync(path.join(service, '.worktrees', 'sdd-1')), false);
    });
    scenario('A checkout does not link node_modules to itself', async () => {
      const service = serviceRepo();
      const modules = path.join(service, 'node_modules');
      mkdirSync(modules);
      const checkout = await runWorktree(service, '1');
      const link = path.join(checkout, 'node_modules');
      assert.equal(readlinkSync(link), modules);
      await runWorktree(checkout, '1');
      assert.equal(readlinkSync(link), modules);
    });
  });
});
