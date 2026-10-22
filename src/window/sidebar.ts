import {phaseOf} from '../machine/phase.ts';

import {decisionCount, questionCount, reasonParts, slotOf} from './board.ts';
import {focusPlaque, isFocusComment} from './focus.ts';
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
    if (!comment || isFocusComment(comment.body)) {
      continue;
    }
    return comment.body;
  }
  return undefined;
}

const HOOK_UNREADABLE = 'поле хука не читается';

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
    leading: (key: string) => boolean;
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
  if (ctx.leading(item.key) || item.checks === 'pending') {
    return undefined;
  }
  const questions = questionCount(checkout.checkout, item.key);
  const decisions = decisionCount(checkout.checkout, item.key);
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
    manager: () => string | undefined;
    review: () => WindowReview | undefined;
    reading: () => readonly WindowTicket[];
    gathered: (item: WindowTicket) => string | undefined;
    serviceBroken: (checkout: string) => boolean;
    cardOf: (item: WindowTicket) => CardState;
    leading: (key: string) => boolean;
  },
): SidebarBlock[] {
  const blocks: SidebarBlock[] = [];
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
  const plaque = focusPlaque(item.comments);
  if (plaque !== undefined) {
    blocks.push({kind: 'focus', body: plaque});
  }
  const unanswered = unansweredBlock(ctx.review());
  if (unanswered) {
    blocks.push(unanswered);
  }
  const hook = hookBlock(item.sddHooks);
  if (hook) {
    blocks.push(hook);
  }
  return blocks;
}
