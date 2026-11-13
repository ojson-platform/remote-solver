import type {
  CheckState,
  Conversation,
  IssueLinkKind,
  IssueRecord,
  Pull,
  Review,
  ReviewNote,
  Thread,
  ThreadRecord,
  ThreadTarget,
  Tracker,
} from '../../machine.ts';

import {execFileSync, spawn} from 'node:child_process';

import {parse} from 'yaml';

import {adapterMachine, type AdapterMachine} from '../../machine.ts';

export type CheckRollup = {
  state: string;
  statusCheckRollup:
    | {name?: string; status?: string; conclusion?: string; state?: string; completedAt?: string}[]
    | null;
};

const FAILED = ['FAILURE', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED'];
const PENDING = ['QUEUED', 'IN_PROGRESS', 'PENDING', 'WAITING', 'REQUESTED'];

/** On GitHub the phase is an `sdd:<phase>` label. */
export function labelHint(from: string, to: string): string {
  return `replace the label \`sdd:${from}\` with \`sdd:${to}\``;
}

/** A focus record starts with `sdd:focus`. Other machine comments keep the spy mark. */
function commentBody(body: string, machine: AdapterMachine): string {
  return machine.isFocusRecord(body) ? body : machine.markRobot(body);
}

export type Repo = {owner: string; name: string; slug: string};

export function repo(): Repo {
  const url = execFileSync('git', ['remote', 'get-url', 'origin'], {encoding: 'utf8'}).trim();
  const match = url.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (!match) {
    throw new Error(`Cannot parse GitHub repo from origin: ${url}`);
  }
  return {owner: match[1], name: match[2], slug: `${match[1]}/${match[2]}`};
}

export type ReviewComment = {
  path: string;
  body: string;
  line?: number;
  side?: 'RIGHT';
  subject_type?: 'file';
};

/** The body GitHub publishes as one review. Inline notes are threads; the rest is the review summary. */
export function changesPayload(
  head: string,
  notes: ReviewNote[],
): {
  commit_id: string;
  event: 'REQUEST_CHANGES';
  body: string;
  comments: ReviewComment[];
} {
  const comments: ReviewComment[] = [];
  const loose: string[] = [];
  for (const note of notes) {
    if (!note.path) {
      loose.push(note.body);
      continue;
    }
    if (note.line) {
      comments.push({path: note.path, body: note.body, line: note.line, side: 'RIGHT'});
      continue;
    }
    comments.push({path: note.path, body: note.body, subject_type: 'file'});
  }
  const body = comments.length === 0 ? loose.join('\n\n') : '';
  return {commit_id: head, event: 'REQUEST_CHANGES', body, comments};
}

/** One review thread as GitHub GraphQL returns it. */
type ThreadComment = {databaseId: number; author: {login: string} | null; body: string};

export type ThreadNode = {
  id: string;
  isResolved: boolean;
  path: string;
  line: number | null;
  comments: {nodes: ThreadComment[]};
  /** The last comment, when the query asks for it apart from the first. */
  last?: {nodes: ThreadComment[]};
};

function threadComments(node: ThreadNode): ThreadComment[] {
  const seen = new Set<number>();
  const out: ThreadComment[] = [];
  for (const item of [...(node.comments?.nodes ?? []), ...(node.last?.nodes ?? [])]) {
    if (seen.has(item.databaseId)) {
      continue;
    }
    seen.add(item.databaseId);
    out.push(item);
  }
  return out;
}

/** The handles a skill answers with: the thread id resolves, the latest comment id takes the reply. */
export function threadRecord(node: ThreadNode): ThreadRecord {
  const nodes = threadComments(node);
  const latest = nodes.at(-1);
  const comments = nodes.map(item => item.body);
  return {
    id: node.id,
    comment: latest ? String(latest.databaseId) : '',
    path: node.path,
    line: node.line,
    resolved: node.isResolved,
    body: latest?.body ?? '',
    comments,
  };
}

function command(
  file: string,
  args: string[],
  input?: string,
): Promise<{stdout: string; stderr: string}> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {stdio: ['pipe', 'pipe', 'pipe']});
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', code => {
      if (code) {
        reject(Object.assign(new Error(`${file} exited ${code}`), {stdout, stderr}));
        return;
      }
      resolve({stdout, stderr});
    });
    if (input) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

export type RestBody = {etag: string; body: string};

export type RestRead = {
  body: string;
  store?: RestBody;
  notModified: boolean;
  pauseUntil?: number;
};

const restBodies = new Map<string, RestBody>();
let pausedUntil = 0;
let pauseStderr = 'API rate limit exceeded';
let reportedLine = '';
let reportedAt = 0;

const PRIMARY_LIMIT = /rate limit(?: already)? exceeded|graphql_rate_limit/i;
const SECONDARY_LIMIT = /secondary rate limit/i;
const SECONDARY_WAIT_MS = 60_000;

/** Milliseconds until a spent rate limit may call gh again. */
export function githubPauseRemaining(now = Date.now()): number {
  return Math.max(0, pausedUntil - now);
}

/** Hold polling until a rate-limit reset. `until` is a unix millisecond time. */
export function noteGithubPause(until: number): void {
  pausedUntil = until;
}

/** Drop the pause and the cached REST bodies. Tests start from an empty gate. */
export function clearGithubPause(): void {
  pausedUntil = 0;
  pauseStderr = 'API rate limit exceeded';
  restBodies.clear();
  reportedLine = '';
  reportedAt = 0;
  unreachableRetries = 0;
}

/** A GET `gh api` read. Mutations, GraphQL, and `--jq` stay on the plain path. */
export function isRestGet(args: readonly string[]): boolean {
  if (args[0] !== 'api') {
    return false;
  }
  const skip = new Set([
    '-f',
    '-F',
    '--method',
    '-X',
    '--input',
    '--jq',
    '-q',
    '-i',
    '--include',
    'graphql',
  ]);
  if (args.some(arg => skip.has(arg))) {
    return false;
  }
  return args.some(arg => arg !== 'api' && !arg.startsWith('-'));
}

/** Ask `gh api` for headers, and send the previous validator when we have one. */
export function withRestValidators(args: readonly string[], etag?: string): string[] {
  const next = [...args];
  const at = next.indexOf('api');
  const extra = ['-i'];
  if (etag) {
    extra.push('-H', `If-None-Match: ${etag}`);
  }
  next.splice(at + 1, 0, ...extra);
  return next;
}

