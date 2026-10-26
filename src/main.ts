import path from 'node:path';

import {solverRoot, turn, type Machine} from './adapters/compose.ts';
import {githubPauseRemaining} from './adapters/github.ts';
import {performCycle} from './machine/flow.ts';
import {endStep, observedSignal, runMarks} from './machine/focus.ts';
import {exited, signature, tick, type State} from './machine/scheduler.ts';
import {modeOfSkill} from './machine/skill.ts';
import {loadCycle, type CycleSnapshot} from './machine/snapshot.ts';

// Spy: poll the tracker and run up to --parallel issues in this process. Each
// issue's agent runs in the worktree sandcastle keeps for branch sdd/<key>.
//
// The machine archives the change, then waits for a person to merge the pull
// request. sdd:auto-merge rebases it in the same turn and closes the issue.
// Once the pull request is merged, the machine sets sdd:accepted and closes the issue.
//
// From the service repository:
// One issue: remote-solver issue <key>
// Spy:       remote-solver spy [--parallel 2] [--interval 20]
// Board:     remote-solver board [--home PATH]

function flag(argv: string[], name: string, fallback: number): number {
  const index = argv.indexOf(name);
  if (index === -1) {
    return fallback;
  }
  const value = Number(argv[index + 1]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export async function runIssue(box: Machine, key: string): Promise<number> {
  return (await driveIssue(box, key)).code;
}

export type DriveResult = {code: number; idle?: string};

/** One issue, up to 40 steps. The idle mark is the turn that made no commit. */
export async function driveIssue(
  box: Machine,
  key: string,
  watch?: SpyWatch,
): Promise<DriveResult> {
  const runtime = box.runtime;
  if (!runtime) {
    throw new Error('runtime is not configured');
  }
  for (let step = 1; step <= 40; step += 1) {
    const decision = await turn(box, key);
    if (decision.kind !== 'agent') {
      watch?.onTurn?.(key, undefined);
      console.log(`#${key} ${decision.kind}: ${decision.reason}`);
      return {code: 0};
    }
    watch?.onTurn?.(key, {issue: key, phase: decision.phase, action: decision.action});
    console.log(`\n#${key} ${decision.phase} → ${decision.action} (${decision.skill})`);
    const before = await runMarks(key, box);
    const record = await box.tracker.issue(key);
    const outcome = await runtime.run({
      skill: decision.skill,
      action: decision.action,
      key,
      phase: decision.phase,
      pull: decision.pr,
      mode: modeOfSkill(path.join(solverRoot(), 'skills/sdd-flow/steps'), decision.skill),
      sddHooks: record.sddHooks,
      service: record.service,
      issue: {title: record.title, body: record.body},
    });
    if (outcome.sessionId) {
      console.log(`#${key} session ${outcome.sessionId}`);
    }
    if (outcome.usage) {
      console.log(
        `#${key} tokens in ${outcome.usage.inputTokens} out ${outcome.usage.outputTokens}`,
      );
    }
    const signal =
      outcome.signal ?? observedSignal(outcome.commits, before, await runMarks(key, box));
    await endStep(key, {...outcome, signal}, box);
    if (outcome.commits === 0) {
      console.error(
        `Stopped: ${decision.action} made no commit, so the next poll would repeat it.`,
      );
      return {code: 2, idle: signature(decision)};
    }
  }
  console.error(`Stopped #${key} after 40 steps.`);
  return {code: 3};
}

/** The agent turn the page names. Absent when no worker is inside a turn. */
export type RunningTurn = {issue: string; phase: string; action: string};

export type SpyWatch = {
  /** Issues whose agent is running after this change. */
  onRunning?: (keys: readonly string[]) => void;
  /** One line the spy just logged. */
  onReport?: (line: string) => void;
  /** Sets one issue's turn, or clears it when the worker has left that turn. */
  onTurn?: (issue: string, turn: RunningTurn | undefined) => void;
  /** A poll finished. The snapshot is the reading that poll already made. */
  onCycle?: (snapshot?: CycleSnapshot) => void;
  /** Stops the loop at the next wait. */
  signal?: AbortSignal;
};

function say(watch: SpyWatch | undefined, line: string): void {
  console.log(line);
  watch?.onReport?.(line);
}

export async function runSpy(box: Machine, argv: string[], watch?: SpyWatch): Promise<void> {
  const parallel = flag(argv, '--parallel', 2);
  const intervalMs = flag(argv, '--interval', 20) * 1000;
  let state: State = {running: [], idle: {}, reported: {}};
  let wake: (() => void) | null = null;
  let woke = false;

  const publish = () => {
    watch?.onRunning?.([...state.running]);
  };

  const finish = (issue: string, code: number, sig: string) => {
    state = exited(state, issue, code, sig);
    publish();
    watch?.onTurn?.(issue, undefined);
    say(watch, `#${issue} worker exited ${code}`);
    watch?.onCycle?.();
    if (wake) {
      wake();
    } else {
      woke = true;
    }
  };

  say(watch, `Spy polling every ${intervalMs / 1000}s, parallel ${parallel}.`);

  for (;;) {
    if (watch?.signal?.aborted) {
      return;
    }
    if (githubPauseRemaining() === 0) {
      try {
        const snapshot = await loadCycle(
          box.tracker,
          box.review,
          key => box.vcs.filesAt(key),
          box.config.queues,
        );
        const decisions = await performCycle(
          snapshot,
          {
            tracker: box.tracker,
            review: box.review,
            filesAt: key => box.vcs.filesAt(key),
            queues: box.config.queues,
          },
          new Set(state.running),
        );
        const turned = tick(state, decisions, parallel);
        state = turned.state;
        for (const line of turned.report) {
          say(watch, line.issue === null ? line.reason : `#${line.issue}: ${line.reason}`);
        }
        for (const decision of turned.start) {
          say(watch, `#${decision.issue} start ${decision.phase} → ${decision.action}`);
          watch?.onTurn?.(decision.issue, {
            issue: decision.issue,
            phase: decision.phase,
            action: decision.action,
          });
          const sig = signature(decision);
          state = {...state, running: [...state.running, decision.issue]};
          publish();
          void driveIssue(box, decision.issue, watch).then(
            result => finish(decision.issue, result.code, result.idle ?? sig),
            error => {
              console.error(error instanceof Error ? error.message : String(error));
              finish(decision.issue, 1, sig);
            },
          );
        }
        watch?.onCycle?.(snapshot);
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
      }
    }

    await new Promise<void>(resolve => {
      if (watch?.signal?.aborted || woke) {
        woke = false;
        resolve();
        return;
      }
      const timer = setTimeout(done, Math.max(intervalMs, githubPauseRemaining()));
      function done(): void {
        clearTimeout(timer);
        watch?.signal?.removeEventListener('abort', done);
        wake = null;
        resolve();
      }
      wake = done;
      watch?.signal?.addEventListener('abort', done);
    });
  }
}
