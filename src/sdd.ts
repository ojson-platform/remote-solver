import type {Review, Vcs} from './machine/port.ts';

import {solverRoot, turn, type Machine} from './adapters/compose.ts';
import {openMachine} from './adapters/load.ts';
import {packageLinks} from './adapters/vcs.ts';
import {readChange} from './machine/change.ts';
import {applyLabels, pick, resolveCycle} from './machine/flow.ts';
import {openWait, setPhase, setWait} from './machine/labels.ts';
import {parseMarker} from './machine/marker.ts';
import {updateMirror} from './machine/mirror.ts';
import {changeDir} from './machine/naming.ts';
import {labelsAfterAdvance, PHASES, type Phase} from './machine/phase.ts';
import {accept as acceptGate, publishChoice, type Decision} from './machine/policy.ts';
import {queueOf} from './machine/queues.ts';
import {threadsReport} from './machine/review.ts';
import {loadCycle} from './machine/snapshot.ts';

// Verbs the skills call. The GitHub and git adapters sit behind them.
//   sdd plan
//   sdd set <key> <phase> | wait <key> "<what the person does>" | unwait <key> | accept <key>
//   sdd publish <key> "<pull title>"
//   sdd checks <pull>
//   sdd threads <pull> [--layer <layer>] [--unmarked]
//   sdd thread open <pull> <path> <line> <body>
//   sdd thread reply <pull> <comment> <body>
//   sdd thread say <pull> <body>
//   sdd thread resolve <thread>
//   sdd thread fix <key> <pull> <thread> | thread fix <key> <pull> --conversation
//   sdd mirror <key> <Layer> <text>

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function need(value: string | undefined, usage: string): string {
  if (!value) {
    fail(usage);
  }
  return value;
}

const usage =
  'Usage: sdd plan | step <key> [--auto-plan] [--auto-spec] [--auto-design] | worktree <key> | set <key> <phase> | wait <key> "<what the person does>" | unwait <key> | accept <key> | publish <key> "<title>" | checks <pull> | threads <pull> [--layer <layer>] [--unmarked] | thread open|reply|say|resolve ... | thread fix <key> <pull> <thread>|--conversation | mirror <key> <Layer> <text>';

const AUTO_LABEL: Record<string, string> = {
  '--auto-plan': 'sdd:auto-plan',
  '--auto-spec': 'sdd:auto-spec',
  '--auto-design': 'sdd:auto-design',
};

const SESSION_WORKTREES = '.worktrees';

function stepArgs(rest: string[]): {key: string; labels: string[]} | null {
  const [key, ...flags] = rest;
  if (!key || key.startsWith('-')) {
    return null;
  }
  const labels: string[] = [];
  for (const flag of flags) {
    const label = AUTO_LABEL[flag];
    if (!label || labels.includes(label)) {
      return null;
    }
    labels.push(label);
  }
  return {key, labels};
}

/** `threads <pull> [--layer X] [--unmarked]`. */
export function threadsArgs(
  rest: string[],
): {pull: string; layer?: string; unmarked: boolean} | null {
  const [pull, ...flags] = rest;
  if (!pull || pull.startsWith('-')) {
    return null;
  }
  let layer: string | undefined;
  let unmarked = false;
  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index];
    if (flag === '--layer') {
      layer = flags[index + 1];
      index += 1;
      if (!layer) {
        return null;
      }
    } else if (flag === '--unmarked') {
      unmarked = true;
    } else {
      return null;
    }
  }
  return {pull, layer, unmarked};
}

/** `thread fix <key> <pull> <thread>`, or `--conversation` in place of the thread. */
export function fixArgs(rest: string[]): {key: string; pull: string; thread: string | null} | null {
  const [key, pull, target, ...extra] = rest;
  if (!key || !pull || !target || extra.length > 0 || key.startsWith('-') || pull.startsWith('-')) {
    return null;
  }
  if (target === '--conversation') {
    return {key, pull, thread: null};
  }
  return target.startsWith('-') ? null : {key, pull, thread: target};
}

/**
 * Replies `sdd:fixed <HEAD>` and resolves the thread, or answers the
 * conversation. Refuses while HEAD is not on the remote issue branch. A thread
 * whose latest reply is already `sdd:fixed` is only resolved.
 */