function splitHttp(
  stdout: string,
): {status: number; headers: Map<string, string>; body: string} | undefined {
  const blocks = stdout.split(/\r?\n(?=HTTP\/\d)/);
  const last = blocks[blocks.length - 1] ?? '';
  const lines = last.split(/\r?\n/);
  const statusLine = /^HTTP\/\d(?:\.\d)? (\d{3})/.exec(lines[0] ?? '');
  if (!statusLine?.[1]) {
    return undefined;
  }
  const headers = new Map<string, string>();
  let index = 1;
  while (index < lines.length && lines[index] !== '') {
    const line = lines[index] ?? '';
    const colon = line.indexOf(':');
    if (colon > 0) {
      headers.set(line.slice(0, colon).toLowerCase(), line.slice(colon + 1).trim());
    }
    index += 1;
  }
  return {status: Number(statusLine[1]), headers, body: lines.slice(index + 1).join('\n')};
}

/** Headers and body of one `gh api -i` response. A 304 keeps the previous body. */
export function readRest(stdout: string): RestRead {
  const http = splitHttp(stdout);
  if (!http) {
    return {body: stdout, notModified: false};
  }
  const etag = http.headers.get('etag');
  const reset = Number(http.headers.get('x-ratelimit-reset'));
  const spent =
    http.status === 403 && PRIMARY_LIMIT.test(http.body) && !SECONDARY_LIMIT.test(http.body);
  const pauseUntil = spent && Number.isFinite(reset) && reset > 0 ? reset * 1000 : undefined;
  const pause = pauseUntil !== undefined ? {pauseUntil} : {};
  if (http.status === 304) {
    return {body: '', notModified: true, ...pause};
  }
  const store = http.status === 200 && etag ? {etag, body: http.body} : undefined;
  return {body: http.body, notModified: false, ...(store ? {store} : {}), ...pause};
}

/** The body a caller parses. A 304 returns the cached body. */
export function restAnswer(read: RestRead, cached: RestBody | undefined): string {
  if (read.notModified) {
    return cached?.body ?? '';
  }
  return read.body;
}

/** The unix millisecond reset named by a 403 or by the rate-limit resource. */
export function resetMillis(stdout: string): number | undefined {
  const read = readRest(stdout);
  if (read.pauseUntil !== undefined) {
    return read.pauseUntil;
  }
  try {
    const parsed = JSON.parse(read.body) as {
      resources?: {
        core?: {reset?: unknown};
        graphql?: {remaining?: unknown; reset?: unknown};
      };
    };
    const graphql = parsed.resources?.graphql;
    if (graphql?.remaining === 0 && typeof graphql.reset === 'number' && graphql.reset > 0) {
      return graphql.reset * 1000;
    }
    const reset = parsed.resources?.core?.reset;
    if (typeof reset === 'number' && reset > 0) {
      return reset * 1000;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

async function learnReset(run: GhCommand): Promise<number | undefined> {
  try {
    const {stdout} = await run('gh', ['api', 'rate_limit', '-i']);
    return resetMillis(stdout);
  } catch (error) {
    return resetMillis(fieldOf(error, 'stdout'));
  }
}

function rememberPause(until: number | undefined): void {
  if (until !== undefined && until > Date.now()) {
    pausedUntil = until;
    pauseStderr = 'API rate limit exceeded';
  }
}

function fieldOf(error: unknown, key: 'stdout' | 'stderr'): string {
  if (error && typeof error === 'object' && key in error) {
    const value = (error as {stdout?: unknown; stderr?: unknown})[key];
    return typeof value === 'string' ? value : '';
  }
  return '';
}

function rateText(stdout: string, stderr: string, message = ''): string {
  return `${stdout}\n${stderr}\n${message}`;
}

function secondaryLimited(text: string): boolean {
  return SECONDARY_LIMIT.test(text);
}

function rateLimited(stdout: string, stderr: string): boolean {
  const text = rateText(stdout, stderr);
  return PRIMARY_LIMIT.test(text) || secondaryLimited(text);
}

/** Milliseconds a secondary limit asks us to wait. One minute when it names none. */
export function secondaryWait(stdout: string, stderr: string): number {
  const named = /retry-after:\s*(\d+)/i.exec(rateText(stdout, stderr));
  if (named?.[1]) {
    return Number(named[1]) * 1000;
  }
  return SECONDARY_WAIT_MS;
}

type GhCommand = (
  file: string,
  args: string[],
  input?: string,
) => Promise<{stdout: string; stderr: string}>;

const GH_TRIES = 2;
const GH_GAP_MS = [200];
let unreachableRetries = 0;
const DECODER = /invalid character '(.)' looking for beginning of value/;

function ghSnippet(stdout: string, stderr: string): string {
  for (const line of `${stdout}\n${stderr}`.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || DECODER.test(trimmed) || /^gh exited \d/.test(trimmed)) {
      continue;
    }
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      continue;
    }
    return trimmed.replace(/\s+/g, ' ').slice(0, 120);
  }
  return '';
}

/** A gateway page or a dropped connection. A parsed API error, including the rate limit, is absent. */
export function ghFailureReason(stdout: string, stderr: string, message = ''): string | undefined {
  const text = rateText(stdout, stderr, message);
  if (PRIMARY_LIMIT.test(text) || secondaryLimited(text)) {
    return undefined;
  }
  const status = /HTTP\/\d(?:\.\d)? (502|503|504)\b/.exec(text);
  if (status?.[1]) {
    return `GitHub answered HTTP ${status[1]}`;
  }
  const decoded = DECODER.test(stderr) || DECODER.test(stdout);
  const html = /<!DOCTYPE|<html/i.test(text);
  if (decoded || html) {
    const mark = DECODER.exec(stderr)?.[1] ?? DECODER.exec(stdout)?.[1];
    if (html || mark === '<') {
      return 'GitHub answered with HTML';
    }
    const bit = ghSnippet(stdout, stderr);
    return bit === '' ? 'GitHub answered with text' : `GitHub answered with text: ${bit}`;
  }
  if (/Service Unavailable|Bad Gateway|Gateway Time-?out/i.test(text)) {
    const bit = ghSnippet(stdout, stderr);
    return bit === '' ? 'GitHub answered with text' : `GitHub answered with text: ${bit}`;
  }
  if (
    /ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|connection reset|i\/o timeout|TLS handshake|network is unreachable|connect: connection refused|timeout awaiting response/i.test(
      text,
    )
  ) {
    return 'GitHub could not be reached';
  }
  return undefined;
}

function writtenLine(stdout: string, stderr: string): string {
  const bit = ghSnippet(stdout, stderr);
  if (bit !== '') {
    return bit;
  }
  const message = /"message"\s*:\s*"([^"]*)"/.exec(`${stdout}\n${stderr}`)?.[1];
  return message ? message.slice(0, 120) : '';
}

