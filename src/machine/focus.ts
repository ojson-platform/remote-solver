import {type FileSource, type Review, type Tracker, type Vcs} from './port.ts';

import {focusMarkerLine, isFocusRecord, type FocusMarkerLine, unmarkedLine} from './marker.ts';
import {changeDir} from './naming.ts';
import {markerOf} from './review.ts';

/** How a step run ended. A run with none leaves the record unchanged. */
export type Signal = 'Publish' | 'Wait' | 'Hand-off';

export type FocusComment = {body: string; manager?: boolean};

/** Layer names the legacy ledger reader still recognizes, in record order. */
export const FOCUS_LAYERS = ['Change', 'Plan', 'Specify', 'Design', 'Tasks', 'Code'] as const;

type StepDeps = {
  tracker: Pick<Tracker, 'comments' | 'comment'>;
  review: Pick<Review, 'pulls' | 'range' | 'threadList'>;
  vcs: Pick<Vcs, 'compare' | 'filesAt' | 'contentCommit'>;
};

function hasChangeDir(key: string, files: FileSource): boolean {
  const root = changeDir(key);
  return files.list(root).length > 0;
}

function canonical(body: string): string {
  const text = body.replace(/\s+$/, '');
  const split = text.indexOf('\n');
  const first = unmarkedLine(split === -1 ? text : text.slice(0, split));
  const rest = split === -1 ? '' : text.slice(split + 1).replace(/\s+$/, '');
  return rest === '' ? first : `${first}\n${rest}`;
}

/** Latest non-manager focus comment body, in tracker order. */
export function latestFocusComment(comments: readonly FocusComment[]): string | undefined {
  let body: string | undefined;
  for (const comment of comments) {
    if (comment.manager || !isFocusRecord(comment.body)) {
      continue;
    }
    body = comment.body;
  }
  return body;
}

function handedOff(body: string): boolean {
  const name = markerOf(body);
  return name !== null && name !== 'note' && name !== 'fixed' && name !== 'begin';
}

/** What a step run had already left on the issue and the pull request. */
export type RunMarks = {
  waiting: boolean;
  comments: number;
  threads: readonly string[];
  spoken: readonly string[];
};

/** Labels, comments, and layer markers already on the cycle. */
export async function runMarks(
  key: string,
  deps: {
    tracker: Pick<Tracker, 'labels' | 'comments'>;
    review: Pick<Review, 'pulls' | 'threadList' | 'comments'>;
  },
): Promise<RunMarks> {
  const labels = await deps.tracker.labels(key);
  const comments = await deps.tracker.comments(key);
  const open = (await deps.review.pulls(key)).filter(pull => pull.state === 'OPEN');
  const threads: string[] = [];
  const spoken: string[] = [];
  if (open.length === 1 && open[0]) {
    for (const thread of await deps.review.threadList(open[0].id)) {
      if (!thread.resolved && handedOff(thread.body)) {
        threads.push(thread.id);
      }
    }
    for (const comment of await deps.review.comments(open[0].id)) {
      if (handedOff(comment.body)) {
        spoken.push(comment.body);
      }
    }
  }
  return {waiting: labels.includes('sdd:wait-human'), comments: comments.length, threads, spoken};
}

/**
 * A commit is Publish. A new layer marker is Hand-off. A wait label gained in
 * the run, or a new comment while that label is on, is Wait. Nothing new is no signal.
 */
export function observedSignal(commits: number, before: RunMarks, after: RunMarks): Signal | null {
  if (commits > 0) {
    return 'Publish';
  }
  const knownThreads = new Set(before.threads);
  const knownSpoken = new Set(before.spoken);
  const handed =
    after.threads.some(id => !knownThreads.has(id)) ||
    after.spoken.some(body => !knownSpoken.has(body));
  if (handed) {
    return 'Hand-off';
  }
  const waited = after.waiting && (!before.waiting || after.comments > before.comments);
  if (waited) {
    return 'Wait';
  }
  return null;
}

/**
 * Post one focus comment through the tracker port. Skips when the change
 * directory is absent or the canonical body matches the latest focus comment.
 */
export async function postFocusComment(
  key: string,
  body: string,
  deps: {
    tracker: Pick<Tracker, 'comments' | 'comment'>;
    vcs: Pick<Vcs, 'filesAt'>;
  },
): Promise<boolean> {
  if (!hasChangeDir(key, deps.vcs.filesAt(key))) {
    return false;
  }
  const text = body.endsWith('\n') ? body : `${body}\n`;
  const latest = latestFocusComment(await deps.tracker.comments(key));
  if (latest !== undefined && canonical(latest) === canonical(text)) {
    return false;
  }
  await deps.tracker.comment(key, text);
  return true;
}

/** Prose after the marker line of a focus comment. */
export function focusProse(body: string): string | undefined {
  if (!isFocusRecord(body)) {
    return undefined;
  }
  const prose = body.split('\n').slice(1).join('\n').replace(/\s+$/, '');
  return prose === '' ? undefined : prose;
}

/** Paragraphs separated by a blank line; trailing empty segments dropped. */
export function focusProseParagraphs(prose: string): string[] {
  return prose
    .split(/\n\s*\n/)
    .map(part => part.trim())
    .filter(part => part.length > 0);
}

const PHASE_NEXT =
  /\b(proposing|specifying|designing|tasking|implementing|accepting)\b|следующ(?:ая|ую)\s+фаз/i;
const DIFF_MARK = /^(\+\+\+|---|@@|\s*diff )/m;
const OPEN_ITEM = /-\s*\[\s*[ xX]\]/;
const LEDGER_MARK = /Plan solid|thread PRRT|^## /m;
const CYRILLIC = /[\u0400-\u04FF]/;

