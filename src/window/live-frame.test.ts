import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import type {IssueRecord} from '../machine/port.ts';
import {changeDir} from '../machine/change/naming.ts';
import {git, held, hosted, MANAGER, post, writeChange} from './__tests__/page.harness.ts';
import {post as livePost, readSnapshot, yard} from './__tests__/live.harness.ts';
import {serveLiveBoard} from './live.ts';
import type {WindowSnapshot} from './snapshot.ts';
import {projectSpine} from './spine.ts';
import {
  beginRead,
  busyEdges,
  emptyHold,
  endRead,
  holdGesture,
  paintFrame,
  reuseOpenedSpine,
  reuseSpineSections,
  snapshotPath,
  wantsSnapshot,
  type ReadSlot,
} from './client/frame.ts';
import {openedShot, rowOf, shot, spineReady, withGate} from './client/__tests__/frame.fixture.ts';

const SPEC_ID = 'case-read';

function specText(lines: readonly string[]): string {
  return `${lines.join('\n')}\n`;
}

function writeBaseline(arcadia: string, id: string, body: string): void {
  const file = path.join(arcadia, 'services', 'billing', 'openspec', 'specs', id, 'spec.md');
  mkdirSync(path.dirname(file), {recursive: true});
  writeFileSync(file, body);
}

function caseReadDelta(): {baseline: string; delta: string} {
  return {
    baseline: specText(['### Requirement: Чтение', '', 'Старый текст.']),
    delta: specText([
      '## MODIFIED Requirements',
      '',
      '### Requirement: Чтение',
      '',
      'Новый текст.',
    ]),
  };
}

function plantCaseRead(arcadia: string): void {
  const {baseline, delta} = caseReadDelta();
  writeBaseline(arcadia, SPEC_ID, baseline);
  writeChange(arcadia, '1', `specs/${SPEC_ID}/spec.md`, delta);
}

async function flushSpine(): Promise<void> {
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
}

function commitIssueBranch(checkout: string): void {
  git(checkout, ['init', '-b', 'master']);
  git(checkout, ['config', 'user.email', 'test@example.com']);
  git(checkout, ['config', 'user.name', 'Test']);
  git(checkout, ['add', 'openspec']);
  git(checkout, ['commit', '-m', 'spec']);
  git(checkout, ['checkout', '-b', 'sdd/1']);
}

function dropIssueSpec(checkout: string): void {
  git(checkout, ['rm', path.join(changeDir('1'), 'specs', SPEC_ID, 'spec.md')]);
  git(checkout, ['commit', '-m', 'drop']);
}

function restoreIssueBranch(checkout: string): void {
  git(checkout, ['checkout', 'master']);
  git(checkout, ['branch', '-f', 'sdd/1', 'master']);
}

/** Fail `git rev-parse --verify`. The board still answers; the deferred spine read throws. */
function failGitRevParse(): () => void {
  const real = execFileSync('/usr/bin/which', ['git'], {encoding: 'utf8'}).trim();
  const dir = mkdtempSync(path.join(tmpdir(), 'spine-git-'));
  const bin = path.join(dir, 'git');
  writeFileSync(
    bin,
    [
      '#!/bin/sh',
      'if [ "$1" = "rev-parse" ]; then',
      '  case " $* " in',
      '    *--verify*)',
      '      echo "fatal: rev-parse failed" >&2',
      '      exit 128',
      '      ;;',
      '  esac',
      'fi',
      `exec ${JSON.stringify(real)} "$@"`,
      '',
    ].join('\n'),
  );
  chmodSync(bin, 0o755);
  const saved = process.env.PATH;
  process.env.PATH = `${dir}${path.delimiter}${saved ?? ''}`;
  return () => {
    if (saved === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = saved;
    }
    rmSync(dir, {recursive: true, force: true});
  };
}