/** One line for a board or spy log. A gateway answer keeps its reason and drops the decoder text. */
export function ghErrorLine(error: unknown): string {
  const stdout = fieldOf(error, 'stdout');
  const stderr = fieldOf(error, 'stderr');
  const message = error instanceof Error ? error.message : String(error);
  const text = rateText(stdout, stderr, message);
  if (secondaryLimited(text)) {
    return 'GitHub secondary rate limit';
  }
  if (PRIMARY_LIMIT.test(text)) {
    return 'GitHub rate limit is spent';
  }
  return ghFailureReason(stdout, stderr, message) ?? (writtenLine(stdout, stderr) || message);
}

/** The same failure is one log line. A burst of the same answer does not repeat it. */
export function reportGithubError(error: unknown, now = Date.now()): void {
  const line = ghErrorLine(error);
  if (line === '' || (line === reportedLine && now - reportedAt < SECONDARY_WAIT_MS)) {
    return;
  }
  reportedLine = line;
  reportedAt = now;
  console.error(line);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

async function ghOnce(args: string[], input: string | undefined, run: GhCommand): Promise<string> {
  const get = isRestGet(args);
  const key = args.join('\0');
  const cached = get ? restBodies.get(key) : undefined;
  const sent = get ? withRestValidators(args, cached?.etag) : args;
  try {
    const {stdout} = await run('gh', sent, input);
    if (!get) {
      return stdout;
    }
    const read = readRest(stdout);
    rememberPause(read.pauseUntil);
    if (read.store) {
      restBodies.set(key, read.store);
    }
    return restAnswer(read, cached);
  } catch (error) {
    const stdout = fieldOf(error, 'stdout');
    const stderr = fieldOf(error, 'stderr');
    if (get) {
      const read = readRest(stdout);
      rememberPause(read.pauseUntil);
      if (read.notModified && cached) {
        return cached.body;
      }
    }
    const limited = rateText(stdout, stderr);
    if (rateLimited(stdout, stderr) && githubPauseRemaining() === 0) {
      if (secondaryLimited(limited)) {
        pausedUntil = Date.now() + secondaryWait(stdout, stderr);
        pauseStderr = 'secondary rate limit';
      } else {
        pauseStderr = 'API rate limit exceeded';
        const named = resetMillis(stdout);
        if (named !== undefined) {
          pausedUntil = named;
        } else {
          const learned = await learnReset(run);
          pausedUntil = learned !== undefined ? learned : Date.now() + 60_000;
        }
      }
    }
    throw error;
  }
}

/** A short call name. Field values and the request body stay out of the log. */
function ghCallName(args: readonly string[]): string {
  const kept: string[] = [];
  const skipValue = new Set(['-f', '-F', '--raw-field', '--field', '--body', '--comment', '--input']);
  const keepValue = new Set(['--json', '--jq', '--method', '--repo']);
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] ?? '';
    if (skipValue.has(arg)) {
      const value = args[i + 1] ?? '';
      i += 1;
      if (value.startsWith('query=') || value.startsWith('query ') || value.startsWith('query{')) {
        kept.push('query');
        continue;
      }
      const eq = value.indexOf('=');
      const name = eq === -1 ? value : value.slice(0, eq);
      if (name !== '' && name.length <= 40 && !value.includes('\n')) {
        kept.push(name);
      }
      continue;
    }
    if (keepValue.has(arg)) {
      const value = args[i + 1] ?? '';
      i += 1;
      kept.push(arg);
      if (value !== '' && value.length <= 80 && !value.includes('\n')) {
        kept.push(value);
      }
      continue;
    }
    if (arg.startsWith('-')) {
      continue;
    }
    kept.push(arg.length > 160 ? `${arg.slice(0, 160)}…` : arg);
  }
  return kept.join(' ') || 'gh';
}

function ghLog(ms: number, outcome: 'ok' | 'retry' | 'fail' | 'pause', name: string, detail?: string): void {
  const tail = detail && detail !== '' ? ` ${detail}` : '';
  console.error(`gh ${ms}ms ${outcome} ${name}${tail}`);
}

function ratePause(error: unknown): boolean {
  const stdout = fieldOf(error, 'stdout');
  const stderr = fieldOf(error, 'stderr');
  const message = error instanceof Error ? error.message : '';
  const text = rateText(stdout, stderr, message);
  return secondaryLimited(text) || PRIMARY_LIMIT.test(text) || rateLimited(stdout, stderr);
}

export async function gh(args: string[], input?: string, run: GhCommand = command): Promise<string> {
  const name = ghCallName(args);
  if (githubPauseRemaining() > 0) {
    ghLog(0, 'pause', name);
    throw Object.assign(new Error('gh exited 1'), {
      stdout: '',
      stderr: pauseStderr,
    });
  }
  let last: unknown;
  for (let attempt = 1; attempt <= GH_TRIES; attempt += 1) {
    const started = Date.now();
    try {
      const body = await ghOnce(args, input, run);
      unreachableRetries = 0;
      ghLog(Date.now() - started, 'ok', name);
      return body;
    } catch (error) {
      last = error;
      const ms = Date.now() - started;
      const reason = ghFailureReason(
        fieldOf(error, 'stdout'),
        fieldOf(error, 'stderr'),
        error instanceof Error ? error.message : '',
      );
      const unreachable = reason === 'GitHub could not be reached';
      const budgetSpent = unreachable && unreachableRetries > 0;
      if (!reason || attempt === GH_TRIES || budgetSpent) {
        if (unreachable) {
          unreachableRetries += 1;
        }
        if (ratePause(error)) {
          ghLog(ms, 'pause', name);
        } else {
          ghLog(ms, 'fail', name, reason || ghErrorLine(error));
        }
        if (reason) {
          throw Object.assign(new Error(reason), {
            stdout: fieldOf(error, 'stdout'),
            stderr: fieldOf(error, 'stderr'),
          });
        }
        throw error;
      }
      if (unreachable) {
        unreachableRetries += 1;
      }
      ghLog(ms, 'retry', name, reason);
      await sleep(GH_GAP_MS[attempt - 1] ?? 400);
    }
  }
  throw last;
}

/** GitHub check vocabulary stays in this adapter. The machine sees CheckState. */
export function classifyChecks(view: CheckRollup, name?: string): CheckState {
  if (view.state === 'MERGED') {
    return 'green';
  }
  const rollup = (view.statusCheckRollup ?? []).filter(check => !name || check.name === name);
  if (rollup.length === 0) {
    return 'none';
  }
  const failed = rollup.some(check => FAILED.includes(check.conclusion ?? check.state ?? ''));
  if (failed) {
    return 'red';
  }
  const pending = rollup.some(check => {
    const status = check.status ?? check.state ?? '';
    return PENDING.includes(status) && !check.conclusion;
  });
  return pending ? 'pending' : 'green';
}

