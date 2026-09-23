import {machine, type Machine} from './adapters/compose.ts';
import {resolveCycle, resolveIssue} from './machine/flow.ts';
import {exited, signature, tick, type State} from './machine/scheduler.ts';
import {loadCycle} from './machine/snapshot.ts';

// Spy: poll the tracker and run up to --parallel issues in this process. Each
// issue's agent runs in the worktree sandcastle keeps for branch sdd/<key>.
//
// The machine archives the change, then waits for a person to merge the pull
// request. sdd:auto-merge rebases it without that person. Once the pull request
// is merged, the machine sets sdd:accepted and closes the issue.
//
// One issue: npx tsx .sandcastle/main.ts --issue <key>
// Spy:       npx tsx .sandcastle/main.ts [--parallel 2] [--interval 20]

function flag(name: string, fallback: number): number {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return fallback;
  }
  const value = Number(process.argv[index + 1]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function issueArg(): string | null {
  const index = process.argv.indexOf('--issue');
  if (index === -1) {
    return null;
  }
  const key = process.argv[index + 1];
  if (!key || key.startsWith('--')) {
    throw new Error('Usage: npx tsx .sandcastle/main.ts --issue <key>');
  }
  return key;
}

async function work(box: Machine, key: string): Promise<number> {
  for (let step = 1; step <= 40; step += 1) {
    const decision = resolveIssue(key, {
      tracker: box.tracker,
      review: box.review,
      files: box.vcs.filesAt(key),
      queueLabel: box.config.queueLabel,
    });
    if (decision.kind === 'merge') {
      box.review.merge(decision.pull);
      console.log(`#${key} ${decision.reason}`);
      return 0;
    }
    if (decision.kind !== 'agent') {
      console.log(`#${key} ${decision.kind}: ${decision.reason}`);
      return 0;
    }
    console.log(`\n#${key} ${decision.phase} → ${decision.action} (${decision.skill})`);
    const outcome = await box.runtime.run({
      skill: decision.skill,
      action: decision.action,
      key,
      phase: decision.phase,
      pull: decision.pr,
    });
    if (outcome.commits === 0) {
      console.error(`Stopped: ${decision.action} made no commit, so the next poll would repeat it.`);
      return 2;
    }
  }
  console.error(`Stopped #${key} after 40 steps.`);
  return 3;
}

async function spy(): Promise<void> {
  const box = machine();
  const parallel = flag('--parallel', 2);
  const intervalMs = flag('--interval', 20) * 1000;
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
      const snapshot = loadCycle(box.tracker, box.review, key => box.vcs.filesAt(key), box.config.queueLabel);
      const decisions = resolveCycle(snapshot, box.tracker, box.config.queueLabel, new Set(state.running));
      for (const decision of decisions) {
        if (decision.kind === 'merge') {
          box.review.merge(decision.pull);
        }
      }
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
        void work(box, decision.issue).then(
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

const issue = issueArg();
if (issue === null) {
  await spy();
} else {
  process.exit(await work(machine(), issue));
}
