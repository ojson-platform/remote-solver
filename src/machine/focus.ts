import type {FileSource, Review, Tracker, Vcs} from './port.ts';

import path from 'node:path';

import {isFocusRecord, unmarkedLine} from './marker.ts';
import {changeDir} from './naming.ts';
import {markerOf} from './review.ts';

/** How a step run ended. A run with none leaves the record unchanged. */
export type Signal = 'Publish' | 'Wait' | 'Hand-off';

export type FocusComment = {body: string; manager?: boolean};

export type RequirementGap = {
  capability: string;
  name: string;
  causes: readonly string[];
};

export type BoundaryGap = {capability: string; causes: readonly string[]};

export type ReviewPlace = {file: string; line: number; causes: readonly string[]};

type LayerName = 'Change' | 'Plan' | 'Specify' | 'Design' | 'Tasks' | 'Code';

/** Layer names the focus record writes, in record order. */
export const FOCUS_LAYERS = ['Change', 'Plan', 'Specify', 'Design', 'Tasks', 'Code'] as const;

const ORDER: readonly LayerName[] = FOCUS_LAYERS;

const MIRROR: Record<string, Exclude<LayerName, 'Change'>> = {
  proposal: 'Plan',
  spec: 'Specify',
  design: 'Design',
  tasks: 'Tasks',
  code: 'Code',
};

const PHASE_WORD =
  /^(proposing|specifying|designing|tasking|implementing|verifying|accepting)\b\s*/;

type Gap = {token: string; why: string};

type StepDeps = {
  tracker: Pick<Tracker, 'comments' | 'comment'>;
  review: Pick<Review, 'pulls' | 'range' | 'threadList'>;
  vcs: Pick<Vcs, 'compare' | 'filesAt'>;
  requirements?: readonly RequirementGap[];
  boundaries?: readonly BoundaryGap[];
  places?: readonly ReviewPlace[];
};

function signalOf(outcome: {commits: number; signal?: Signal | null}): Signal | null {
  if (outcome.commits > 0) {
    return 'Publish';
  }
  if (outcome.signal === 'Wait' || outcome.signal === 'Hand-off') {
    return outcome.signal;
  }
  return null;
}

function canonical(body: string): string {
  const text = body.replace(/\s+$/, '');
  const split = text.indexOf('\n');
  const first = unmarkedLine(split === -1 ? text : text.slice(0, split));
  const rest = split === -1 ? '' : text.slice(split + 1).replace(/\s+$/, '');
  return rest === '' ? first : `${first}\n${rest}`;
}

function latestFocus(comments: readonly FocusComment[]): string | undefined {
  let body: string | undefined;
  for (const comment of comments) {
    if (comment.manager || !isFocusRecord(comment.body)) {
      continue;
    }
    body = comment.body;
  }
  return body;
}

function isDiffLine(line: string): boolean {
  return /^(diff |index |@@ |\+\+\+ |--- )/.test(line) || /^[+-]/.test(line);
}