/** Failed runs as `name@completedAt`, sorted. A cancelled sibling and a run without a time are omitted. */
export function failedCheckMarks(view: CheckRollup): string[] {
  const marks: string[] = [];
  for (const check of view.statusCheckRollup ?? []) {
    if ((check.conclusion ?? '') !== 'FAILURE') {
      continue;
    }
    const at = check.completedAt ?? '';
    if (at === '') {
      continue;
    }
    marks.push(`${check.name ?? 'check'}@${at}`);
  }
  return marks.sort();
}

type RawIssue = {
  number: number;
  title: string;
  body: string | null;
  state: string;
  labels?: {name: string}[];
  assignees?: {login: string}[];
  pull_request?: unknown;
};

const PULL_VIEW_FIELDS = 'statusCheckRollup,state,headRefOid,baseRefOid,mergeable';
const PULL_VIEW_FIELDS_HEAD = 'statusCheckRollup,state,headRefOid,mergeable';
const PULL_VIEW_FIELDS_NO_MERGE = 'statusCheckRollup,state,headRefOid,baseRefOid';
const PULL_VIEW_FIELDS_HEAD_ONLY = 'statusCheckRollup,state,headRefOid';

/** This `gh` exits when `--json` names a field it does not know. */
export function rejectedViewField(error: unknown, field: string): boolean {
  const needle = `Unknown JSON field: "${field}"`;
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const record = error as {stderr?: unknown; message?: unknown};
  return String(record.stderr ?? '').includes(needle) || String(record.message ?? '').includes(needle);
}

/**
 * Head and base commits when `pr view` omitted them.
 * Older `gh pr view --json` has no `baseRefOid` and rejects the field.
 */
export function pullRangeArgs(slug: string, pull: string): string[] {
  return ['api', `repos/${slug}/pulls/${pull}`, '--jq', '{head: .head.sha, base: .base.sha}'];
}

function commitRange(head: string, base: string): {head: string; base: string | null} {
  return {head, base: base === '' ? null : base};
}

/** A pull belongs to an issue when its title starts with `#<key>:` or `#<key> `. */
export function linkedTitle(key: string, title: string, machine: AdapterMachine = adapterMachine): boolean {
  return title.startsWith(machine.pullTitlePrefix(key)) || title.startsWith(`#${key} `);
}

export type IssueLinks = {
  parent?: string;
  dependsOn: string[];
  blockedBy: string[];
  blocks: string[];
};

function emptyLinks(): IssueLinks {
  return {dependsOn: [], blockedBy: [], blocks: []};
}

function issueNumbers(nodes: unknown): string[] {
  if (!Array.isArray(nodes)) {
    return [];
  }
  return nodes
    .map(node => {
      if (!node || typeof node !== 'object' || !('number' in node)) {
        return undefined;
      }
      const number = (node as {number?: unknown}).number;
      return typeof number === 'number' ? String(number) : undefined;
    })
    .filter((key): key is string => key !== undefined);
}

function carriesCycle(issue: RawIssue): boolean {
  return (issue.labels ?? []).some(label => label.name === 'sdd:cycle');
}

function asRecord(issue: RawIssue, links: IssueLinks, sddHooks?: unknown): IssueRecord {
  const body = issue.body ?? '';
  return {
    key: String(issue.number),
    title: issue.title,
    body,
    state: issue.state.toUpperCase(),
    labels: (issue.labels ?? []).map(label => label.name),
    assignee: issue.assignees?.[0]?.login ?? '',
    service: '',
    ...(sddHooks !== undefined ? {sddHooks} : {}),
    parent: links.parent,
    dependsOn: [...links.dependsOn],
    blockedBy: [...links.blockedBy],
    blocks: [...links.blocks],
  };
}

type IssueFieldValue = {
  issue_field_name?: string;
  data_type?: string;
  value?: unknown;
};

/**
 * The organization issue field `sddHooks`.
 * Absent when that text field is not in the list. The port does not create it.
 * Blank text is an empty value. Text that is not a map stays text.
 */
function cycleField(values: unknown): unknown | undefined {
  if (!Array.isArray(values)) {
    return undefined;
  }
  const field = values.find((item): item is IssueFieldValue => {
    if (!item || typeof item !== 'object') {
      return false;
    }
    const row = item as IssueFieldValue;
    return row.issue_field_name === 'sddHooks' && row.data_type === 'text' && typeof row.value === 'string';
  });
  if (!field || typeof field.value !== 'string') {
    return undefined;
  }
  if (field.value.trim() === '') {
    return '';
  }
  try {
    const parsed = parse(field.value) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return nonEmptyPoints(parsed as Record<string, unknown>);
    }
  } catch {
    // The text is not a map. The port keeps it so a reader can say it does not parse.
  }
  return field.value;
}

function isDoc(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** A string of spaces is not a point. An action with none is absent. */
function nonEmptyPoints(value: Record<string, unknown>): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  for (const [action, points] of Object.entries(value)) {
    if (!isDoc(points)) {
      map[action] = points;
      continue;
    }
    const kept: Record<string, unknown> = {};
    for (const [point, text] of Object.entries(points)) {
      if (typeof text === 'string' && text.trim() === '') {
        continue;
      }
      kept[point] = text;
    }
    if (Object.keys(kept).length > 0) {
      map[action] = kept;
    }
  }
  return map;
}

export type GitHubAdapters = {
  /** Base branch passed to `gh pr create`. */
  prBase?: string;
  ignoreComments?: RegExp[];
  /** Replaces `gh`. A test answers issue reads without calling GitHub. */
  run?: (args: string[], input?: string) => Promise<string>;
};

/** How long one repository pull list serves every issue read in that span. */
export const PULL_LIST_FRESH_MS = 60_000;