/** Fail the deferred spine read of `proposal.md`. The board still answers; that read throws. */
function failGitShow(): () => void {
  const real = execFileSync('/usr/bin/which', ['git'], {encoding: 'utf8'}).trim();
  const dir = mkdtempSync(path.join(tmpdir(), 'spine-git-'));
  const bin = path.join(dir, 'git');
  writeFileSync(
    bin,
    [
      '#!/bin/sh',
      'if [ "$1" = "show" ]; then',
      '  case " $* " in',
      '    *proposal.md*)',
      '      echo "fatal: not a git repository (or any of the parent directories): .git" >&2',
      '      exit 128',
      '      ;;',
      '  esac',
      'fi',
      'if [ "$1" = "cat-file" ] && [ "$2" = "--batch" ]; then',
      '  echo "fatal: not a git repository (or any of the parent directories): .git" >&2',
      '  exit 128',
      'fi',
      `exec ${JSON.stringify(real)} "$@"`,
      '',
    ].join('\n'),
  );
  chmodSync(bin, 0o755);
  const saved = process.env.PATH;
  process.env.PATH = `${dir}${path.delimiter}${saved ?? ''}`;
  return () => {
    if (saved === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = saved;
    }
    rmSync(dir, {recursive: true, force: true});
  };
}

async function firstChange(url: string): Promise<{
  generation: number;
  kind: string;
  changed: {key: string; revision: string}[];
}> {
  const controller = new AbortController();
  const response = await fetch(new URL('/events', url), {signal: controller.signal});
  assert.equal(response.status, 200);
  const reader = response.body?.getReader();
  assert.ok(reader);
  const decoder = new TextDecoder();
  let text = '';
  try {
    while (!text.includes('\n\n')) {
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }
      text += decoder.decode(chunk.value, {stream: true});
    }
  } finally {
    controller.abort();
    await reader?.cancel().catch(() => undefined);
  }
  const line = text.split('\n').find(item => item.startsWith('data: '));
  assert.ok(line);
  return JSON.parse(line.slice('data: '.length)) as {
    generation: number;
    kind: string;
    changed: {key: string; revision: string}[];
  };
}

async function snapshotOnce(url: string): Promise<WindowSnapshot> {
  const response = await fetch(new URL('/snapshot', url));
  assert.equal(response.status, 200);
  return response.json() as Promise<WindowSnapshot>;
}