const MARKER_SHAPE: Record<FocusMarkerLine, {need: RegExp[]; maxParas: number}> = {
  'sdd:focus:plan': {
    need: [/читател|тикет|reader of the ticket/i, /отказ|refused/i],
    maxParas: 2,
  },
  'sdd:focus:spec': {
    need: [
      /нов|измен|new|existing promise changed/i,
      /сценар|scenario without/i,
      /не даём|does not make/i,
    ],
    maxParas: 2,
  },
  'sdd:focus:design': {
    need: [/жив|behavior lives/i, /отверг|rejected/i, /не стро|deliberately not/i, /наблюд|observed/i],
    maxParas: 2,
  },
  'sdd:focus:tasks': {
    need: [/слайс|slice/i, /порядок|порядк|order|Сначала|затем/i, /ждёт|waits/i],
    maxParas: 2,
  },
  'sdd:focus:code': {
    need: [/после коммита|became true/i, /не трог|left untouched/i, /не доказ|does not prove/i],
    maxParas: 2,
  },
  'sdd:focus:accept': {
    need: [
      /есть|has now|person has now/i,
      /намерен|left out on purpose/i,
      /capabilit|сценари|тест|scenarios.*test/i,
    ],
    maxParas: 2,
  },
  'sdd:focus': {
    need: [/pull request|PR|whole|весь/i],
    maxParas: 2,
  },
};

const THREAD_FIX_REMARK = /замечан|remark|ревью/i;
const FURTHER_PARA = /отказ|refused|слаб|weak|слабое место|открыт|open questions/i;
const LOOK_AT = /смотреть|look at/i;

function markerContentOk(marker: FocusMarkerLine, prose: string): boolean {
  const shape = MARKER_SHAPE[marker];
  return shape.need.every(re => re.test(prose));
}

/** Thread-fix visits name remarks in the second paragraph or add a third look-at paragraph. */
function isThreadFixVisit(paras: readonly string[]): boolean {
  if (paras.length >= 3) {
    return true;
  }
  if (paras.length >= 2 && THREAD_FIX_REMARK.test(paras[1] ?? '')) {
    return true;
  }
  return false;
}

/**
 * When prose breaks Publish paragraph rules, a short reason; otherwise undefined.
 * Skills pass bodies the focus verb posts unchanged.
 */
export function validateFocusBody(body: string): string | undefined {
  const marker = focusMarkerLine(body);
  const prose = focusProse(body);
  if (marker === null || prose === undefined) {
    return 'focus body needs a recognized marker and prose';
  }
  if (!CYRILLIC.test(prose)) {
    return 'prose must be Russian';
  }
  if (prose.length > 900) {
    return 'prose must stay short';
  }
  if (LEDGER_MARK.test(prose) || DIFF_MARK.test(prose) || OPEN_ITEM.test(prose)) {
    return 'prose must not include ledger, diff, or open-question text';
  }
  if (PHASE_NEXT.test(prose)) {
    return 'prose must not choose the next phase';
  }
  const paras = focusProseParagraphs(prose);
  const shape = MARKER_SHAPE[marker];
  const threadFix = isThreadFixVisit(paras);
  const maxParas = threadFix ? 3 : shape.maxParas;
  if (paras.length > maxParas) {
    return 'too many paragraphs for this marker';
  }
  if (!threadFix && !markerContentOk(marker, prose)) {
    return 'prose missing required shape for marker';
  }
  if (threadFix) {
    if (!markerContentOk(marker, paras[0] ?? '')) {
      return 'thread-fix first paragraph answers the phase question';
    }
    if (paras.length >= 2 && !THREAD_FIX_REMARK.test(paras[1] ?? '')) {
      return 'thread-fix second paragraph names remarks';
    }
    if (paras.length === 3 && !LOOK_AT.test(paras[2] ?? '')) {
      return 'last paragraph must say what to look at';
    }
    return undefined;
  }
  if (marker === 'sdd:focus:plan') {
    const hasPointer = /\d+\s+открыт|open questions/i.test(prose);
    if (hasPointer && paras.length !== 2) {
      return 'plan with open questions needs two paragraphs';
    }
    if (!hasPointer && paras.length !== 1) {
      return 'clean plan focus is one paragraph';
    }
    if (hasPointer && paras[1] && OPEN_ITEM.test(paras[1])) {
      return 'open-question pointer must not restate items';
    }
    const weak = /слаб|weak|посмотреть/i.test(prose);
    if (!weak && /слабое место/i.test(prose)) {
      return 'clean phase omits weak-spot wording';
    }
  }
  if (paras.length === 2 && marker !== 'sdd:focus:plan') {
    const second = paras[1] ?? '';
    if (!FURTHER_PARA.test(second)) {
      return 'further paragraph must be refusal, open questions, or weak check';
    }
  }
  return undefined;
}

/** First sentence of focus prose through `.`, `!`, or `?`, or the first line when none appear. */
export function firstFocusSentence(body: string): string | undefined {
  const prose = focusProse(body);
  if (prose === undefined) {
    return undefined;
  }
  const flat = prose.replace(/\n+/g, ' ').trim();
  const match = flat.match(/^([\s\S]*?[.!?])(?:\s|$)/);
  if (match) {
    return match[1].trim();
  }
  const firstLine = prose.split('\n')[0]?.trim() ?? '';
  return firstLine === '' ? undefined : firstLine;
}

/** Step runs no longer append a layer ledger; phase skills write focus after Publish. */
export async function endStep(
  _key: string,
  _outcome: {commits: number; signal?: Signal | null},
  _deps: StepDeps,
): Promise<void> {}