export async function fixThread(
  args: {key: string; pull: string; thread: string | null},
  deps: {review: Review; vcs: Pick<Vcs, 'head' | 'published'>},
): Promise<string> {
  const head = await deps.vcs.head();
  if (!(await deps.vcs.published(args.key, head))) {
    throw new Error(
      `HEAD ${head} is not on the remote branch of #${args.key}: Publish, then thread fix.`,
    );
  }
  const body = `sdd:fixed ${head}`;
  if (args.thread === null) {
    await deps.review.say(args.pull, body);
    return body;
  }
  const record = (await deps.review.threadList(args.pull)).find(item => item.id === args.thread);
  if (!record) {
    throw new Error(`No thread ${args.thread} on pull ${args.pull}.`);
  }
  if (record.resolved) {
    return body;
  }
  if (parseMarker(record.body)?.kind !== 'fixed') {
    await deps.review.reply(args.pull, record.comment, body);
  }
  await deps.review.resolveThread(record.id);
  return body;
}

/**
 * Pushes `sdd/<key>` and opens its pull request when there is none. Refuses a
 * dirty worktree, and refuses several open pull requests, before anything
 * reaches the remote.
 */
export async function publish(
  args: {key: string; title: string},
  deps: {review: Review; vcs: Pick<Vcs, 'dirty' | 'push'>},
): Promise<string> {
  const dirt = await deps.vcs.dirty();
  if (dirt.length > 0) {
    throw new Error(
      [
        `The worktree is not clean, #${args.key} is not published. Remove the cause of each path (ignore a generated directory in the service .gitignore, delete a stray file, or commit a file of this task), then publish again:`,
        ...dirt.map(file => `  ${file}`),
      ].join('\n'),
    );
  }
  const open = (await deps.review.pulls(args.key))
    .filter(pr => pr.state === 'OPEN')
    .map(pr => pr.id);
  const choice = publishChoice(open);
  if (!choice.ok) {
    throw new Error(choice.reason);
  }
  await deps.vcs.push(args.key);
  const id = await deps.review.ensurePull(args.key, args.title, `${changeDir(args.key)}/`);
  return `#${args.key}: pull ${id}`;
}

