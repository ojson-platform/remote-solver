import type {Decision} from '../machine/decide/policy.ts';
import type {AgentAction} from '../machine/decide/route.ts';
import type {Phase} from '../machine/phase/phase.ts';

import {NO_OPEN_PULL} from '../machine/decide/pulls.ts';

const CONFIRM_PHASES = new Set(['proposing', 'specifying', 'designing']);

export const CONFIRM_TAIL = 'Проверь и подтверди.';

/** A tail the phase paints on the open written page. It is not stored in the comment. */
export function focusTail(
  decision: Decision | undefined,
  questions: number,
  decisions: number,
): string | undefined {
  if (decision?.kind !== 'wait') {
    return undefined;
  }
  if (decision.gate && CONFIRM_PHASES.has(decision.gate.from)) {
    return CONFIRM_TAIL;
  }
  if (decision.reason.includes('Open questions') && questions > 0) {
    return countSentence(questions, 'вопрос', 'вопроса', 'вопросов', 'Ответь на него.', 'Ответь на них.');
  }
  if (decision.reason.includes('open decision') && decisions > 0) {
    return countSentence(decisions, 'решение', 'решения', 'решений', 'Закрой его.', 'Закрой их.');
  }
  const mergeId = decision.reason.match(/^wait for merge of PR #(\d+)/)?.[1];
  if (mergeId !== undefined) {
    return `Архив записан локально. Отправь его и смержи #${mergeId}.`;
  }
  return undefined;
}

/** The missing-pull-request wait is the only page. */
export function exclusivePage(decision: Decision | undefined): boolean {
  return decision?.kind === 'wait' && decision.reason === NO_OPEN_PULL;
}

/** The tail is painted only when the open page is already the written focus. */
export function paintedTail(
  blocks: readonly {kind: string}[],
  decision: Decision | undefined,
  questions: number,
  decisions: number,
): string | undefined {
  const first = blocks.find(block => block.kind === 'live' || block.kind === 'focus');
  if (first?.kind !== 'focus') {
    return undefined;
  }
  return focusTail(decision, questions, decisions);
}

const LAYER_NAME: Partial<Record<Phase, string>> = {
  proposing: 'Plan',
  specifying: 'Specify',
  designing: 'Design',
  tasking: 'Tasks',
  implementing: 'Code',
};

/** The catalog sentence for the action a worker is already doing. */
export function workingSentence(action: string, reason = ''): string {
  return agentSentence(action as AgentAction, reason);
}

/** The open-page sentence for one decision. A forward move has none. */
export function pageSentence(decision: Decision, openCount = 0): string | undefined {
  if (decision.kind === 'agent') {
    return agentSentence(decision.action, decision.reason);
  }
  if (decision.kind === 'archive') {
    return 'Архивирую изменение.';
  }
  if (decision.kind === 'unarchive') {
    return 'Возвращаю дельту из архива в изменение.';
  }
  if (decision.kind === 'merge') {
    return `Мержу #${decision.pull}.`;
  }
  if (decision.kind === 'advance') {
    return advanceSentence(decision.reason, decision.to);
  }
  if (decision.kind === 'wait') {
    return waitSentence(decision.reason, openCount);
  }
  if (decision.kind === 'done' && decision.reason === 'cancelled') {
    return 'Задача отменена.';
  }
  return undefined;
}

function agentSentence(action: AgentAction, reason: string): string {
  switch (action) {
    case 'create-proposal':
      return reason.startsWith('publish proposal')
        ? 'Публикую план в пул-реквест.'
        : 'Пишу план и открываю пул-реквест.';
    case 'improve-proposal':
      return 'Правлю план по замечанию.';
    case 'create-initial-specs':
      return reason === 'the proposal revision is not the stamp'
        ? 'Обновляю спеки под новую ревизию плана.'
        : 'Пишу спеки.';
    case 'improve-specs':
      return 'Правлю спеки по замечанию.';
    case 'restore-baseline':
      return 'Восстанавливаю базовую спеку.';
    case 'create-design':
      return 'Пишу дизайн.';
    case 'improve-design':
      return 'Правлю дизайн по замечанию.';
    case 'create-tasks':
      return 'Пишу задачи.';
    case 'improve-tasks':
      return 'Правлю задачи по замечанию.';
    case 'implement-next-task':
      return 'Делаю следующую задачу.';
    case 'fix-implementation':
      return reason === 'rebase onto the base'
        ? 'Перекладываю ветку на базу.'
        : 'Чиню код по замечанию.';
    case 'classify-failures':
      return 'Разбираю красные проверки.';
    case 'classify-comments':
      return 'Размечаю комментарии в пул-реквесте.';
    default:
      return action;
  }
}

function advanceSentence(reason: string, to: Phase): string | undefined {
  if (reason === 'review thread sent the change back') {
    return `Замечание вернуло задачу на ${LAYER_NAME[to] ?? to}.`;
  }
  if (reason === 'pull request conflicts with the base') {
    return 'Пул-реквест конфликтует с базой. Возвращаю на Code.';
  }
  if (reason === 'proposal.md is missing') {
    return 'Нет плана. Возвращаю на Plan.';
  }
  if (reason === 'delta spec is missing') {
    return 'Нет спеки. Возвращаю на Specify.';
  }
  if (reason === 'design.md is missing') {
    return 'Нет дизайна. Возвращаю на Design.';
  }
  if (
    reason === 'tasks.md is missing' ||
    reason.startsWith('the delta revision is not the card') ||
    reason.startsWith('no card for ') ||
    reason.startsWith('no task for ')
  ) {
    return 'Задачи не покрывают сценарий. Возвращаю на Tasks.';
  }
  if (reason === 'return the delta to the change') {
    return 'Возвращаю дельту из архива в изменение.';
  }
  if (reason === 'enter the cycle') {
    return 'Фазы нет. Возвращаю на Plan.';
  }
  if (reason === 'the change is not archived') {
    return 'Изменение не в архиве.';
  }
  return undefined;
}

function waitSentence(reason: string, openCount: number): string | undefined {
  if (reason === NO_OPEN_PULL) {
    return 'На этой фазе нет открытого пул-реквеста.';
  }
  if (reason === 'Too many mechanical transitions') {
    return 'Слишком много механических переходов.';
  }
  if (reason.startsWith('service is ')) {
    return 'Опрос идёт не в том каталоге сервиса.';
  }
  const mergeId = reason.match(/merge of PR #(\d+)/)?.[1];
  if (reason.startsWith('wait for green checks before merge of PR #') && mergeId) {
    return `Перед мержем #${mergeId} проверки ещё не зелёные.`;
  }
  if (reason.startsWith('wait for merge of PR #') && mergeId) {
    return `Архив записан локально. Отправь его и смержи #${mergeId}.`;
  }
  if (reason.startsWith('checks are ') && reason !== 'checks are red' && reason !== 'checks are green') {
    return 'Проверки ещё идут.';
  }
  const keys = keysIn(reason);
  if (reason.startsWith('wait for children') && keys.length > 0) {
    return keys.length === 1
      ? `Жду, пока #${keys[0]} будет принята.`
      : `Жду, пока ${joinListed(keys)} будут приняты.`;
  }
  if (reason.startsWith('wait for blockers') && keys.length > 0) {
    return keys.length === 1
      ? `Жду блокер #${keys[0]}.`
      : `Жду блокеры ${joinListed(keys)}.`;
  }
  if (reason.startsWith('cycle stopped until one open PR remains')) {
    const ids = (reason.split(':')[1] ?? '')
      .split(',')
      .map(id => id.trim().replace(/^#/, ''))
      .filter(id => id !== '');
    if (ids.length > 0) {
      return `Открыты ${joinListed(ids)}. Оставь один.`;
    }
  }
  if (reason.includes('Open questions') && openCount > 0) {
    return countSentence(openCount, 'вопрос', 'вопроса', 'вопросов', 'Ответь на него.', 'Ответь на них.');
  }
  if (reason.includes('open decision') && openCount > 0) {
    return countSentence(openCount, 'решение', 'решения', 'решений', 'Закрой его.', 'Закрой их.');
  }
  return undefined;
}

function joinListed(ids: readonly string[]): string {
  const named = ids.map(id => `#${id}`);
  if (named.length <= 2) {
    return named.join(' и ');
  }
  return `${named.slice(0, -1).join(', ')} и ${named.at(-1)}`;
}

function keysIn(reason: string): string[] {
  const keys: string[] = [];
  for (const match of reason.matchAll(/#(\d+)/g)) {
    const key = match[1];
    if (key !== undefined && !keys.includes(key)) {
      keys.push(key);
    }
  }
  return keys;
}

function countSentence(
  count: number,
  one: string,
  few: string,
  many: string,
  oneCall: string,
  manyCall: string,
): string {
  const teen = count % 100;
  const tail = count % 10;
  const word = teen >= 11 && teen <= 14 ? many : tail === 1 ? one : tail >= 2 && tail <= 4 ? few : many;
  if (word === one) {
    const adjective = word === 'вопрос' ? 'открытый' : 'открытое';
    return `Есть ${count} ${adjective} ${word}. ${oneCall}`;
  }
  return `Есть ${count} открытых ${word}. ${manyCall}`;
}
