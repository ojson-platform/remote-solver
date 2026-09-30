import type {Review, Vcs} from './machine/port.ts';

import {acceptIssue} from './accept.ts';
import {machine} from './adapters/compose.ts';
import {pick, resolveCycle} from './machine/flow.ts';
import {openWait, setPhase, setWait} from './machine/labels.ts';
import {parseMarker} from './machine/marker.ts';
import {updateMirror} from './machine/mirror.ts';
import {changeDir} from './machine/naming.ts';
import {PHASES, type Phase} from './machine/phase.ts';
import {publishChoice} from './machine/policy.ts';
import {threadsReport} from './machine/review.ts';
import {loadCycle} from './machine/snapshot.ts';

// Verbs the skills call. The GitHub and git adapters sit behind them.
//   sdd.ts plan
//   sdd.ts set <key> <phase> | wait <key> "<what the person does>" | unwait <key> | accept <key>
//   sdd.ts publish <key> "<pull title>"
//   sdd.ts checks <pull>
//   sdd.ts threads <pull> [--layer <layer>] [--unmarked]
//   sdd.ts thread open <pull> <path> <line> <body>
//   sdd.ts thread reply <pull> <comment> <body>
//   sdd.ts thread say <pull> <body>
//   sdd.ts thread resolve <thread>
//   sdd.ts thread fix <key> <pull> <thread> | thread fix <key> <pull> --conversation
//   sdd.ts mirror <key> <Layer> <text>

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
  'Usage: remote-solver plan | set <key> <phase> | wait <key> "<what the person does>" | unwait <key> | accept <key> | publish <key> "<title>" | checks <pull> | threads <pull> [--layer <layer>] [--unmarked] | thread open|reply|say|resolve ... | thread fix <key> <pull> <thread>|--conversation | mirror <key> <Layer> <text>';

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
export function fixThread(
  args: {key: string; pull: string; thread: string | null},
  deps: {review: Review; vcs: Pick<Vcs, 'head' | 'published'>},
): string {
  const head = deps.vcs.head();
  if (!deps.vcs.published(args.key, head)) {
    throw new Error(
      `HEAD ${head} is not on the remote branch of #${args.key}: Publish, then thread fix.`,
    );
  }
  const body = `sdd:fixed ${head}`;
  if (args.thread === null) {
    deps.review.say(args.pull, body);
    return body;
  }
  const record = deps.review.threadList(args.pull).find(item => item.id === args.thread);
  if (!record) {
    throw new Error(`No thread ${args.thread} on pull ${args.pull}.`);
  }
  if (record.resolved) {
    return body;
  }
  if (parseMarker(record.body)?.kind !== 'fixed') {
    deps.review.reply(args.pull, record.comment, body);
  }
  deps.review.resolveThread(record.id);
  return body;
}

/**
 * Pushes `sdd/<key>` and opens its pull request when there is none. Refuses a
 * dirty worktree, and refuses several open pull requests, before anything
 * reaches the remote.
 */
export function publish(
  args: {key: string; title: string},
  deps: {review: Review; vcs: Pick<Vcs, 'dirty' | 'push'>},
): string {
  const dirt = deps.vcs.dirty();
  if (dirt.length > 0) {
    throw new Error(
      [
        `The worktree is not clean, #${args.key} is not published. Remove the cause of each path (ignore a generated directory in the service .gitignore, delete a stray file, or commit a file of this task), then publish again:`,
        ...dirt.map(file => `  ${file}`),
      ].join('\n'),
    );
  }
  const open = deps.review
    .pulls(args.key)
    .filter(pr => pr.state === 'OPEN')
    .map(pr => pr.id);
  const choice = publishChoice(open);
  if (!choice.ok) {
    throw new Error(choice.reason);
  }
  deps.vcs.push(args.key);
  const id = deps.review.ensurePull(args.key, args.title, `${changeDir(args.key)}/`);
  return `#${args.key}: pull ${id}`;
}

export function runSdd(argv: string[], box = machine()): void {
  const [command, ...rest] = argv;
  try {
    dispatch(box, command, rest);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

function dispatch(
  box: ReturnType<typeof machine>,
  command: string | undefined,
  rest: string[],
): void {
  if (command === 'plan') {
    const snapshot = loadCycle(
      box.tracker,
      box.review,
      key => box.vcs.filesAt(key),
      box.config.queueLabel,
    );
    const decision = pick(resolveCycle(snapshot, box.tracker, box.config.queueLabel));
    console.log(JSON.stringify(decision, null, 2));
  } else if (command === 'set') {
    const key = need(rest[0], usage);
    const phase = need(rest[1], usage);
    if (!PHASES.includes(phase as Phase)) {
      fail(usage);
    }
    setPhase(key, phase as Phase, box.tracker);
  } else if (command === 'wait') {
    const key = need(rest[0], usage);
    const reason = rest.slice(1).join(' ').trim();
    if (!reason) {
      fail(usage);
    }
    openWait(key, reason, box.tracker);
  } else if (command === 'unwait') {
    setWait(need(rest[0], usage), false, box.tracker);
  } else if (command === 'accept') {
    console.log(acceptIssue(need(rest[0], usage), box));
  } else if (command === 'publish') {
    const key = need(rest[0], usage);
    const title = rest.slice(1).join(' ');
    if (!title) {
      fail(usage);
    }
    console.log(publish({key, title}, box));
  } else if (command === 'checks') {
    const text = box.review.checksText(need(rest[0], usage)).replace(/\n$/, '');
    if (text) {
      console.log(text);
    }
  } else if (command === 'threads') {
    const args = threadsArgs(rest);
    if (!args) {
      fail(usage);
    }
    const report = threadsReport(box.review.threadList(args.pull), box.review.comments(args.pull), {
      layer: args.layer,
      unmarked: args.unmarked,
    });
    console.log(JSON.stringify(report, null, 2));
  } else if (command === 'thread') {
    const sub = rest[0];
    if (sub === 'open') {
      const pull = need(rest[1], usage);
      const file = need(rest[2], usage);
      const line = Number(need(rest[3], usage));
      const body = rest.slice(4).join(' ');
      if (!Number.isInteger(line) || !body) {
        fail(usage);
      }
      box.review.openThread(pull, {commit: box.vcs.head(), path: file, line, body});
    } else if (sub === 'reply') {
      const pull = need(rest[1], usage);
      const comment = need(rest[2], usage);
      const body = rest.slice(3).join(' ');
      if (!body) {
        fail(usage);
      }
      box.review.reply(pull, comment, body);
    } else if (sub === 'say') {
      const pull = need(rest[1], usage);
      const body = rest.slice(2).join(' ');
      if (!body) {
        fail(usage);
      }
      box.review.say(pull, body);
    } else if (sub === 'resolve') {
      box.review.resolveThread(need(rest[1], usage));
    } else if (sub === 'fix') {
      const args = fixArgs(rest.slice(1));
      if (!args) {
        fail(usage);
      }
      console.log(fixThread(args, box));
    } else {
      fail(usage);
    }
  } else if (command === 'mirror') {
    const key = need(rest[0], usage);
    const layer = need(rest[1], usage);
    const text = rest.slice(2).join(' ');
    if (!text) {
      fail(usage);
    }
    const record = box.tracker.issue(key);
    box.tracker.updateBody(key, updateMirror(record.body, layer, text));
  } else {
    fail(usage);
  }
}

if (process.argv[1]?.endsWith('sdd.ts')) {
  runSdd(process.argv.slice(2));
}
