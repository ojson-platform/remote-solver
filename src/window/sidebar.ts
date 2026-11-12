import type {Decision} from '../machine/decide/policy.ts';

import {parseMarker} from '../machine/mark/marker.ts';
import {phaseOf} from '../machine/phase/phase.ts';
import {hookPoint} from '../machine/skill/hook.ts';

import {focusBlockProse, liveFocus, writtenFocusPages} from './focus.ts';
import {
  isDoc,
  type BoardTurn,
  type CardState,
  type SidebarBlock,
  type SidebarHookPoint,
  type WindowComment,
  type WindowReview,
  type WindowTicket,
} from './types.ts';

const HOOK_UNREADABLE = 'поле хука не читается';

const SDD_BEGIN = '<!-- sdd:begin -->';
const SDD_END = '<!-- sdd:end -->';

/** Author text outside one complete sdd mirror pair in the issue body. */
export function authorText(body: string | undefined): string | undefined {
  if (body === undefined) {
    return undefined;
  }
  let text = body;
  const begin = text.indexOf(SDD_BEGIN);
  const end = text.indexOf(SDD_END);
  if (begin >= 0 && end > begin) {
    text = text.slice(0, begin) + text.slice(end + SDD_END.length);
  }
  if (text.trim() === '') {
    return undefined;
  }
  return text;
}

function hookParagraph(value: unknown): string | undefined {
  const point = hookPoint(value);
  if (point.kind === 'text') {
    return point.text;
  }
  if (point.kind === 'list') {
    return point.items.join('\n\n');
  }
  if (point.kind === 'unread') {
    return HOOK_UNREADABLE;
  }
  return undefined;
}

function isPointRecord(value: unknown): value is {action: string; point: string; value?: unknown} {
  return isDoc(value) && typeof value.action === 'string' && typeof value.point === 'string';
}

function hookBlock(value: unknown): SidebarBlock | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return undefined;
    }
    if (!value.every(isPointRecord)) {
      return {kind: 'hook', line: HOOK_UNREADABLE};
    }
    const points = value.flatMap(item => {
      const paragraph = hookParagraph(item.value);
      return paragraph === undefined ? [] : [{action: item.action, point: item.point, paragraph}];
    });
    if (points.length === 0) {
      return undefined;
    }
    return {kind: 'hook', points};
  }
  if (!isDoc(value)) {
    return {kind: 'hook', line: HOOK_UNREADABLE};
  }
  const points: SidebarHookPoint[] = [];
  for (const [action, inner] of Object.entries(value)) {
    if (!isDoc(inner)) {
      continue;
    }
    for (const [point, pointValue] of Object.entries(inner)) {
      const paragraph = hookParagraph(pointValue);
      if (paragraph === undefined) {
        continue;
      }
      points.push({action, point, paragraph});
    }
  }
  if (points.length === 0) {
    return undefined;
  }
  return {kind: 'hook', points};
}

function humanComments(thread: {comments?: readonly string[]; lines: readonly string[]}): string[] {
  const bodies = thread.comments ?? [...thread.lines];
  return bodies.filter(body => parseMarker(body) === null);
}

function anchoredOnLine(thread: {
  file?: string;
  line?: number | null;
  comments?: readonly string[];
  lines: readonly string[];
}): boolean {
  return (
    typeof thread.file === 'string' &&
    thread.file !== '' &&
    thread.line != null &&
    humanComments(thread).length > 0
  );
}

type PhaseLayer = 'Plan' | 'Specify' | 'Design' | 'Tasks' | 'Code';

function layerOfPath(file: string): PhaseLayer {
  const normalized = file.replace(/\\/g, '/');
  const base = normalized.split('/').pop() ?? '';
  if (base === 'proposal.md') {
    return 'Plan';
  }
  if (base === 'design.md') {
    return 'Design';
  }
  if (base === 'tasks.md' || normalized.includes('/tasks/')) {
    return 'Tasks';
  }
  if (normalized.includes('/specs/') && normalized.endsWith('/spec.md')) {
    return 'Specify';
  }
  return 'Code';
}

