import path from 'node:path';

import {solverRoot, turn, type Machine} from './adapters/compose.ts';
import {tryHoldIssue} from './adapters/runtime/lock.ts';
import {claimChat, clearChat} from './adapters/runtime/session.ts';
import {githubPauseRemaining, reportGithubError} from './adapters/tracker/github.ts';
import {packageLinks} from './adapters/vcs/vcs.ts';
import {effectSignature, refusalBody, type Decision} from './machine/decide/policy.ts';
import {performCycle} from './machine/flow/flow.ts';
import {endStep, observedSignal, runMarks} from './machine/mark/focus.ts';
import {contentFiles} from './machine/port.ts';
import {modeOfSkill} from './machine/skill/skill.ts';
import {exited, tick, type State} from './machine/spy/scheduler.ts';
import {loadCycle, type CycleSnapshot} from './machine/spy/snapshot.ts';

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
// Board:     remote-solver board [--home PATH] [--port N]

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

export type DriveResult = {code: number; idle?: string; busy?: boolean};

/** One issue, up to 40 steps. The idle mark is the turn that made no commit. */
export async function driveIssue(
  box: Machine,
  key: string,
  watch?: SpyWatch,
): Promise<DriveResult> {
  const held = tryHoldIssue(box.root, key);
  if (!held) {
    return {code: 0, busy: true};
  }
  try {
    return await driveHeldIssue(box, key, watch);
  } finally {
    held.release();
  }
}

async function driveHeldIssue(box: Machine, key: string, watch?: SpyWatch): Promise<DriveResult> {
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
    const sig = effectSignature(decision);
    const claim = claimChat(box.root, key, decision.action, sig);
    if (claim.kind === 'spent') {
      console.error(`Stopped: ${decision.action} already resumed its chat once.`);
      await box.tracker.comment(key, refusalBody(sig));
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
      signature: effectSignature(decision),
      ...(claim.kind === 'resume' ? {resumeSession: claim.sessionId} : {}),
    });
    clearChat(box.root, key);
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
      await box.tracker.comment(key, refusalBody(effectSignature(decision)));
      return {code: 0};
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
  /** Ready agent turns the cap did not start on this poll. */
  onHeld?: (held: readonly {issue: string; action: string}[]) => void;
  /** The decision `performCycle` settled for one issue this poll. */
  onDecision?: (issue: string, decision: Decision) => void;
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
  let state: State = {running: [], reported: {}};
  let wake: (() => void) | null = null;
  let woke = false;

  const publish = () => {
    watch?.onRunning?.([...state.running]);
  };

  const finish = (issue: string, code: number) => {
    state = exited(state, issue);
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
          key => contentFiles(box.vcs, key),
          key => box.vcs.tipMessage?.(key) ?? Promise.resolve(''),
        );
        const decisions = await performCycle(
          snapshot,
          {
            tracker: box.tracker,
            review: box.review,
            filesAt: key => box.vcs.filesAt(key),
            queues: box.config.queues,
            checkout: key =>
              box.vcs.prepare(key, {
                worktreesDir: '.worktrees',
                links: packageLinks(solverRoot()),
              }),
            readTip: key =>
              box.vcs.tipMessage ? box.vcs.tipMessage(key) : Promise.resolve(undefined),
            openspec: box.openspec,
            root: box.root,
          },
          new Set(state.running),
        );
        const turned = tick(state, decisions, parallel);
        state = turned.state;
        watch?.onHeld?.(turned.held.map(item => ({issue: item.issue, action: item.action})));
        for (const decision of decisions) {
          if (decision.issue !== null) {
            watch?.onDecision?.(decision.issue, decision);
          }
        }
        for (const line of turned.report) {
          say(watch, line.issue === null ? line.reason : `#${line.issue}: ${line.reason}`);
        }
        for (const decision of turned.start) {
          watch?.onDecision?.(decision.issue, decision);
          say(watch, `#${decision.issue} start ${decision.phase} → ${decision.action}`);
          watch?.onTurn?.(decision.issue, {
            issue: decision.issue,
            phase: decision.phase,
            action: decision.action,
          });
          state = {...state, running: [...state.running, decision.issue]};
          publish();
          void driveIssue(box, decision.issue, watch).then(
            result => {
              if (result.busy) {
                watch?.onTurn?.(decision.issue, undefined);
                state = exited(state, decision.issue);
                publish();
                const reason = 'already running';
                if (state.reported[decision.issue] !== reason) {
                  state = {...state, reported: {...state.reported, [decision.issue]: reason}};
                  say(watch, `#${decision.issue} already running`);
                }
                return;
              }
              finish(decision.issue, result.code);
            },
            error => {
              reportGithubError(error);
              finish(decision.issue, 1);
            },
          );
        }
        watch?.onCycle?.(snapshot);
      } catch (error) {
        reportGithubError(error);
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