spec('live-frame', () => {
  requirement('The snapshot does not wait to read the spine', () => {
    scenario('The next frame fills the spine in the same drawer', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying')]},
        async (page, window, paths) => {
          plantCaseRead(paths.arcadia);
          window.chooseAgent('cursor');
          const response = await fetch(new URL('act', page.url), {
            method: 'POST',
            headers: {'content-type': 'application/x-www-form-urlencoded'},
            body: new URLSearchParams({act: 'open', key: '1'}).toString(),
          });
          const first = (await response.json()) as WindowSnapshot;
          assert.equal(first.opened?.key, '1');
          assert.equal(first.opened?.spineReady, false);
          assert.equal(
            first.opened?.spine.capabilities.some(item => item.id === SPEC_ID),
            false,
          );
          await flushSpine();
          const second = await snapshotOnce(page.url);
          assert.equal(second.opened?.spineReady, true);
          assert.ok(second.opened?.spine.capabilities.some(item => item.id === SPEC_ID));
        },
      );
    });

    scenario('A spy snapshot keeps the previous spine until the next one is ready', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying')]},
        async (page, window, paths) => {
          plantCaseRead(paths.arcadia);
          window.chooseAgent('cursor');
          const response = await fetch(new URL('act', page.url), {
            method: 'POST',
            headers: {'content-type': 'application/x-www-form-urlencoded'},
            body: new URLSearchParams({act: 'open', key: '1'}).toString(),
          });
          assert.equal(response.status, 200);
          await response.json();
          await flushSpine();
          const ready = await snapshotOnce(page.url);
          assert.equal(ready.opened?.spineReady, true);
          assert.ok(ready.opened?.spine.capabilities.some(item => item.id === SPEC_ID));
          page.note();
          const during = await snapshotOnce(page.url);
          assert.equal(during.opened?.spineReady, false);
          assert.ok(during.opened?.spine.capabilities.some(item => item.id === SPEC_ID));
          await flushSpine();
          const after = await snapshotOnce(page.url);
          assert.equal(after.opened?.spineReady, true);
        },
      );
    });

    scenario('A failed read keeps the previous spine', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying')]},
        async (page, window, paths) => {
          const checkout = path.join(paths.arcadia, 'services', 'billing');
          plantCaseRead(paths.arcadia);
          commitIssueBranch(checkout);
          let restoreBranch = false;
          try {
            window.chooseAgent('cursor');
            assert.equal(
              (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
                .status,
              200,
            );
            await flushSpine();
            const ready = await snapshotOnce(page.url);
            assert.equal(ready.opened?.key, '1');
            assert.equal(ready.opened?.spineReady, true);
            assert.ok(ready.opened?.spine.capabilities.some(item => item.id === SPEC_ID));
            dropIssueSpec(checkout);
            restoreBranch = true;
            const logged: unknown[] = [];
            const report = console.error;
            const restoreGit = failGitShow();
            console.error = (...args: unknown[]) => {
              logged.push(args[0]);
            };
            try {
              page.note();
              const during = await snapshotOnce(page.url);
              assert.equal(during.opened?.key, '1');
              assert.equal(during.opened?.spineReady, false);
              assert.ok(during.opened?.spine.capabilities.some(item => item.id === SPEC_ID));
              await flushSpine();
            } finally {
              console.error = report;
              restoreGit();
            }
            assert.equal(logged.length, 1);
            const after = await snapshotOnce(page.url);
            assert.equal(after.opened?.key, ready.opened?.key);
            assert.equal(after.opened?.spineReady, true);
            assert.deepEqual(
              after.opened?.spine.capabilities.map(item => item.id),
              ready.opened?.spine.capabilities.map(item => item.id),
            );
            assert.equal(after.status, undefined);
          } finally {
            if (restoreBranch) {
              restoreIssueBranch(checkout);
            }
          }
        },
      );
    });

    scenario('A fatal ref lookup keeps the previous spine', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying')]},
        async (page, window, paths) => {
          const checkout = path.join(paths.arcadia, 'services', 'billing');
          const specFile = path.join(checkout, changeDir('1'), 'specs', SPEC_ID, 'spec.md');
          plantCaseRead(paths.arcadia);
          commitIssueBranch(checkout);
          let restoreTree = false;
          try {
            window.chooseAgent('cursor');
            assert.equal(
              (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
                .status,
              200,
            );
            await flushSpine();
            const ready = await snapshotOnce(page.url);
            assert.equal(ready.opened?.key, '1');
            assert.equal(ready.opened?.spineReady, true);
            assert.ok(ready.opened?.spine.capabilities.some(item => item.id === SPEC_ID));
            rmSync(specFile);
            assert.equal(existsSync(specFile), false);
            restoreTree = true;
            const logged: unknown[] = [];
            const report = console.error;
            const restoreGit = failGitRevParse();
            console.error = (...args: unknown[]) => {
              logged.push(args[0]);
            };
            try {
              page.note();
              const during = await snapshotOnce(page.url);
              assert.equal(during.opened?.key, '1');
              assert.equal(during.opened?.spineReady, false);
              assert.ok(during.opened?.spine.capabilities.some(item => item.id === SPEC_ID));
              await flushSpine();
            } finally {
              console.error = report;
              restoreGit();
            }
            assert.equal(logged.length, 1);
            const after = await snapshotOnce(page.url);
            assert.equal(after.opened?.key, ready.opened?.key);
            assert.equal(after.opened?.spineReady, true);
            assert.deepEqual(
              after.opened?.spine.capabilities.map(item => item.id),
              ready.opened?.spine.capabilities.map(item => item.id),
            );
            assert.equal(after.status, undefined);
          } finally {
            if (restoreTree) {
              git(checkout, [
                'checkout',
                'HEAD',
                '--',
                path.join(changeDir('1'), 'specs', SPEC_ID, 'spec.md'),
              ]);
            }
          }
        },
      );
    });

    scenario('Opening the same ticket again keeps the ready spine', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying')]},
        async (page, window, paths) => {
          plantCaseRead(paths.arcadia);
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          await flushSpine();
          const ready = await snapshotOnce(page.url);
          assert.equal(ready.opened?.spineReady, true);
          const ids = ready.opened?.spine.capabilities.map(item => item.id);
          assert.ok(ids?.includes(SPEC_ID));
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'close-card'}).toString()))
              .status,
            200,
          );
          const again = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'open', key: '1'}).toString(),
          );
          assert.equal(again.status, 200);
          const shot = JSON.parse(again.body) as WindowSnapshot;
          assert.equal(shot.opened?.key, '1');
          assert.equal(shot.opened?.spineReady, true);
          assert.equal(typeof shot.opened?.revision, 'string');
          assert.equal(shot.opened?.revision, ready.opened?.revision);
          assert.deepEqual(
            shot.opened?.spine.capabilities.map(item => item.id),
            ids,
          );
        },
      );
    });

    scenario('Switching back to a ticket keeps the spine already read', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'specifying'), held('2', 'specifying')],
        },
        async (page, window, paths) => {
          plantCaseRead(paths.arcadia);
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          await flushSpine();
          const ready = await snapshotOnce(page.url);
          assert.equal(ready.opened?.spineReady, true);
          const ids = ready.opened?.spine.capabilities.map(item => item.id);
          assert.ok(ids?.includes(SPEC_ID));
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '2'}).toString()))
              .status,
            200,
          );
          await flushSpine();
          const other = await snapshotOnce(page.url);
          assert.equal(other.opened?.key, '2');
          assert.equal(other.opened?.spineReady, true);
          const again = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'open', key: '1'}).toString(),
          );
          assert.equal(again.status, 200);
          const shot = JSON.parse(again.body) as WindowSnapshot;
          assert.equal(shot.opened?.key, '1');
          assert.equal(shot.opened?.spineReady, true);
          assert.equal(shot.opened?.revision, ready.opened?.revision);
          assert.deepEqual(
            shot.opened?.spine.capabilities.map(item => item.id),
            ids,
          );
          await flushSpine();
          const stayed = await snapshotOnce(page.url);
          assert.equal(stayed.generation, shot.generation);
          assert.equal(stayed.opened?.spineReady, true);
        },
      );
    });
  });

  requirement('A matching revision omits the spine', () => {
    scenario('A matching revision omits the spine', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying')]},
        async (page, window, paths) => {
          plantCaseRead(paths.arcadia);
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          await flushSpine();
          const ready = await snapshotOnce(page.url);
          const revision = ready.opened?.revision;
          assert.equal(typeof revision, 'string');
          assert.ok(ready.opened?.spine);
          const heldShot = await fetch(new URL(`/snapshot?have=${revision}`, page.url));
          const thin = (await heldShot.json()) as WindowSnapshot;
          assert.equal(thin.opened?.revision, revision);
          assert.equal(thin.opened !== undefined && 'spine' in thin.opened, false);
          const full = await snapshotOnce(page.url);
          assert.ok(full.opened?.spine.capabilities.length !== undefined);
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'close-card'}).toString()))
              .status,
            200,
          );
          const again = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'open', key: '1', have: revision ?? ''}).toString(),
          );
          assert.equal(again.status, 200);
          const shot = JSON.parse(again.body) as WindowSnapshot;
          assert.equal(shot.opened?.revision, revision);
          assert.equal(shot.opened?.spineReady, true);
          assert.equal(shot.opened !== undefined && 'spine' in shot.opened, false);
          assert.ok(Array.isArray(shot.opened?.blocks));
        },
      );
    });

    scenario('A change event names the open spine revision', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'specifying')]},
        async (page, window, paths) => {
          plantCaseRead(paths.arcadia);
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          await flushSpine();
          const ready = await snapshotOnce(page.url);
          const revision = ready.opened?.revision;
          assert.equal(typeof revision, 'string');
          const note = await firstChange(page.url);
          assert.equal(note.kind, 'frame');
          assert.equal(typeof note.generation, 'number');
          assert.deepEqual(note.changed, [{key: '1', revision}]);
        },
      );
    });
  });
});