function cleanProse(text: string): string {
  const kept = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '' && !isDiffLine(line))
    .map(line =>
      line
        .replace(/\bcoverage\s*[:=]?\s*\d+(?:\s*\/\s*\d+)?/gi, '')
        .replace(/\b\d+\s*\/\s*\d+\b/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(line => line !== '');
  return kept.join(' ');
}

function proseFromBody(body: string): string {
  const arrow = body.indexOf('→');
  const tail = (arrow === -1 ? body : body.slice(arrow + 1)).trim().replace(PHASE_WORD, '');
  return cleanProse(tail);
}

function whyOf(causes: readonly string[]): string {
  return causes
    .map(cause => cleanProse(cause))
    .filter(cause => cause !== '')
    .join('; ');
}

function layerLines(name: LayerName, gaps: readonly Gap[]): string[] {
  if (gaps.length === 0) {
    return [`${name} solid`];
  }
  const why = gaps.map(gap => gap.why).filter(line => line !== '');
  return [`${name} ${gaps.map(gap => gap.token).join('; ')}`, ...why];
}

type Present = Record<LayerName, boolean>;

function presentLayers(key: string, files: FileSource): Present {
  const root = changeDir(key);
  const listed = files.list(root);
  const has = (rel: string) => listed.includes(rel) || files.exists(rel);
  const specs = `${path.join(root, 'specs')}${path.sep}`;
  return {
    Change: listed.length > 0,
    Plan: has(path.join(root, 'proposal.md')),
    Specify: listed.some(rel => rel.startsWith(specs) && rel.endsWith(`${path.sep}spec.md`)),
    Design: has(path.join(root, 'design.md')),
    Tasks: has(path.join(root, 'tasks.md')),
    Code: false,
  };
}

async function onePull(review: Pick<Review, 'pulls'>, key: string): Promise<string | undefined> {
  const open = (await review.pulls(key)).filter(pull => pull.state === 'OPEN');
  return open.length === 1 ? open[0]?.id : undefined;
}

async function readDiff(
  review: Pick<Review, 'pulls' | 'range'>,
  vcs: Pick<Vcs, 'compare'>,
  key: string,
): Promise<string> {
  const pull = await onePull(review, key);
  if (!pull) {
    return '';
  }
  const range = await review.range(pull);
  if (!range.base) {
    return '';
  }
  const span = await vcs.compare(range.base, range.head);
  return span?.diff ?? '';
}

async function readThreads(
  review: Pick<Review, 'pulls' | 'threadList'>,
  key: string,
): Promise<{handle: string; layer: Exclude<LayerName, 'Change'>; why: string}[]> {
  const pull = await onePull(review, key);
  if (!pull) {
    return [];
  }
  const found: {handle: string; layer: Exclude<LayerName, 'Change'>; why: string}[] = [];
  for (const thread of await review.threadList(pull)) {
    if (thread.resolved) {
      continue;
    }
    const layer = MIRROR[markerOf(thread.body) ?? ''];
    if (!layer) {
      continue;
    }
    found.push({handle: thread.id, layer, why: proseFromBody(thread.body)});
  }
  return found;
}

function render(input: {
  present: Present;
  threads: readonly {handle: string; layer: Exclude<LayerName, 'Change'>; why: string}[];
  requirements: readonly RequirementGap[];
  boundaries: readonly BoundaryGap[];
  places: readonly ReviewPlace[];
}): string {
  const gaps = new Map<LayerName, Gap[]>();
  for (const name of ORDER) {
    gaps.set(name, []);
  }
  for (const thread of input.threads) {
    if (!input.present[thread.layer]) {
      continue;
    }
    gaps.get(thread.layer)?.push({token: `thread ${thread.handle}`, why: thread.why});
  }
  if (input.present.Specify) {
    for (const gap of input.requirements) {
      gaps.get('Specify')?.push({
        token: `requirement ${gap.capability} ${gap.name}`,
        why: whyOf(gap.causes),
      });
    }
  }
  if (input.present.Design) {
    for (const gap of input.boundaries) {
      gaps.get('Design')?.push({token: `boundary ${gap.capability}`, why: whyOf(gap.causes)});
    }
  }
  if (input.present.Code) {
    for (const place of input.places) {
      gaps.get('Code')?.push({token: `${place.file}:${place.line}`, why: whyOf(place.causes)});
    }
  }
  const lines = ['sdd:focus'];
  for (const name of ORDER) {
    if (!input.present[name]) {
      continue;
    }
    lines.push(...layerLines(name, gaps.get(name) ?? []));
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Append one `sdd:focus` comment when a step run ends in a signal, the text
 * differs, and the cycle already has a change file. Gap choice beyond the
 * record stays with the caller.
 */
export async function endStep(
  key: string,
  outcome: {commits: number; signal?: Signal | null},
  deps: StepDeps,
): Promise<void> {
  if (signalOf(outcome) === null) {
    return;
  }
  const present = presentLayers(key, deps.vcs.filesAt(key));
  if (!present.Change) {
    return;
  }
  const diff = await readDiff(deps.review, deps.vcs, key);
  present.Code = diff.trim() !== '';
  const text = render({
    present,
    threads: await readThreads(deps.review, key),
    requirements: deps.requirements ?? [],
    boundaries: deps.boundaries ?? [],
    places: deps.places ?? [],
  });
  const latest = latestFocus(await deps.tracker.comments(key));
  if (latest !== undefined && canonical(latest) === canonical(text)) {
    return;
  }
  await deps.tracker.comment(key, text);
}
