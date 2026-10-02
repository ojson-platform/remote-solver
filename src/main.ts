import path from 'node:path';

import {solverRoot, turn, type Machine} from './adapters/compose.ts';
import {performCycle} from './machine/flow.ts';
import {exited, signature, tick, type State} from './machine/scheduler.ts';
import {modeOfSkill} from './machine/skill.ts';
import {loadCycle} from './machine/snapshot.ts';

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

function flag(argv: string[], name: string, fallback: number): number {
  const index = argv.indexOf(name);
  if (index === -1) {
    return fallback;
  }
  const value = Number(argv[index + 1]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export async function runIssue(box: Machine, key: string): Promise<number> {
  return driveIssue(box, key);
}

/** One issue, up to 40 steps. */
export async function driveIssue(box: Machine, key: string): Promise<number> {
  const runtime = box.runtime;
  if (!runtime) {
    throw new Error('runtime is not configured');
  }
  for (let step = 1; step <= 40; step += 1) {
    const decision = turn(box, key);
    if (decision.kind !== 'agent') {
      console.log(`#${key} ${decision.kind}: ${decision.reason}`);
      return 0;
    }
    console.log(`\n#${key} ${decision.phase} → ${decision.action} (${decision.skill})`);
    const outcome = await runtime.run({
      skill: decision.skill,
      action: decision.action,
      key,
      phase: decision.phase,
      pull: decision.pr,
      mode: modeOfSkill(path.join(solverRoot(), 'skills/sdd-flow/steps'), decision.skill),
    });
    if (outcome.sessionId) {
      console.log(`#${key} session ${outcome.sessionId}`);
    }
    if (outcome.usage) {
      console.log(`#${key} tokens in ${outcome.usage.inputTokens} out ${outcome.usage.outputTokens}`);
    }
    if (outcome.commits === 0) {
      console.error(
        `Stopped: ${decision.action} made no commit, so the next poll would repeat it.`,
      );
      return 2;
    }
  }
  console.error(`Stopped #${key} after 40 steps.`);
  return 3;
}

export async function runSpy(box: Machine, argv: string[]): Promise<void> {
  const parallel = flag(argv, '--parallel', 2);
  const intervalMs = flag(argv, '--interval', 20) * 1000;
  let state: State = {running: [], idle: {}, reported: {}};
  const sigs = new Map<string, string>();
  let wake: (() => void) | null = null;
  let woke = false;

  const finish = (issue: string, code: number, sig: string) => {
    state = exited(state, issue, code, sigs.get(issue) ?? sig);
    console.log(`#${issue} worker exited ${code}`);
    if (wake) {
      wake();
    } else {
      woke = true;
    }
  };

  console.log(`Spy polling every ${intervalMs / 1000}s, parallel ${parallel}.`);

  for (;;) {
    try {
      const snapshot = loadCycle(
        box.tracker,
        box.review,
        key => box.vcs.filesAt(key),
        box.config.queueLabel,
      );
      const decisions = performCycle(
        snapshot,
        {
          tracker: box.tracker,
          review: box.review,
          filesAt: key => box.vcs.filesAt(key),
          queueLabel: box.config.queueLabel,
        },
        new Set(state.running),
      );
      const turned = tick(state, decisions, parallel);
      state = turned.state;
      for (const line of turned.report) {
        console.log(line.issue === null ? line.reason : `#${line.issue}: ${line.reason}`);
      }
      for (const decision of turned.start) {
        console.log(`#${decision.issue} start ${decision.phase} → ${decision.action}`);
        const sig = signature(decision);
        state = {...state, running: [...state.running, decision.issue]};
        sigs.set(decision.issue, sig);
        void driveIssue(box, decision.issue).then(
          code => finish(decision.issue, code, sig),
          error => {
            console.error(error instanceof Error ? error.message : String(error));
            finish(decision.issue, 1, sig);
          },
        );
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
    }

    await new Promise<void>(resolve => {
      if (woke) {
        woke = false;
        resolve();
        return;
      }
      const timer = setTimeout(resolve, intervalMs);
      wake = () => {
        clearTimeout(timer);
        wake = null;
        resolve();
      };
    });
  }
}