export function githubAdapters(
  options: GitHubAdapters = {},
  machine: AdapterMachine = adapterMachine,
): {tracker: Tracker; review: Review} {
  const prBase = options.prBase ?? 'master';
  const ignored = options.ignoreComments ?? [];
  const run = options.run ?? gh;
  let slug: string | null = null;
  let user: string | null = null;
  const seenPull = new Map<
    string,
    {checks: CheckState; failures: string[]; head: string; base: string; conflict: boolean; at: number}
  >();
  const repoSlug = () => {
    if (!slug) {
      slug = repo().slug;
    }
    return slug;
  };
  const login = async () => {
    if (!user) {
      user = (await run(['api', 'user', '--jq', '.login'])).trim();
    }
    return user;
  };
  const readIssue = async (key: string): Promise<RawIssue> =>
    JSON.parse(
      await run([
        'issue',
        'view',
        key,
        '--repo',
        repoSlug(),
        '--json',
        'number,title,body,state,labels,assignees',
      ]),
    ) as RawIssue;

  const readFields = async (key: string): Promise<unknown> => {
    try {
      return JSON.parse(
        await run(['api', `repos/${repoSlug()}/issues/${key}/issue-field-values?per_page=100`]),
      ) as unknown;
    } catch {
      return undefined;
    }
  };

  type LinkNode = {
    parent?: {number?: number} | null;
    blockedBy?: {nodes?: {number?: number}[]};
    blocking?: {nodes?: {number?: number}[]};
  };

  const LINK_FIELDS = 'parent{number} blockedBy(first:100){nodes{number}} blocking(first:100){nodes{number}}';

  const linksFrom = (issue: LinkNode | null | undefined): IssueLinks => {
    if (!issue) {
      return emptyLinks();
    }
    return {
      parent: issue.parent?.number === undefined ? undefined : String(issue.parent.number),
      dependsOn: [],
      blockedBy: issueNumbers(issue.blockedBy?.nodes),
      blocks: issueNumbers(issue.blocking?.nodes),
    };
  };

  const readLinks = async (key: string): Promise<IssueLinks> => {
    const [owner, name] = repoSlug().split('/');
    const query = `query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){issue(number:$number){${LINK_FIELDS}}}}`;
    const raw = JSON.parse(
      await run([
        'api',
        'graphql',
        '-f',
        `query=${query}`,
        '-f',
        `owner=${owner}`,
        '-f',
        `name=${name}`,
        '-F',
        `number=${key}`,
      ]),
    ) as {data?: {repository?: {issue?: LinkNode | null}}};
    return linksFrom(raw.data?.repository?.issue);
  };

  const readLinkBatch = async (keys: string[]): Promise<Map<string, IssueLinks>> => {
    const out = new Map<string, IssueLinks>();
    const [owner, name] = repoSlug().split('/');
    const chunk = 40;
    for (let index = 0; index < keys.length; index += chunk) {
      const slice = keys.slice(index, index + chunk);
      const aliases = slice.map(key => `i${key}:issue(number:${key}){${LINK_FIELDS}}`).join(' ');
      const query = `query($owner:String!,$name:String!){repository(owner:$owner,name:$name){${aliases}}}`;
      const raw = JSON.parse(
        await run([
          'api',
          'graphql',
          '-f',
          `query=${query}`,
          '-f',
          `owner=${owner}`,
          '-f',
          `name=${name}`,
        ]),
      ) as {data?: {repository?: Record<string, LinkNode | null>}};
      const repository = raw.data?.repository ?? {};
      for (const key of slice) {
        out.set(key, linksFrom(repository[`i${key}`]));
      }
    }
    return out;
  };

  const issueNodeId = async (key: string): Promise<string> => {
    const [owner, name] = repoSlug().split('/');
    const query = 'query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){issue(number:$number){id}}}';
    const raw = JSON.parse(
      await run([
        'api',
        'graphql',
        '-f',
        `query=${query}`,
        '-f',
        `owner=${owner}`,
        '-f',
        `name=${name}`,
        '-F',
        `number=${key}`,
      ]),
    ) as {data?: {repository?: {issue?: {id?: string}}}};
    const id = raw.data?.repository?.issue?.id;
    if (!id) {
      throw new Error(`GitHub issue ${key} has no node id`);
    }
    return id;
  };

  const writeLink = async (key: string, kind: IssueLinkKind, other: string): Promise<void> => {
    const [issueId, otherId] = await Promise.all([issueNodeId(key), issueNodeId(other)]);
    if (kind === 'parent') {
      const mutation =
        'mutation($issueId:ID!,$subIssueId:ID!){addSubIssue(input:{issueId:$issueId,subIssueId:$subIssueId}){clientMutationId}}';
      await run([
        'api',
        'graphql',
        '-f',
        `query=${mutation}`,
        '-f',
        `issueId=${otherId}`,
        '-f',
        `subIssueId=${issueId}`,
      ]);
      return;
    }
    const blockedId = kind === 'blocks' ? otherId : issueId;
    const blockerId = kind === 'blocks' ? issueId : otherId;
    const mutation =
      'mutation($issueId:ID!,$blockingIssueId:ID!){addBlockedBy(input:{issueId:$issueId,blockingIssueId:$blockingIssueId}){clientMutationId}}';
    await run([
      'api',
      'graphql',
      '-f',
      `query=${mutation}`,
      '-f',
      `issueId=${blockedId}`,
      '-f',
      `blockingIssueId=${blockerId}`,
    ]);
  };

  const withField = async (issue: RawIssue): Promise<IssueRecord> =>
    asRecord(
      issue,
      await readLinks(String(issue.number)),
      cycleField(await readFields(String(issue.number))),
    );

  const tracker: Tracker = {
    login,
    async listOpen() {
      const found = JSON.parse(
        await run(['api', `repos/${repoSlug()}/issues?state=open&per_page=100`]),
      ) as RawIssue[];
      const issues = found.filter(issue => issue.pull_request === undefined);
      const links = await readLinkBatch(issues.map(issue => String(issue.number)));
      return Promise.all(
        issues.map(async issue => {
          const key = String(issue.number);
          const link = links.get(key) ?? emptyLinks();
          return carriesCycle(issue)
            ? asRecord(issue, link, cycleField(await readFields(key)))
            : asRecord(issue, link);
        }),
      );
    },
    issue: async key => withField(await readIssue(key)),
    async assign(key, login) {
      await run(['issue', 'edit', key, '--repo', repoSlug(), '--add-assignee', login]);
    },
    labels: async key => asRecord(await readIssue(key), await readLinks(key)).labels,
    async editLabels(key, add, remove) {
      if (add.length === 0 && remove.length === 0) {
        return;
      }
      const args = ['issue', 'edit', key, '--repo', repoSlug()];
      for (const label of add) {
        args.push('--add-label', label);
      }
      if (remove.length) {
        args.push('--remove-label', remove.join(','));
      }
      await run(args);
    },
    async updateBody(key, body) {
      await run(['issue', 'edit', key, '--repo', repoSlug(), '--body', body]);
    },
    async comment(key, body) {
      await run(['issue', 'comment', key, '--repo', repoSlug(), '--body', commentBody(body, machine)]);
    },
    async comments(key) {
      const raw = JSON.parse(
        await run(['api', `repos/${repoSlug()}/issues/${key}/comments?per_page=100`]),
      ) as {body?: string; user?: {login?: string}}[];
      return raw.map(comment =>
        machine.readComment(comment.body ?? '', comment.user?.login ?? '', ignored),
      );
    },
    async close(key, comment) {
      await run(['issue', 'close', key, '--repo', repoSlug(), '--comment', machine.markRobot(comment)]);
    },
    link: writeLink,
    phaseHint: labelHint,
  };

  const viewArgs = (id: string, fields: string) => [
    'pr',
    'view',
    id,
    '--repo',
    repoSlug(),
    '--json',
    fields,
  ];

  const viewPull = async (
    id: string,
  ): Promise<{
    checks: CheckState;
    failures: string[];
    head: string;
    base: string;
    conflict: boolean;
    at: number;
  }> => {
    const cached = seenPull.get(id);
    if (cached && Date.now() - cached.at < PULL_LIST_FRESH_MS) {
      return cached;
    }
    let raw: string;
    try {
      raw = await run(viewArgs(id, PULL_VIEW_FIELDS));
    } catch (error) {
      const unknownBase = rejectedViewField(error, 'baseRefOid');
      const unknownMerge = rejectedViewField(error, 'mergeable');
      if (!unknownBase && !unknownMerge) {
        throw error;
      }
      const fields = unknownBase ? PULL_VIEW_FIELDS_HEAD : PULL_VIEW_FIELDS_NO_MERGE;
      try {
        raw = await run(viewArgs(id, fields));
      } catch (again) {
        const againBase = rejectedViewField(again, 'baseRefOid');
        const againMerge = rejectedViewField(again, 'mergeable');
        if ((unknownBase && againMerge) || (unknownMerge && againBase)) {
          raw = await run(viewArgs(id, PULL_VIEW_FIELDS_HEAD_ONLY));
        } else {
          throw again;
        }
      }
    }
    const view = JSON.parse(raw) as CheckRollup & {
      headRefOid?: unknown;
      baseRefOid?: unknown;
      mergeable?: unknown;
    };
    const record = {
      checks: classifyChecks(view),
      failures: failedCheckMarks(view),
      head: typeof view.headRefOid === 'string' ? view.headRefOid : '',
      base: typeof view.baseRefOid === 'string' ? view.baseRefOid : '',
      conflict: view.mergeable === 'CONFLICTING',
      at: Date.now(),
    };
    seenPull.set(id, record);
    return record;
  };

  const readPullList = async (state: 'open' | 'merged') =>
    JSON.parse(
      await run([
        'pr',
        'list',
        '--repo',
        repoSlug(),
        '--state',
        state,
        '--json',
        'number,title,state',
        '--limit',
        '100',
      ]),
    ) as {number: number; title: string; state: string}[];

  let repoPullsCache: {at: number; pulls: Promise<{number: number; title: string; state: string}[]>} | undefined;

  let threadCache: {at: number; byPull: Map<string, ThreadRecord[]>} | undefined;

  const dropRepoPulls = () => {
    repoPullsCache = undefined;
    threadCache = undefined;
  };

  const repoPulls = () => {
    const now = Date.now();
    if (repoPullsCache && now - repoPullsCache.at < PULL_LIST_FRESH_MS) {
      return repoPullsCache.pulls;
    }
    const pulls = Promise.all([readPullList('open'), readPullList('merged')]).then(lists =>
      lists.flat(),
    );
    repoPullsCache = {at: now, pulls};
    pulls.catch(() => {
      if (repoPullsCache?.pulls === pulls) {
        dropRepoPulls();
      }
    });
    return pulls;
  };

  const linked = async (key: string) => {
    const found = await repoPulls();
    return found.filter(pr => linkedTitle(key, pr.title));
  };

  const THREAD_SELECTION =
    'reviewThreads(first:100){nodes{id isResolved path line comments(first:1){nodes{databaseId author{login} body}} last:comments(last:1){nodes{databaseId author{login} body}}}}';

  const keptThreads = (nodes: ThreadNode[] | undefined): ThreadRecord[] =>
    (nodes ?? []).flatMap(node => {
      const comments = threadComments(node);
      if (comments.length === 0) {
        return [];
      }
      if (comments.every(item => machine.authorIgnored(item.author?.login ?? '', ignored))) {
        return [];
      }
      return [threadRecord(node)];
    });

  const fetchThreads = async (ids: string[]): Promise<Map<string, ThreadRecord[]>> => {
    const {owner, name} = repo();
    const out = new Map<string, ThreadRecord[]>();
    const read = async (query: string, number?: string) => {
      const args = ['api', 'graphql', '-f', `query=${query}`, '-f', `owner=${owner}`, '-f', `name=${name}`];
      if (number !== undefined) {
        args.push('-F', `number=${number}`);
      }
      return JSON.parse(await run(args)) as {
        data?: {repository?: Record<string, {reviewThreads?: {nodes: ThreadNode[]}} | null>};
      };
    };
    const one = async (id: string) => {
      const query = `query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){${THREAD_SELECTION}}}}`;
      const data = await read(query, id);
      out.set(id, keptThreads(data.data?.repository?.pullRequest?.reviewThreads?.nodes));
    };
    if (ids.length === 1) {
      await one(ids[0] ?? '');
      return out;
    }
    for (let index = 0; index < ids.length; index += 20) {
      const slice = ids.slice(index, index + 20);
      if (slice.length === 1) {
        await one(slice[0] ?? '');
        continue;
      }
      const aliases = slice.map(id => `p${id}:pullRequest(number:${id}){${THREAD_SELECTION}}`).join(' ');
      const query = `query($owner:String!,$name:String!){repository(owner:$owner,name:$name){${aliases}}}`;
      const data = await read(query);
      const repository = data.data?.repository ?? {};
      for (const id of slice) {
        out.set(id, keptThreads(repository[`p${id}`]?.reviewThreads?.nodes));
      }
    }
    return out;
  };

  const review: Review = {
    async pulls(key) {
      const found: Pull[] = [];
      for (const pr of await linked(key)) {
        const id = String(pr.number);
        if (pr.state !== 'OPEN') {
          found.push({
            id,
            title: pr.title,
            state: pr.state,
            checks: classifyChecks({state: pr.state, statusCheckRollup: []}),
          });
          continue;
        }
        const viewed = await viewPull(id);
        found.push({
          id,
          title: pr.title,
          state: pr.state,
          checks: viewed.checks,
          failures: viewed.failures,
          conflict: viewed.conflict,
        });
      }
      return found;
    },
    async threads(pull) {
      return (await this.threadList(pull)).map(thread => ({
        resolved: thread.resolved,
        body: thread.body,
      }));
    },
    async threadList(pull) {
      const now = Date.now();
      if (threadCache && now - threadCache.at < PULL_LIST_FRESH_MS) {
        const hit = threadCache.byPull.get(pull);
        if (hit) {
          return hit;
        }
      }
      let ids = [pull];
      if (repoPullsCache && now - repoPullsCache.at < PULL_LIST_FRESH_MS) {
        const open = (await repoPullsCache.pulls)
          .filter(pr => pr.state === 'OPEN')
          .map(pr => String(pr.number));
        if (open.length > 0) {
          ids = open.includes(pull) ? open : [...open, pull];
        }
      }
      const fetched = await fetchThreads(ids);
      const byPull = new Map(
        threadCache && now - threadCache.at < PULL_LIST_FRESH_MS ? threadCache.byPull : undefined,
      );
      for (const [id, records] of fetched) {
        byPull.set(id, records);
      }
      threadCache = {at: now, byPull};
      return byPull.get(pull) ?? [];
    },
    async comments(pull) {
      const comments = JSON.parse(
        await run(['api', `repos/${repoSlug()}/issues/${pull}/comments?per_page=100`]),
      ) as {user?: {login?: string}; body?: string}[];
      return comments.map(comment => ({
        body: comment.body ?? '',
        robot: machine.spokeByRobot(comment.body ?? '', comment.user?.login ?? '', ignored),
      }));
    },
    async ensurePull(key, title, body) {
      const open = (await linked(key))
        .filter(pr => pr.state === 'OPEN')
        .map(pr => String(pr.number));
      if (open[0]) {
        return open[0];
      }
      const url = (
        await run([
          'pr',
          'create',
          '--repo',
          repoSlug(),
          '--base',
          prBase,
          '--title',
          title,
          '--body',
          body,
        ])
      ).trim();
      const id = url.match(/\/(\d+)\s*$/)?.[1];
      if (!id) {
        throw new Error(`gh pr create returned no pull number: ${url}`);
      }
      dropRepoPulls();
      return id;
    },
    async openThread(pull, target: ThreadTarget) {
      const body = target.plain ? target.body : machine.markRobot(target.body);
      const args = [
        'api',
        '--method',
        'POST',
        `repos/${repoSlug()}/pulls/${pull}/comments`,
        '-f',
        `commit_id=${target.commit}`,
        '-f',
        `path=${target.path}`,
        '-f',
        `body=${body}`,
      ];
      if (target.subject_type === 'file') {
        args.push('-f', 'subject_type=file');
      } else {
        if (target.line === undefined) {
          throw new Error('line is missing for inline thread');
        }
        args.push('-F', `line=${target.line}`);
        if (target.side === 'right') {
          args.push('-f', 'side=RIGHT');
        } else if (target.side === 'left') {
          args.push('-f', 'side=LEFT');
        }
      }
      await run(args);
    },
    async reply(pull, comment, body) {
      await run([
        'api',
        '--method',
        'POST',
        `repos/${repoSlug()}/pulls/${pull}/comments/${comment}/replies`,
        '-f',
        `body=${machine.markRobot(body)}`,
      ]);
    },
    async say(pull, body) {
      await run(['issue', 'comment', pull, '--repo', repoSlug(), '--body', machine.markRobot(body)]);
    },
    async speak(pull, body) {
      await run(['issue', 'comment', pull, '--repo', repoSlug(), '--body', body]);
    },
    async flag(pull, head, notes) {
      const payload = changesPayload(head, notes);
      const post = () =>
        gh(
          ['api', '--method', 'POST', '--input', '-', `repos/${repoSlug()}/pulls/${pull}/reviews`],
          JSON.stringify(payload),
        );
      try {
        await post();
      } catch {
        const text = notes.map(note => note.body).join('\n\n');
        try {
          await run(
            [
              'api',
              '--method',
              'POST',
              '--input',
              '-',
              `repos/${repoSlug()}/pulls/${pull}/reviews`,
            ],
            JSON.stringify(
              changesPayload(
                head,
                notes.map(note => ({body: note.body})),
              ),
            ),
          );
        } catch {
          await this.speak(pull, text);
          return;
        }
        await this.speak(pull, text);
        return;
      }
      if (payload.comments.length === 0 && payload.body) {
        await this.speak(pull, payload.body);
      }
      const loose = notes
        .filter(note => !note.path)
        .map(note => note.body)
        .join('\n\n');
      if (payload.comments.length > 0 && loose) {
        await this.speak(pull, loose);
      }
    },
    async range(pull) {
      let seen = seenPull.get(pull);
      if (!seen) {
        seen = await viewPull(pull);
      }
      if (seen.head !== '' && seen.base !== '') {
        return commitRange(seen.head, seen.base);
      }
      const view = JSON.parse(await run(pullRangeArgs(repoSlug(), pull))) as {
        head?: string;
        base?: string | null;
      };
      const head = seen.head !== '' ? seen.head : (view.head ?? '');
      const base = view.base ?? '';
      const next = {
        checks: seen.checks,
        failures: seen.failures,
        head,
        base,
        conflict: seen.conflict,
        at: seen.at,
      };
      seenPull.set(pull, next);
      return commitRange(head, base);
    },
    async resolveThread(thread) {
      const query =
        'mutation($id:ID!){ resolveReviewThread(input:{threadId:$id}) { thread { isResolved } } }';
      await run(['api', 'graphql', '-f', `query=${query}`, '-f', `id=${thread}`]);
    },
    async checksText(pull) {
      try {
        const {stdout, stderr} = await command('gh', ['pr', 'checks', pull, '--repo', repoSlug()]);
        return `${stdout}${stderr}`;
      } catch (error) {
        const stdout =
          error && typeof error === 'object' && 'stdout' in error ? String(error.stdout) : '';
        const stderr =
          error && typeof error === 'object' && 'stderr' in error ? String(error.stderr) : '';
        return `${stdout}${stderr}`;
      }
    },
    async merge(pull) {
      try {
        await run(['pr', 'merge', pull, '--repo', repoSlug(), '--rebase']);
      } catch (error) {
        const stderr =
          error && typeof error === 'object' && 'stderr' in error ? String(error.stderr) : '';
        const message = error instanceof Error ? error.message : String(error);
        if (!/already merged/i.test(`${message}\n${stderr}`)) {
          throw error;
        }
      }
      const view = JSON.parse(
        await run(['pr', 'view', pull, '--repo', repoSlug(), '--json', 'state']),
      ) as {
        state?: string;
      };
      if (view.state !== 'MERGED') {
        throw new Error(`merge of PR #${pull} left it ${view.state ?? 'OPEN'}`);
      }
    },
  };

  return {tracker, review};
}