async function settle(): Promise<void> {
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
}

spec('live-frame', () => {
  requirement('The snapshot does not wait to read the spine', () => {
    scenario('An unchanged fingerprint leaves the open spine ready', async () => {
      const staged = yard();
      const second: IssueRecord = {
        key: '7',
        title: 'Other cycle',
        body: '',
        state: 'OPEN',
        labels: ['sdd:cycle', 'remote-solver'],
        assignee: '',
        dependsOn: [],
      };
      staged.tracker.listOpen = async () => [staged.cycle, second];
      const page = await serveLiveBoard({
        homePath: staged.homePath,
        repo: 'acme/billing',
        tracker: staged.tracker,
        review: staged.review,
        githubRoot: staged.github,
      });
      try {
        assert.equal(await livePost(page.url, '/act', 'act=open&key=6'), 200);
        await settle();
        const ready = await readSnapshot(page.url);
        assert.equal(ready.opened?.key, '6');
        assert.equal(ready.opened?.spineReady, true);
        second.title = 'Renamed other';
        await page.refresh();
        const next = await readSnapshot(page.url);
        assert.equal(next.generation, ready.generation + 1);
        assert.equal(next.opened?.key, '6');
        assert.equal(next.opened?.spineReady, true);
      } finally {
        await page.close();
        rmSync(staged.dir, {recursive: true, force: true});
      }
    });

    scenario('A changed fingerprint reads the spine again', async () => {
      const staged = yard();
      const page = await serveLiveBoard({
        homePath: staged.homePath,
        repo: 'acme/billing',
        tracker: staged.tracker,
        review: staged.review,
        githubRoot: staged.github,
      });
      try {
        assert.equal(await livePost(page.url, '/act', 'act=open&key=6'), 200);
        await settle();
        const ready = await readSnapshot(page.url);
        assert.equal(ready.opened?.spineReady, true);
        assert.equal(ready.opened?.spine.proposal.present, false);
        const file = path.join(
          staged.github,
          'acme',
          'billing',
          'openspec',
          'changes',
          'issue-6',
          'proposal.md',
        );
        mkdirSync(path.dirname(file), {recursive: true});
        writeFileSync(file, '## Open questions\n\n- [ ] later question\n');
        await page.refresh();
        const due = await readSnapshot(page.url);
        assert.equal(due.opened?.spineReady, false);
        assert.equal(due.opened?.spine.proposal.present, false);
        await settle();
        const filled = await readSnapshot(page.url);
        assert.equal(filled.opened?.spineReady, true);
        assert.equal(filled.opened?.spine.proposal.present, true);
        assert.equal(
          filled.opened?.spine.proposal.questions.some(question => question.text === 'later question'),
          true,
        );
      } finally {
        await page.close();
        rmSync(staged.dir, {recursive: true, force: true});
      }
    });

    scenario('A failed branch read keeps the stored spine', async () => {
      const staged = yard();
      const checkout = path.join(staged.github, 'acme', 'billing');
      const proposal = path.join(checkout, 'openspec', 'changes', 'issue-6', 'proposal.md');
      mkdirSync(path.dirname(proposal), {recursive: true});
      writeFileSync(proposal, '## Outcome\n\nС ветки тикета.\n');
      execFileSync('git', ['init', '-b', 'master'], {cwd: checkout, stdio: 'ignore'});
      execFileSync('git', ['config', 'user.email', 'test@example.com'], {cwd: checkout, stdio: 'ignore'});
      execFileSync('git', ['config', 'user.name', 'Test'], {cwd: checkout, stdio: 'ignore'});
      execFileSync('git', ['add', 'openspec'], {cwd: checkout, stdio: 'ignore'});
      execFileSync('git', ['commit', '-m', 'plan'], {cwd: checkout, stdio: 'ignore'});
      execFileSync('git', ['checkout', '-b', 'sdd/6'], {cwd: checkout, stdio: 'ignore'});
      execFileSync('git', ['checkout', 'master'], {cwd: checkout, stdio: 'ignore'});
      writeFileSync(proposal, '## Outcome\n\nС рабочего дерева.\n');
      const page = await serveLiveBoard({
        homePath: staged.homePath,
        repo: 'acme/billing',
        tracker: staged.tracker,
        review: staged.review,
        githubRoot: staged.github,
      });
      const restoreGit = failCatFile();
      try {
        assert.equal(await livePost(page.url, '/act', 'act=open&key=6'), 200);
        await settle();
        const ready = await readSnapshot(page.url);
        assert.equal(ready.opened?.spineReady, true);
        assert.equal(ready.opened?.spine.proposal.excerpt, 'С ветки тикета.');
        await page.refresh();
        const stayed = await readSnapshot(page.url);
        assert.equal(stayed.opened?.spineReady, true);
        assert.equal(stayed.opened?.spine.proposal.excerpt, 'С ветки тикета.');
        assert.equal(stayed.opened?.revision, ready.opened?.revision);
      } finally {
        restoreGit();
        await page.close();
        rmSync(staged.dir, {recursive: true, force: true});
      }
    });
  });
});

