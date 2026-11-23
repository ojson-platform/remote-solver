import {spawnSync} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';

import {solverRoot, turn, type Machine} from './adapters/compose.ts';
import {openMachine} from './adapters/load.ts';
import {packageLinks} from './adapters/vcs/vcs.ts';
import {readChange} from './machine/change/change.ts';
import {foldChange, probeArchive, restoreChange} from './machine/change/fold.ts';
import {changeDir} from './machine/change/naming.ts';
import {
  accept as acceptGate,
  cycleRecord,
  publishChoice,
  type Decision,
} from './machine/decide/policy.ts';
import {applyLabels, pick, resolveCycle, serviceWait} from './machine/flow/flow.ts';
import {reportFoldFailure} from './machine/flow/step.ts';
import {proveCodeFix} from './machine/mark/code-fix.ts';
import {postFocusComment, validateFocusBody} from './machine/mark/focus.ts';
import {focusMarkerLine} from './machine/mark/marker.ts';
import {parseMarker} from './machine/mark/marker.ts';
import {updateMirror} from './machine/mark/mirror.ts';
import {openItemLayer, threadsReport, type OpenItemFile} from './machine/mark/review.ts';
import {askComment, openWait, setPhase, setWait} from './machine/phase/labels.ts';
import {
  GATE_EVENTS,
  labelsAfterAdvance,
  PHASES,
  phaseOf,
  type Phase,
} from './machine/phase/phase.ts';
import {
  contentFiles,
  type IssueLinkKind,
  type Review,
  type Tracker,
  type Vcs,
} from './machine/port.ts';
import {assembledStep} from './machine/skill/hook.ts';
import {queueOf} from './machine/spy/queues.ts';
import {resolveServiceRoot} from './machine/spy/service-config.ts';
import {loadCycle, pullSnapshots} from './machine/spy/snapshot.ts';
import {workingTree} from './window/change-files.ts';

// Verbs the skills call. The GitHub and git adapters sit behind them.
//   sdd plan
//   sdd set <key> <phase> | wait <key> "<what the person does>" | unwait <key> | accept <key>
//   sdd fold <key> | unfold <key> | probe <key>
//   sdd publish <key> "<pull title>"
//   sdd checks <pull>
//   sdd threads <pull> [--layer <layer>] [--unmarked]
//   sdd thread open <pull> <path> <line> <body>
//   sdd thread reply <pull> <comment> <body>
//   sdd thread say <pull> <body>
//   sdd thread resolve <thread>
//   sdd thread fix <key> <pull> <thread> | thread fix <key> <pull> --conversation
//   sdd mirror <key> <Layer> <text>
//   sdd focus <key> '<body>'
//   sdd link <key> <kind> <other>

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
  'Usage: sdd plan | step <key> [--auto-plan] [--auto-spec] [--auto-design] | worktree <key> | assign <key> | set <key> <phase> | wait <key> "<what the person does>" | unwait <key> | accept <key> | fold <key> | unfold <key> | probe <key> | rebase <key> <base> | commit <key> "<subject>" | publish <key> "<title>" | focus <key> "<body>" | link <key> <kind> <other> | checks <pull> | threads <pull> [--layer <layer>] [--unmarked] | thread open|reply|say|resolve ... | thread fix <key> <pull> <thread>|--conversation | mirror <key> <Layer> <text>';

const LINK_KINDS = new Set<IssueLinkKind>(['parent', 'blocks', 'blocked-by', 'depends-on']);

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

/** `link <key> <kind> <other>`. */
export function linkArgs(rest: string[]): {key: string; kind: IssueLinkKind; other: string} | null {
  const [key, kind, other] = rest;
  if (!key || !kind || !other || key.startsWith('-')) {
    return null;
  }
  if (!LINK_KINDS.has(kind as IssueLinkKind)) {
    return null;
  }
  return {key, kind: kind as IssueLinkKind, other};
}