export async function runSdd(argv: string[], box?: Machine): Promise<void> {
  const [command, ...rest] = argv;
  if (command === 'help' || command === '--help' || command === '-h') {
    console.error(usage);
    return;
  }
  if (command === undefined || !verbs[command]) {
    fail(usage);
  }
  try {
    await dispatch(box ?? (await openMachine(process.cwd())), command, rest);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

type Verb = (box: Machine, rest: string[]) => Promise<void>;

async function dispatch(box: Machine, command: string | undefined, rest: string[]): Promise<void> {
  const verb = command === undefined ? undefined : verbs[command];
  if (!verb) {
    fail(usage);
  }
  await verb(box, rest);
}

const verbs: Record<string, Verb> = {
  plan,
  step,
  worktree,
  set,
  wait,
  unwait,
  accept,
  publish: publishCommand,
  checks,
  threads,
  thread,
  mirror,
};

async function plan(box: Machine): Promise<void> {
  const snapshot = await loadCycle(
    box.tracker,
    box.review,
    key => box.vcs.filesAt(key),
    box.config.queues,
  );
  const decision = pick(await resolveCycle(snapshot, box.tracker, box.config.queues));
  const labels = decision.issue === null ? [] : (await box.tracker.issue(decision.issue)).labels;
  await printStep(decision, box, labels);
}

async function step(box: Machine, rest: string[]): Promise<void> {
  const args = stepArgs(rest);
  if (!args) {
    fail(usage);
  }
  const record = await box.tracker.issue(args.key);
  const inCycle =
    queueOf(record.labels, box.config.queues) !== undefined && record.labels.includes('sdd:cycle');
  if (!inCycle) {
    await printStep({kind: 'done', issue: args.key, reason: 'not in the open cycle'}, box, record.labels);
    return;
  }
  if (args.labels.length) {
    await box.tracker.editLabels(args.key, args.labels, []);
  }
  const labels = (await box.tracker.issue(args.key)).labels;
  await printStep(await turn(box, args.key), box, labels);
}

/** `queue` is the queue of the issue being driven. The prompt placeholder `QUEUE` is the first configured queue, the one a new child issue is filed in. */
function printStep(decision: Decision, box: Machine, labels: readonly string[]): void {
  console.log(
    JSON.stringify(
      {
        ...decision,
        queue: queueOf(labels, box.config.queues)?.name ?? box.config.queues[0].name,
        base: box.config.base,
      },
      null,
      2,
    ),
  );
}

async function worktree(box: Machine, rest: string[]): Promise<void> {
  const key = need(rest[0], usage);
  if (rest.length !== 1) {
    fail(usage);
  }
  const dir = await box.vcs.prepare(key, {worktreesDir: SESSION_WORKTREES, links: packageLinks(solverRoot())});
  console.log(dir);
}

async function set(box: Machine, rest: string[]): Promise<void> {
  const key = need(rest[0], usage);
  const phase = need(rest[1], usage);
  if (!PHASES.includes(phase as Phase)) {
    fail(usage);
  }
  await setPhase(key, phase as Phase, box.tracker);
}

async function wait(box: Machine, rest: string[]): Promise<void> {
  const key = need(rest[0], usage);
  const reason = rest.slice(1).join(' ').trim();
  if (!reason) {
    fail(usage);
  }
  await openWait(key, reason, box.tracker);
}

async function unwait(box: Machine, rest: string[]): Promise<void> {
  await setWait(need(rest[0], usage), false, box.tracker);
}

/** Close proposing, specifying, or designing. The agent does not run this. Merge is not this command. */
async function accept(box: Machine, rest: string[]): Promise<void> {
  const key = need(rest[0], usage);
  const record = await box.tracker.issue(key);
  const decision = acceptGate(record, readChange(key, box.vcs.filesAt(key)));
  if (decision.kind !== 'advance') {
    throw new Error(decision.reason);
  }
  await applyLabels(box.tracker, key, record.labels, labelsAfterAdvance(record.labels, decision.to));
  const login = await box.tracker.login();
  await box.tracker.comment(key, `sdd:accept ${decision.reason} by @${login}`);
  console.log(`#${key}: ${decision.reason}`);
}

async function publishCommand(box: Machine, rest: string[]): Promise<void> {
  const key = need(rest[0], usage);
  const title = rest.slice(1).join(' ');
  if (!title) {
    fail(usage);
  }
  console.log(await publish({key, title}, box));
}

async function checks(box: Machine, rest: string[]): Promise<void> {
  const text = (await box.review.checksText(need(rest[0], usage))).replace(/\n$/, '');
  if (text) {
    console.log(text);
  }
}

async function threads(box: Machine, rest: string[]): Promise<void> {
  const args = threadsArgs(rest);
  if (!args) {
    fail(usage);
  }
  const report = threadsReport(await box.review.threadList(args.pull), await box.review.comments(args.pull), {
    layer: args.layer,
    unmarked: args.unmarked,
  });
  console.log(JSON.stringify(report, null, 2));
}

const threadVerbs: Record<string, Verb> = {
  open: threadOpen,
  reply: threadReply,
  say: threadSay,
  resolve: threadResolve,
  fix: threadFix,
};

async function thread(box: Machine, rest: string[]): Promise<void> {
  const verb = rest[0] === undefined ? undefined : threadVerbs[rest[0]];
  if (!verb) {
    fail(usage);
  }
  await verb(box, rest);
}

async function threadOpen(box: Machine, rest: string[]): Promise<void> {
  const pull = need(rest[1], usage);
  const file = need(rest[2], usage);
  const line = Number(need(rest[3], usage));
  const body = rest.slice(4).join(' ');
  if (!Number.isInteger(line) || !body) {
    fail(usage);
  }
  await box.review.openThread(pull, {commit: await box.vcs.head(), path: file, line, body});
}

async function threadReply(box: Machine, rest: string[]): Promise<void> {
  const pull = need(rest[1], usage);
  const comment = need(rest[2], usage);
  const body = rest.slice(3).join(' ');
  if (!body) {
    fail(usage);
  }
  await box.review.reply(pull, comment, body);
}

async function threadSay(box: Machine, rest: string[]): Promise<void> {
  const pull = need(rest[1], usage);
  const body = rest.slice(2).join(' ');
  if (!body) {
    fail(usage);
  }
  await box.review.say(pull, body);
}

async function threadResolve(box: Machine, rest: string[]): Promise<void> {
  await box.review.resolveThread(need(rest[1], usage));
}

async function threadFix(box: Machine, rest: string[]): Promise<void> {
  const args = fixArgs(rest.slice(1));
  if (!args) {
    fail(usage);
  }
  console.log(await fixThread(args, box));
}

async function mirror(box: Machine, rest: string[]): Promise<void> {
  const key = need(rest[0], usage);
  const layer = need(rest[1], usage);
  const text = rest.slice(2).join(' ');
  if (!text) {
    fail(usage);
  }
  const record = await box.tracker.issue(key);
  await box.tracker.updateBody(key, updateMirror(record.body, layer, text));
}

if (process.argv[1]?.endsWith('sdd.ts') || process.argv[1]?.endsWith('sdd.mjs')) {
  await runSdd(process.argv.slice(2));
}