/** `git cat-file --batch` fails. Rev-parse and ls-tree still reach the real git. */
function failCatFile(): () => void {
  const real = execFileSync('/usr/bin/which', ['git'], {encoding: 'utf8'}).trim();
  const dir = mkdtempSync(path.join(tmpdir(), 'spine-git-'));
  const bin = path.join(dir, 'git');
  writeFileSync(
    bin,
    [
      '#!/bin/sh',
      'if [ "$1" = "cat-file" ] && [ "$2" = "--batch" ]; then',
      '  echo "fatal: not a git repository (or any of the parent directories): .git" >&2',
      '  exit 128',
      'fi',
      `exec ${JSON.stringify(real)} "$@"`,
      '',
    ].join('\n'),
  );
  chmodSync(bin, 0o755);
  const saved = process.env.PATH;
  process.env.PATH = `${dir}${path.delimiter}${saved ?? ''}`;
  return () => {
    if (saved === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = saved;
    }
    rmSync(dir, {recursive: true, force: true});
  };
}

spec('live-frame', () => {
  requirement('A comment leaves the plan section', () => {
    scenario('A new focus keeps the plan revision', () => {
      const text = {
        proposal: '## Outcome\n\nИтог одного чтения.\n',
        design: '',
        tasks: '',
        specs: [],
        baselines: [],
      };
      const first = projectSpine(text, {key: '1', focusBody: 'Plan: было'});
      const second = projectSpine(text, {key: '1', focusBody: 'Plan: стало'}, first);
      assert.equal(second.proposal, first.proposal);
      assert.equal(second.sections.plan, first.sections.plan);
      assert.notEqual(second.sections.focus, first.sections.focus);
      assert.notEqual(second.lines, first.lines);
    });
  });
});