function onPhase(thread: {
  file?: string;
  line?: number | null;
  comments?: readonly string[];
  lines: readonly string[];
}): boolean {
  return (
    typeof thread.file === 'string' &&
    thread.file !== '' &&
    humanComments(thread).length > 0 &&
    !anchoredOnLine(thread)
  );
}

function phaseThreadBlocks(reading: WindowReview | undefined): SidebarBlock[] {
  if (!reading) {
    return [];
  }
  const out: SidebarBlock[] = [];
  for (const thread of reading.threads ?? []) {
    if (!onPhase(thread)) {
      continue;
    }
    out.push({
      kind: 'phase-thread',
      layer: layerOfPath(thread.file!),
      file: thread.file!,
      comments: humanComments(thread),
      ...(thread.fixedCommit !== undefined ? {fixedCommit: thread.fixedCommit} : {}),
    });
  }
  return out;
}

function lineThreadBlocks(reading: WindowReview | undefined): SidebarBlock[] {
  if (!reading) {
    return [];
  }
  const out: SidebarBlock[] = [];
  for (const thread of reading.threads ?? []) {
    if (!anchoredOnLine(thread)) {
      continue;
    }
    out.push({
      kind: 'line-thread',
      file: thread.file!,
      line: thread.line!,
      comments: humanComments(thread),
      ...(thread.fixedCommit !== undefined ? {fixedCommit: thread.fixedCommit} : {}),
    });
  }
  return out;
}

function writtenFocusBlocks(comments: readonly WindowComment[] | undefined): SidebarBlock[] {
  return writtenFocusPages(comments).map(page => ({
    kind: 'focus' as const,
    marker: page.marker,
    body: page.body,
    display: focusBlockProse(page.marker, page.body),
  }));
}

/** The count is the whole page only when this phase has not published its retelling. */
function liveOpenCount(
  decision: Decision | undefined,
  written: readonly SidebarBlock[],
  facts: {questions: number; decisions: number} | undefined,
): number {
  if (decision?.kind !== 'wait' || facts === undefined) {
    return 0;
  }
  const newest = written.find(block => block.kind === 'focus');
  const marker = newest?.kind === 'focus' ? newest.marker : undefined;
  if (decision.reason.includes('Open questions') && marker !== 'sdd:focus:plan') {
    return facts.questions;
  }
  if (decision.reason.includes('open decision') && marker !== 'sdd:focus:design') {
    return facts.decisions;
  }
  return 0;
}

export function blocksFor(
  item: WindowTicket,
  ctx: {
    inPool: boolean;
    manager: () => string | undefined;
    review: () => WindowReview | undefined;
    reading: () => readonly WindowTicket[];
    gathered: (item: WindowTicket) => string | undefined;
    serviceBroken: (checkout: string) => boolean;
    cardOf: (item: WindowTicket) => CardState;
    branchFacts?: (key: string) => {questions: number; decisions: number} | undefined;
    running?: () => boolean;
    turn?: () => BoardTurn | undefined;
    settledDecision?: () => Decision | undefined;
  },
): SidebarBlock[] {
  const blocks: SidebarBlock[] = [];
  const phase = phaseOf([...item.labels]);
  const written = writtenFocusBlocks(item.comments);
  const decision = ctx.settledDecision?.();
  const live = liveFocus({
    phase,
    ask: item.labels.includes('sdd:wait-human'),
    running: ctx.running?.() ?? false,
    turn: ctx.turn?.(),
    decision,
    checks: item.checks,
    openCount: liveOpenCount(decision, written, ctx.branchFacts?.(item.key)),
    comments: item.comments ?? [],
    hasAcceptFocus: written.some(block => block.kind === 'focus' && block.marker === 'sdd:focus:accept'),
  });
  if (live !== undefined) {
    blocks.push({kind: 'live', badge: live.badge, text: live.text});
  }
  blocks.push(...written);
  if (ctx.inPool) {
    const text = authorText(item.body);
    if (text !== undefined) {
      blocks.push({kind: 'description', text});
    }
  }
  const reading = ctx.review();
  blocks.push(...lineThreadBlocks(reading));
  blocks.push(...phaseThreadBlocks(reading));
  const hook = hookBlock(item.sddHooks);
  if (hook) {
    blocks.push(hook);
  }
  return blocks;
}