export async function linkIssue(
  args: {key: string; kind: IssueLinkKind; other: string},
  tracker: Pick<Tracker, 'link'>,
): Promise<string> {
  await tracker.link(args.key, args.kind, args.other);
  return `#${args.key}: link ${args.kind} ${args.other}`;
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
 * conversation. Refuses while HEAD is not on the remote issue branch. A `code`
 * thread also refuses unless the boundary command fails on that commit's
 * parent and passes on HEAD. When the trace is `@ojson/spec-coverage`, a
 * scenario the delta does not name does not count. A thread whose latest reply
 * is already `sdd:fixed` is only resolved.
 */
export async function fixThread(
  args: {key: string; pull: string; thread: string | null},
  deps: {
    review: Review;
    vcs: Pick<Vcs, 'head' | 'published' | 'tree'>;
    readFile?: OpenItemFile;
    root?: string;
    prove?: (root: string) => Promise<void>;
  },
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
  if (openItemLayer(record.path, record.line, deps.readFile?.(record.path))) {
    throw new Error(
      `${record.path}:${record.line} is still an open item. Check it, publish, then thread fix.`,
    );
  }
  const marker = parseMarker(record.body);
  if (marker?.kind === 'layer' && marker.layer === 'code') {
    try {
      await (deps.prove ?? (root => proveCodeFix(root, deps.vcs.tree!(root))))(deps.root ?? process.cwd());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'thread fix refused';
      if (/hand the thread off to spec/i.test(message)) {
        await deps.review.reply(args.pull, record.comment, `sdd:layer=spec → specifying\n${message}`);
      }
      throw error;
    }
  }
  if (marker?.kind !== 'fixed') {
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
    await dispatch(box ?? (await openMachine(resolveServiceRoot(process.cwd()))), command, rest);
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
  assign,
  set,
  wait,
  unwait,
  accept,
  fold: foldCommand,
  unfold: unfoldCommand,
  probe: probeCommand,
  rebase: rebaseCommand,
  commit: commitCommand,
  publish: publishCommand,
  focus: focusCommand,
  checks,
  threads,
  thread,
  mirror,
  link: linkCommand,
};

async function plan(box: Machine): Promise<void> {
  const snapshot = await loadCycle(
    box.tracker,
    box.review,
    key => box.vcs.filesAt(key),
    box.config.queues,
    key => contentFiles(box.vcs, key),
    box.vcs.tipMessage ? key => box.vcs.tipMessage!(key) : undefined,
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
    await printStep(
      {kind: 'done', issue: args.key, reason: 'not in the open cycle'},
      box,
      record.labels,
    );
    return;
  }
  const me = await box.tracker.login();
  const owner = record.assignee ?? '';
  if (owner !== '' && owner !== me) {
    await printStep(
      {kind: 'wait', issue: args.key, reason: `assigned to ${owner}`},
      box,
      record.labels,
    );
    return;
  }
  if (owner === '') {
    await box.tracker.assign(args.key, me);
  }
  const foreign = serviceWait(box.root, record);
  if (foreign) {
    await printStep(foreign, box, record.labels);
    return;
  }
  if (args.labels.length) {
    await box.tracker.editLabels(args.key, args.labels, []);
  }
  const labels = (await box.tracker.issue(args.key)).labels;
  await printStep(await turn(box, args.key), box, labels);
}

/** `queue` is the queue of the issue being driven. The prompt placeholder `QUEUE` is the first configured queue, the one a new child issue is filed in. */
async function printStep(decision: Decision, box: Machine, labels: readonly string[]): Promise<void> {
  const step = decision.kind === 'agent' ? await agentStep(box, decision) : '';
  console.log(
    JSON.stringify(
      {
        ...decision,
        queue: queueOf(labels, box.config.queues)?.name ?? box.config.queues[0].name,
        base: box.config.base,
        ...(step === '' ? {} : {step}),
      },
      null,
      2,
    ),
  );
}

/** The checkout the agent will edit. Hooks are read there, then from the named service. */
async function agentStep(
  box: Machine,
  decision: Extract<Decision, {kind: 'agent'}>,
): Promise<string> {
  const record = await box.tracker.issue(decision.issue);
  const checkout = box.vcs.prepare
    ? await box.vcs.prepare(decision.issue, {
        worktreesDir: SESSION_WORKTREES,
        links: packageLinks(solverRoot()),
      })
    : box.root;
  const declared = (record.service ?? '').trim();
  const serviceRoot =
    declared === '' ? checkout : path.isAbsolute(declared) ? declared : path.join(checkout, declared);
  return assembledStep({
    solverRoot: solverRoot(),
    skill: decision.skill,
    action: decision.action,
    serviceRoot,
    sddHooks: record.sddHooks,
  });
}

async function worktree(box: Machine, rest: string[]): Promise<void> {
  const key = need(rest[0], usage);
  if (rest.length !== 1) {
    fail(usage);
  }
  const dir = await box.vcs.prepare(key, {
    worktreesDir: SESSION_WORKTREES,
    links: packageLinks(solverRoot()),
  });
  const marker = path.join(dir, '.sandcastle');
  mkdirSync(marker, {recursive: true});
  writeFileSync(path.join(marker, 'service-root'), `${box.root}\n`);
  console.log(dir);
}

/** Take an issue that belongs to someone else, after the person has agreed. */
async function assign(box: Machine, rest: string[]): Promise<void> {
  const key = need(rest[0], usage);
  if (rest.length !== 1) {
    fail(usage);
  }
  await box.tracker.assign(key, await box.tracker.login());
}

async function set(box: Machine, rest: string[]): Promise<void> {
  const key = need(rest[0], usage);
  const phase = need(rest[1], usage);
  if (
    !(PHASES as readonly string[]).includes(phase) &&
    !(GATE_EVENTS as readonly string[]).includes(phase)
  ) {
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
  await openWait(key, askComment(reason), box.tracker);
}

async function unwait(box: Machine, rest: string[]): Promise<void> {
  await setWait(need(rest[0], usage), false, box.tracker);
}

/** Close proposing, specifying, or designing. The agent does not run this. Merge is not this command. */
async function accept(box: Machine, rest: string[]): Promise<void> {
  const key = need(rest[0], usage);
  const record = await box.tracker.issue(key);
  const tip = box.vcs.tipMessage ? await box.vcs.tipMessage(key) : '';
  const pulls = await box.review.pulls(key);
  const decision = acceptGate(
    record,
    readChange(key, box.vcs.filesAt(key)),
    cycleRecord(record, tip),
    pulls,
  );
  if (decision.kind !== 'advance') {
    throw new Error(decision.reason);
  }
  await applyLabels(
    box.tracker,
    key,
    record.labels,
    labelsAfterAdvance(record.labels, decision.to),
  );
  const login = await box.tracker.login();
  await box.tracker.comment(key, `sdd:accept ${decision.reason} by @${login}`);
  console.log(`#${key}: ${decision.reason}`);
}

/** The accept step's fold. The poll does not run this. A refusal is the command text on stderr. */
async function foldCommand(box: Machine, rest: string[]): Promise<void> {
  const key = oneKey(rest);
  try {
    foldChange(process.cwd(), key, box.openspec(), box.vcs.tree!(process.cwd()));
  } catch (error) {
    await reportArchiveVerb(box, key, 'archive', 'archive the change', error);
    fail(error instanceof Error ? error.message : 'fold failed');
  }
}

/** Rebase the issue checkout onto the printed base. Conflicted paths are printed. The conflict stays for the agent. */
async function rebaseCommand(box: Machine, rest: string[]): Promise<void> {
  const key = rest[0];
  const base = rest[1];
  if (!key || !base || rest.length !== 2) {
    fail('Usage: sdd rebase <key> <base>');
  }
  if (!box.vcs.rebase) {
    fail('this host has no rebase');
  }
  const paths = await box.vcs.rebase(key, base);
  for (const file of paths) {
    console.log(file);
  }
}

/** Commit the issue checkout. The body is the line `#<key>`. */
async function commitCommand(box: Machine, rest: string[]): Promise<void> {
  const key = rest[0];
  const subject = rest.slice(1).join(' ');
  if (!key || subject === '') {
    fail('Usage: sdd commit <key> <subject>');
  }
  if (!box.vcs.commit) {
    fail('this host has no commit');
  }
  await box.vcs.commit(key, subject, `#${key}`);
}

/** The specify step's throwaway archive. A refusal stays on that step. The poll does not run this. */
async function probeCommand(box: Machine, rest: string[]): Promise<void> {
  const key = oneKey(rest);
  if (!box.vcs.scratch) {
    fail('this vcs has no second checkout');
  }
  try {
    await probeArchive(process.cwd(), key, box.openspec(), () => box.vcs.scratch!());
  } catch (error) {
    fail(error instanceof Error ? error.message : 'probe failed');
  }
}

/** The accept step's revert of the archive commit. The poll does not run this. */
async function unfoldCommand(box: Machine, rest: string[]): Promise<void> {
  const key = oneKey(rest);
  try {
    restoreChange(process.cwd(), key, box.vcs.tree!(process.cwd()));
  } catch (error) {
    await reportArchiveVerb(box, key, 'unarchive', 'return the delta to the change', error);
    fail(error instanceof Error ? error.message : 'unfold failed');
  }
}

function oneKey(rest: string[]): string {
  const key = need(rest[0], usage);
  if (rest.length !== 1) {
    fail(usage);
  }
  return key;
}

async function reportArchiveVerb(
  box: Machine,
  key: string,
  action: 'archive' | 'unarchive',
  reason: string,
  error: unknown,
): Promise<void> {
  try {
    const record = await box.tracker.issue(key);
    const files = box.vcs.filesAt(key);
    const pulls = await pullSnapshots(box.review, key, files);
    const open = pulls.find(item => item.state === 'OPEN');
    await reportFoldFailure({
      key,
      tracker: box.tracker,
      review: box.review,
      files,
      capabilities: readChange(key, files).capabilities,
      dir: process.cwd(),
      action,
      phase: phaseOf(record.labels) ?? 'accepting',
      pr: open ? String(open.id) : '',
      reason,
      error,
      tree: box.vcs.tree!(process.cwd()),
    });
  } catch (reportError) {
    console.error(reportError instanceof Error ? reportError.message : 'fold report failed');
  }
}

async function publishCommand(box: Machine, rest: string[]): Promise<void> {
  const key = need(rest[0], usage);
  const title = rest.slice(1).join(' ');
  if (!title) {
    fail(usage);
  }
  console.log(await publish({key, title}, box));
}

/** `focus <key> "<body>"`. Body is the marker line plus prose. */
export function focusArgs(rest: string[]): {key: string; body: string} | null {
  const key = rest[0];
  const body = rest.slice(1).join(' ');
  if (!key || !body || key.startsWith('-')) {
    return null;
  }
  return {key, body};
}

export async function postFocus(
  args: {key: string; body: string},
  deps: {
    tracker: Pick<Machine['tracker'], 'comments' | 'comment'>;
    vcs: Pick<Machine['vcs'], 'filesAt'>;
  },
): Promise<string> {
  if (!focusMarkerLine(args.body)) {
    throw new Error(
      'Focus comment must start with a recognized sdd:focus marker (sdd:focus, sdd:focus:plan, sdd:focus:spec, sdd:focus:design, sdd:focus:tasks, sdd:focus:code, or sdd:focus:accept) on the first line.',
    );
  }
  const proseIssue = validateFocusBody(args.body);
  if (proseIssue !== undefined) {
    throw new Error(`Focus prose: ${proseIssue}`);
  }
  const posted = await postFocusComment(args.key, args.body, deps);
  return posted ? `#${args.key}: focus comment posted` : `#${args.key}: focus comment unchanged`;
}

async function focusCommand(box: Machine, rest: string[]): Promise<void> {
  const args = focusArgs(rest);
  if (!args) {
    fail(usage);
  }
  console.log(await postFocus(args, box));
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
  const report = threadsReport(
    await box.review.threadList(args.pull),
    await box.review.comments(args.pull),
    {
      layer: args.layer,
      unmarked: args.unmarked,
    },
    checkoutFile,
  );
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

/** The line GitHub refused is not on the pushed head. Any other open failure keeps its own message. */
export function handoffAnchorRefusal(error: unknown, file: string, line: number): string | undefined {
  const stderr =
    typeof error === 'object' && error !== null && 'stderr' in error && typeof error.stderr === 'string'
      ? error.stderr
      : '';
  const message = error instanceof Error ? error.message : String(error);
  if (!/HTTP 422|Validation Failed/.test(`${message}\n${stderr}`)) {
    return undefined;
  }
  return `the line is not on the pushed head: ${file}:${line}. The step stops.`;
}

async function threadOpen(box: Machine, rest: string[]): Promise<void> {
  const pull = need(rest[1], usage);
  const file = need(rest[2], usage);
  const line = Number(need(rest[3], usage));
  const body = rest.slice(4).join(' ');
  if (!Number.isInteger(line) || !body) {
    fail(usage);
  }
  try {
    await box.review.openThread(pull, {commit: await box.vcs.head(), path: file, line, body});
  } catch (error) {
    const refusal = handoffAnchorRefusal(error, file, line);
    if (refusal) {
      fail(refusal);
    }
    throw error;
  }
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

function checkoutFile(rel: string): string | undefined {
  if (!rel.startsWith('openspec/changes/') || rel.includes('..')) {
    return undefined;
  }
  const files = workingTree(process.cwd());
  if (!files.exists(rel)) {
    return undefined;
  }
  return files.read(rel);
}

async function threadFix(box: Machine, rest: string[]): Promise<void> {
  const args = fixArgs(rest.slice(1));
  if (!args) {
    fail(usage);
  }
  const files = contentFiles(box.vcs, args.key);
  console.log(
    await fixThread(args, {
      review: box.review,
      vcs: box.vcs,
      readFile: rel => (files.exists(rel) ? files.read(rel) : undefined),
    }),
  );
}

async function linkCommand(box: Machine, rest: string[]): Promise<void> {
  const args = linkArgs(rest);
  if (!args) {
    fail(usage);
  }
  console.log(await linkIssue(args, box.tracker));
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

/** Node 22 trusts the public roots only, until this flag. Restart once so agentproxy's certificate verifies. */
function ensureSystemCa(): void {
  const entry = process.argv[1];
  const major = Number(process.versions.node.split('.')[0]);
  if (!entry || major < 22 || process.execArgv.includes('--use-system-ca')) {
    return;
  }
  const child = spawnSync(
    process.execPath,
    ['--use-system-ca', ...process.execArgv, entry, ...process.argv.slice(2)],
    {stdio: 'inherit'},
  );
  process.exit(child.status ?? 1);
}

if (process.argv[1]?.endsWith('sdd.ts') || process.argv[1]?.endsWith('sdd.mjs')) {
  ensureSystemCa();
  await runSdd(process.argv.slice(2));
}