spec('accept-caption', () => {
  requirement('The Accept row caption is the auto-merge sentence', () => {
    scenario('Before the spine is read the caption waits for a person', () => {
      const base = withGate({proposing: true, designing: true, accepting: true});
      const row = rowOf(base);
      const accepting = {...row, station: 'accepting'};
      const board = {...base, rows: [accepting]};
      const hold = holdGesture(emptyHold(), 1, 'open', new URLSearchParams('key=7'), board);
      const opened = paintFrame(board, hold).opened;
      assert.ok(opened);
      assert.equal(spineReady(opened), false);
      assert.equal(opened.spine.open, 'Accept');
      assert.equal(opened.spine.accept, 'На приёмке мерж ждёт человека.');
    });
  });
});

spec('live-frame', () => {
  requirement('Opening paints the ticket before the spine is read', () => {
    scenario('Opening shows the ticket title before the spine is read', () => {
      const base = shot();
      const hold = holdGesture(emptyHold(), 1, 'open', new URLSearchParams('key=7'), base);
      const opened = paintFrame(base, hold).opened;
      assert.ok(opened);
      assert.equal(opened.key, '7');
      assert.equal(opened.title, 'Заголовок');
      assert.deepEqual(opened.blocks, []);
      assert.equal(spineReady(opened), false);
      assert.equal(opened.spine.open, 'Specify');
      assert.equal(opened.spine.accept, 'На приёмке мерж ждёт человека.');
      assert.equal(opened.spine.station, 'specifying');
      assert.deepEqual(
        opened.layers.map(item => [item.layer, item.act]),
        [
          ['Change', 'none'],
          ['Plan', 'gate'],
          ['Specify', 'gate'],
          ['Design', 'gate'],
          ['Tasks', 'none'],
          ['Code', 'none'],
          ['Accept', 'gate'],
        ],
      );
      assert.equal(base.opened, undefined);
    });
  });

  requirement('Opening the same ticket keeps the spine already read', () => {
    scenario('Opening the same ticket shows the spine already read', () => {
      const base = shot();
      const previous = openedShot().opened;
      assert.ok(previous);
      const kept = {
        ...previous,
        spineReady: true,
        spine: {...previous.spine, diff: true, pull: true},
      };
      const hold = holdGesture(emptyHold(), 2, 'open', new URLSearchParams('key=7'), base);
      const opened = paintFrame(base, hold, kept).opened;
      assert.ok(opened);
      assert.equal(opened.key, '7');
      assert.equal(opened.title, 'Заголовок');
      assert.equal(opened.spine.diff, true);
      assert.equal(opened.spine.pull, true);
      assert.equal(spineReady(opened), true);
    });

    scenario('A later snapshot with the same revision keeps the painted spine', () => {
      const open = openedShot();
      const painted = open.opened?.spine;
      assert.ok(painted);
      const kept = {...open.opened, revision: 'same', spine: painted};
      const arrived = {
        ...open,
        opened: {
          ...open.opened,
          revision: 'same',
          spine: {...painted, accept: 'другая'},
        },
      };
      const next = reuseOpenedSpine(arrived, kept);
      assert.equal(next.opened?.spine, painted);
      const moved = {
        ...arrived,
        opened: {...arrived.opened, revision: 'next'},
      };
      assert.equal(reuseOpenedSpine(moved, kept).opened?.spine.accept, 'другая');
      const omitted = {...arrived, opened: {...arrived.opened, spine: undefined as unknown as typeof painted}};
      assert.equal(reuseOpenedSpine(omitted, kept).opened?.spine, painted);
    });
  });

  requirement('A hold outranks a snapshot that has not caught up', () => {
    scenario('Closing hides the drawer before the response', () => {
      const open = openedShot();
      const hold = holdGesture(emptyHold(), 2, 'close-card', new URLSearchParams(), open);
      assert.equal(paintFrame(open, hold).opened, undefined);
    });

    scenario('A snapshot during close leaves the drawer closed', () => {
      const open = openedShot();
      const hold = holdGesture(emptyHold(), 2, 'close-card', new URLSearchParams(), open);
      const arrived = {
        ...open,
        spy: 'опрос',
        rows: open.rows.map(row => ({...row, title: 'Новый'})),
      };
      const painted = paintFrame(arrived, hold);
      assert.equal(painted.opened, undefined);
      assert.equal(painted.spy, 'опрос');
      assert.equal(painted.lamp, true);
      assert.equal(painted.rows[0]?.title, 'Новый');
    });

    scenario('Settings open before the response', () => {
      const base = shot();
      const hold = holdGesture(emptyHold(), 1, 'open-settings', new URLSearchParams(), base);
      const painted = paintFrame(base, hold);
      assert.equal(painted.settings.open, true);
      assert.equal(painted.settings.agent, 'cursor');
      assert.equal(base.settings.open, false);
    });

    scenario('A gate click flips the sign before the response', () => {
      const base = withGate({proposing: true});
      const params = new URLSearchParams('key=7&station=specifying');
      const prior = emptyHold();
      const hold = holdGesture(prior, 1, 'gate', params, base);
      const painted = paintFrame(base, hold);
      assert.equal(painted.rows[0]?.gateOff?.specifying, true);
      assert.equal(painted.rows[0]?.gateOff?.proposing, true);
      assert.equal(base.rows[0]?.gateOff?.specifying, undefined);
      assert.equal(prior.gates.length, 0);

      const asking = shot();
      const asked = holdGesture(emptyHold(), 1, 'gate', params, asking);
      assert.equal(paintFrame(asking, asked).rows[0]?.gateOff?.specifying, undefined);
      assert.deepEqual(asked.gates, []);

      const marked = withGate({specifying: true});
      const cleared = holdGesture(
        emptyHold(),
        1,
        'gate',
        new URLSearchParams('key=7&station=specifying'),
        marked,
      );
      assert.equal(paintFrame(marked, cleared).rows[0]?.gateOff, undefined);
    });
  });

  requirement('The strip shows work that has not caught up', () => {
    scenario(
      'The window strip shows while an update is due and goes when the frame is caught up',
      () => {
        const due = {
          gestures: 1,
          reading: false,
          drawer: true,
          spineReady: true,
          settingsOpen: false,
          settingsGesture: false,
        };
        assert.equal(busyEdges(due).window, true);
        assert.equal(busyEdges({...due, gestures: 0, reading: true}).window, true);
        assert.equal(busyEdges({...due, gestures: 0}).window, false);
        assert.equal(
          busyEdges({...due, gestures: 0, settingsOpen: true, settingsGesture: true}).settings,
          true,
        );
        assert.equal(
          busyEdges({...due, gestures: 0, settingsOpen: false, settingsGesture: true}).settings,
          false,
        );
      },
    );

    scenario("The drawer strip shows until that ticket's spine is ready", () => {
      const waiting = {
        gestures: 0,
        reading: false,
        drawer: true,
        spineReady: false,
        settingsOpen: false,
        settingsGesture: false,
      };
      assert.deepEqual(busyEdges(waiting), {window: true, drawer: true, settings: false});
      assert.deepEqual(busyEdges({...waiting, spineReady: true}), {
        window: false,
        drawer: false,
        settings: false,
      });
    });
  });

  requirement('The client reads one snapshot at a time', () => {
    scenario('Two changes during one read become one follow-up', () => {
      let slot: ReadSlot = {flying: false, again: false};
      let starts = 0;
      const change = () => {
        const begun = beginRead(slot);
        slot = begun.slot;
        if (begun.start) {
          starts += 1;
        }
      };
      change();
      change();
      change();
      assert.equal(starts, 1);
      assert.equal(slot.again, true);
      const follow = endRead(slot);
      slot = follow.slot;
      if (follow.start) {
        starts += 1;
      }
      assert.equal(starts, 2);
      assert.equal(slot.flying, true);
      assert.equal(slot.again, false);
      const done = endRead(slot);
      assert.equal(done.start, false);
      assert.equal(done.slot.flying, false);
      assert.equal(starts, 2);
    });
  });

  requirement('A held revision does not read the snapshot again', () => {
    const held = {generation: 1, gesture: false, revisions: new Map([['1', 'abc']])};

    scenario('A frame change during a gesture does not read the snapshot', () => {
      assert.equal(
        wantsSnapshot(
          {generation: 2, kind: 'frame', changed: [{key: '1', revision: 'abc'}]},
          {...held, gesture: true},
        ),
        false,
      );
    });

    scenario('A spine change for a held revision does not read the snapshot', () => {
      assert.equal(
        wantsSnapshot({generation: 2, kind: 'spine', changed: [{key: '1', revision: 'abc'}]}, held),
        false,
      );
      assert.equal(
        wantsSnapshot({generation: 2, kind: 'spine', changed: [{key: '1', revision: 'next'}]}, held),
        true,
      );
    });

    scenario('A content change reads the snapshot', () => {
      assert.equal(
        wantsSnapshot({generation: 2, kind: 'content', changed: [{key: '1', revision: 'abc'}]}, held),
        true,
      );
    });

    scenario('A snapshot read carries the held revision', () => {
      assert.equal(snapshotPath('abc'), '/snapshot?have=abc');
      assert.equal(snapshotPath(undefined), '/snapshot');
    });
  });

  requirement('A comment leaves the plan section', () => {
    scenario('A comment leaves the plan section', () => {
      const open = openedShot();
      const painted = open.opened?.spine;
      assert.ok(painted);
      const plan = {present: true, excerpt: 'Итог', sections: [], questions: []};
      const sections = {focus: 'focus-1', plan: 'plan-1', specify: 'spec-1', design: 'design-1', tasks: 'tasks-1'};
      const kept = {...open.opened, spine: {...painted, sections, proposal: plan}};
      const arrived = {
        ...open,
        opened: {
          ...open.opened,
          revision: 'next',
          spine: {
            ...painted,
            sections: {...sections, focus: 'focus-2'},
            proposal: {present: false, excerpt: '', sections: [], questions: []},
          },
        },
      };
      assert.equal(reuseSpineSections(arrived, kept).opened?.spine.proposal, plan);
    });
  });
});