export type MemoryIssue = {
  key: string;
  title: string;
  body: string;
  state: string;
  labels: string[];
  parent?: string;
  dependsOn?: string[];
  blockedBy?: string[];
  blocks?: string[];
  /** Absent means the runner. Empty string means nobody. */
  assignee?: string;
  /** Directory of the service. Empty or absent means the chat's directory. */
  service?: string;
  /** Cycle hook field. The port does not create it. */
  sddHooks?: unknown;
};

export type MemorySeed = {
  user?: string;
  issues?: MemoryIssue[];
  pulls?: Record<string, {id: string; title: string; state: string}[]>;
  threads?: Record<string, Thread[]>;
  /** Full records. When absent, `threads` are served with placeholder handles. */
  threadList?: Record<string, ThreadRecord[]>;
  comments?: Record<string, Conversation[]>;
  checks?: Record<string, {checks: CheckState}>;
  checksText?: Record<string, string>;
  ranges?: Record<string, {head: string; base: string | null}>;
};

export type MemoryPorts = {
  tracker: Tracker;
  review: Review;
  calls: string[];
  /** A person comment. It is not a robot note, and it does not clear `sdd:refused`. */
  person(key: string, body: string): void;
};

export function memoryPorts(seed: MemorySeed = {}, machine: AdapterMachine = adapterMachine): MemoryPorts {
  const issues = (seed.issues ?? []).map(issue => ({
    ...issue,
    labels: [...issue.labels],
    dependsOn: issue.dependsOn ? [...issue.dependsOn] : undefined,
    blockedBy: issue.blockedBy ? [...issue.blockedBy] : undefined,
    blocks: issue.blocks ? [...issue.blocks] : undefined,
  }));
  const calls: string[] = [];
  const issueComments = new Map<string, {body: string; manager?: boolean}[]>();
  const find = (key: string) => {
    const issue = issues.find(item => item.key === key);
    if (!issue) {
      throw new Error(`no issue ${key}`);
    }
    return issue;
  };
  const record = (issue: MemoryIssue): IssueRecord => ({
    key: issue.key,
    title: issue.title,
    body: issue.body,
    state: issue.state,
    labels: [...issue.labels],
    assignee: issue.assignee ?? seed.user ?? 'robot',
    service: issue.service ?? '',
    ...(issue.sddHooks !== undefined ? {sddHooks: issue.sddHooks} : {}),
    parent: issue.parent,
    dependsOn: issue.dependsOn ?? [],
    blockedBy: issue.blockedBy ?? [],
    blocks: issue.blocks ?? [],
  });
  const tracker: Tracker = {
    login: async () => {
      calls.push('login');
      return seed.user ?? 'robot';
    },
    listOpen: async () => {
      calls.push('listOpen');
      return issues.filter(issue => issue.state === 'OPEN').map(record);
    },
    issue: async key => {
      calls.push('issue');
      return record(find(key));
    },
    async assign(key, login) {
      calls.push('assign');
      find(key).assignee = login;
    },
    labels: async key => {
      calls.push('labels');
      return [...find(key).labels];
    },
    async editLabels(key, add, remove) {
      calls.push('editLabels');
      const issue = find(key);
      issue.labels = issue.labels.filter(name => !remove.includes(name));
      for (const label of add) {
        if (!issue.labels.includes(label)) {
          issue.labels.push(label);
        }
      }
    },
    async updateBody(key, body) {
      calls.push('updateBody');
      find(key).body = body;
    },
    async comment(key, body) {
      calls.push('comment');
      const posted = commentBody(body, machine);
      calls.push(`body:${posted}`);
      const list = issueComments.get(key) ?? [];
      list.push({body: posted, manager: false});
      issueComments.set(key, list);
    },
    async comments(key) {
      calls.push('comments');
      return (issueComments.get(key) ?? []).map(item => ({
        body: item.body,
        manager: item.manager === true,
      }));
    },
    async close(key, comment) {
      calls.push(`close:${comment}`);
      calls.push(`body:${machine.markRobot(comment)}`);
      find(key).state = 'CLOSED';
    },
    async link(key, kind, other) {
      calls.push(`link:${kind}:${other}`);
      const issue = find(key);
      if (kind === 'parent') {
        issue.parent = other;
        return;
      }
      if (kind === 'blocked-by') {
        issue.blockedBy = [...(issue.blockedBy ?? []), other];
        return;
      }
      if (kind === 'depends-on') {
        issue.dependsOn = [...(issue.dependsOn ?? []), other];
        return;
      }
      issue.blocks = [...(issue.blocks ?? []), other];
    },
    phaseHint: labelHint,
  };
  const review: Review = {
    async pulls(key) {
      calls.push('pulls');
      return (seed.pulls?.[key] ?? []).map(pr => {
        const checks = seed.checks?.[pr.id] ?? {
          checks: 'none' as const,
        };
        return {...pr, ...checks};
      });
    },
    async threads(pull) {
      calls.push('threads');
      return seed.threads?.[pull] ?? seed.threadList?.[pull] ?? [];
    },
    async threadList(pull) {
      calls.push('threadList');
      const full = seed.threadList?.[pull];
      if (full) {
        return full;
      }
      return (seed.threads?.[pull] ?? []).map((thread, index) => ({
        ...thread,
        id: `T${index + 1}`,
        comment: `C${index + 1}`,
        path: '',
        line: null,
        comments: [thread.body],
      }));
    },
    async comments(pull) {
      calls.push('comments');
      return seed.comments?.[pull] ?? [];
    },
    async ensurePull(key) {
      calls.push('ensurePull');
      const open = (seed.pulls?.[key] ?? []).filter(pr => pr.state === 'OPEN').map(pr => pr.id);
      return open[0] ?? 'new';
    },
    async openThread(_pull, target) {
      calls.push('openThread');
      calls.push(`body:${machine.markRobot(target.body)}`);
    },
    async reply(_pull, _comment, body) {
      calls.push('reply');
      calls.push(`body:${machine.markRobot(body)}`);
    },
    async say(_pull, body) {
      calls.push('say');
      calls.push(`body:${machine.markRobot(body)}`);
    },
    async speak(_pull, body) {
      calls.push('speak');
      calls.push(`body:${body}`);
    },
    async flag(_pull, head, notes) {
      calls.push('flag');
      calls.push(`head:${head}`);
      const loose: string[] = [];
      for (const note of notes) {
        if (note.path) {
          calls.push(`at:${note.path}:${note.line ?? ''}:${note.body}`);
          continue;
        }
        loose.push(note.body);
        calls.push(`loose:${note.body}`);
      }
      if (loose.length > 0) {
        calls.push('speak');
        calls.push(`body:${loose.join('\n\n')}`);
      }
    },
    async range(pull) {
      calls.push('range');
      return seed.ranges?.[pull] ?? {head: '', base: null};
    },
    async resolveThread() {
      calls.push('resolveThread');
    },
    async checksText(pull) {
      calls.push('checksText');
      return seed.checksText?.[pull] ?? '';
    },
    async merge(pull) {
      calls.push(`merge:${pull}`);
      for (const list of Object.values(seed.pulls ?? {})) {
        for (const pr of list) {
          if (pr.id === pull) {
            pr.state = 'MERGED';
          }
        }
      }
    },
  };
  function person(key: string, body: string): void {
    const list = issueComments.get(key) ?? [];
    list.push({body, manager: true});
    issueComments.set(key, list);
  }
  return {tracker, review, calls, person};
}
