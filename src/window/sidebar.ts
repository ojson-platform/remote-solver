import {isFocusRecord, parseMarker} from '../machine/marker.ts';
import {phaseOf} from '../machine/phase.ts';

import {decisionCount, questionCount, reasonParts, slotOf} from './board.ts';
import {focusBlockProse, focusSidebar} from './focus.ts';
import {
  isDoc,
  type CardState,
  type SidebarBlock,
  type SidebarHookPoint,
  type WindowComment,
  type WindowReview,
  type WindowTicket,
} from './types.ts';

/** Latest issue comment whose first line is not `sdd:focus`. */
function askBody(comments: readonly WindowComment[] | undefined): string | undefined {
  const list = comments ?? [];
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const comment = list[index];
    if (!comment || isFocusRecord(comment.body)) {
      continue;
    }
    return comment.body;
  }
  return undefined;
}

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

function hookParagraph(value: unknown): string {
  return typeof value === 'string' ? value : HOOK_UNREADABLE;
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
    return {
      kind: 'hook',
      points: value.map(item => ({
        action: item.action,
        point: item.point,
        paragraph: hookParagraph(item.value),
      })),
    };
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
      if (typeof pointValue === 'string' && pointValue.trim() === '') {
        continue;
      }
      points.push({action, point, paragraph: hookParagraph(pointValue)});
    }
  }
  if (points.length === 0) {
    return undefined;
  }
  return {kind: 'hook', points};
}

function hasMarker(marker: string | null | undefined): boolean {
  return typeof marker === 'string' && marker !== '';
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

function unansweredBlock(reading: WindowReview | undefined): SidebarBlock | undefined {
  if (!reading) {
    return undefined;
  }
  const threads = (reading.threads ?? [])
    .filter(thread => !hasMarker(thread.marker))
    .map(thread => ({lines: thread.lines}));
  const last = reading.conversation?.last;
  const comment = last && !hasMarker(last.marker) ? last.body : undefined;
  if (threads.length === 0 && comment === undefined) {
    return undefined;
  }
  if (threads.length > 0 && comment !== undefined) {
    return {kind: 'unanswered', threads, comment};
  }
  if (threads.length > 0) {
    return {kind: 'unanswered', threads};
  }
  return {kind: 'unanswered', comment};
}

function reasonLine(
  item: WindowTicket,
  ctx: {
    manager: () => string | undefined;
    reading: () => readonly WindowTicket[];
    gathered: (item: WindowTicket) => string | undefined;
    serviceBroken: (checkout: string) => boolean;
    cardOf: (item: WindowTicket) => CardState;
    branchFacts?: (key: string) => {questions: number; decisions: number} | undefined;
  },
): string | undefined {
  const phase = phaseOf([...item.labels]);
  const where = slotOf(item, phase, ctx.manager());
  if (where === 'hide' || where === 'cards') {
    return undefined;
  }
  const located = ctx.gathered(item);
  if (located && ctx.serviceBroken(located)) {
    return undefined;
  }
  const checkout = ctx.cardOf(item);
  const several = (item.openPullRequests ?? 0) > 1;
  const broken = checkout.reason !== '';
  if (where === 'pool' && !broken && !several) {
    return undefined;
  }
  const known = ctx.branchFacts?.(item.key);
  const questions = known ? known.questions : questionCount(checkout.checkout, item.key);
  const decisions = known ? known.decisions : decisionCount(checkout.checkout, item.key);
  const parts = reasonParts(
    item,
    phase ?? 'implementing',
    checkout.reason,
    ctx.reading(),
    questions,
    decisions,
  );
  if (parts.length === 0) {
    return undefined;
  }
  return parts.join(' · ');
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
  },
): SidebarBlock[] {
  const blocks: SidebarBlock[] = [];
  if (ctx.inPool) {
    const text = authorText(item.body);
    if (text !== undefined) {
      blocks.push({kind: 'description', text});
    }
  }
  const line = reasonLine(item, ctx);
  if (line !== undefined) {
    blocks.push({kind: 'reason', line});
  }
  if (item.labels.includes('sdd:wait-human')) {
    const body = askBody(item.comments);
    if (body !== undefined) {
      blocks.push({kind: 'ask', body});
    }
  }
  const focus = focusSidebar(item.comments);
  if (focus !== undefined) {
    blocks.push({
      kind: 'focus',
      marker: focus.marker,
      body: focus.body,
      display: focusBlockProse(focus.marker, focus.body),
    });
  }
  const reading = ctx.review();
  blocks.push(...lineThreadBlocks(reading));
  blocks.push(...phaseThreadBlocks(reading));
  const unanswered = unansweredBlock(reading);
  if (unanswered) {
    blocks.push(unanswered);
  }
  const hook = hookBlock(item.sddHooks);
  if (hook) {
    blocks.push(hook);
  }
  return blocks;
}
