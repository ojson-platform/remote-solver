import type {Decision} from '../machine/decide/policy.ts';
import type {AgentAction} from '../machine/decide/route.ts';
import type {Phase} from '../machine/phase/phase.ts';

import {readReason, tasksGap} from '../machine/decide/reason.ts';

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
  const read = readReason(decision.reason);
  if (read.questions && questions > 0) {
    return countSentence(questions, 'вопрос', 'вопроса', 'вопросов', 'Ответь на него.', 'Ответь на них.');
  }
  if (read.decisions && decisions > 0) {
    return countSentence(decisions, 'решение', 'решения', 'решений', 'Закрой его.', 'Закрой их.');
  }
  if (read.anchoredMerge !== undefined) {
    return `Архив записан локально. Отправь его и смержи #${read.anchoredMerge}.`;
  }
  return undefined;
}

/** The missing-pull-request wait is the only page. */
export function exclusivePage(decision: Decision | undefined): boolean {
  return decision?.kind === 'wait' && readReason(decision.reason).kind === 'no-open-pull';
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
  if (decision.kind === 'merge') {
    return `Мержу #${decision.pull}.`;
  }
  if (decision.kind === 'advance') {
    return advanceSentence(decision.reason, decision.to);
  }
  if (decision.kind === 'wait') {
    return waitSentence(decision.reason, openCount);
  }
  if (decision.kind === 'done' && readReason(decision.reason).kind === 'cancelled') {
    return 'Задача отменена.';
  }
  return undefined;
}

function agentSentence(action: AgentAction, reason: string): string {
  const read = readReason(reason);
  switch (action) {
    case 'create-proposal':
      return read.kind === 'publish-proposal'
        ? 'Публикую план в пул-реквест.'
        : 'Пишу план и открываю пул-реквест.';
    case 'improve-proposal':
      return 'Правлю план по замечанию.';
    case 'create-initial-specs':
      return 'Пишу спеки.';
    case 'improve-specs':
      return read.kind === 'proposal-stamp'
        ? 'Обновляю спеки под новую ревизию плана.'
        : 'Правлю спеки по замечанию.';
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
      return read.kind === 'rebase' ? 'Перекладываю ветку на базу.' : 'Чиню код по замечанию.';
    case 'classify-failures':
      return 'Разбираю красные проверки.';
    case 'classify-comments':
      return 'Размечаю комментарии в пул-реквесте.';
    case 'archive':
      return 'Архивирую изменение.';
    case 'unarchive':
      return 'Возвращаю дельту из архива в изменение.';
    default:
      return action;
  }
}

function advanceSentence(reason: string, to: Phase): string | undefined {
  const read = readReason(reason);
  if (read.kind === 'sent-back') {
    return `Замечание вернуло задачу на ${LAYER_NAME[to] ?? to}.`;
  }
  if (read.kind === 'conflict') {
    return 'Пул-реквест конфликтует с базой. Возвращаю на Code.';
  }
  if (read.kind === 'missing-proposal') {
    return 'Нет плана. Возвращаю на Plan.';
  }
  if (read.kind === 'missing-delta') {
    return 'Нет спеки. Возвращаю на Specify.';
  }
  if (read.kind === 'missing-design') {
    return 'Нет дизайна. Возвращаю на Design.';
  }
  if (tasksGap(read)) {
    return 'Задачи не покрывают сценарий. Возвращаю на Tasks.';
  }
  if (read.kind === 'return-delta') {
    return 'Возвращаю дельту из архива в изменение.';
  }
  if (read.kind === 'enter-cycle') {
    return 'Фазы нет. Возвращаю на Plan.';
  }
  if (read.kind === 'not-archived') {
    return 'Изменение не в архиве.';
  }
  return undefined;
}

function waitSentence(reason: string, openCount: number): string | undefined {
  const read = readReason(reason);
  if (read.kind === 'no-open-pull') {
    return 'На этой фазе нет открытого пул-реквеста.';
  }
  if (read.kind === 'too-many') {
    return 'Слишком много механических переходов.';
  }
  if (read.kind === 'wrong-service') {
    return 'Опрос идёт не в том каталоге сервиса.';
  }
  if (read.kind === 'green-merge' && read.mergePull !== undefined) {
    return `Перед мержем #${read.mergePull} проверки ещё не зелёные.`;
  }
  if (read.kind === 'merge-wait' && read.mergePull !== undefined) {
    return `Архив записан локально. Отправь его и смержи #${read.mergePull}.`;
  }
  if (read.kind === 'checks-running') {
    return 'Проверки ещё идут.';
  }
  if (read.kind === 'children' && read.issues.length > 0) {
    return read.issues.length === 1
      ? `Жду, пока #${read.issues[0]} будет принята.`
      : `Жду, пока ${joinListed(read.issues)} будут приняты.`;
  }
  if (read.kind === 'blockers' && read.issues.length > 0) {
    return read.issues.length === 1
      ? `Жду блокер #${read.issues[0]}.`
      : `Жду блокеры ${joinListed(read.issues)}.`;
  }
  if (read.kind === 'several-pulls' && read.pullIds.length > 0) {
    return `Открыты ${joinListed(read.pullIds)}. Оставь один.`;
  }
  if (read.questions && openCount > 0) {
    return countSentence(openCount, 'вопрос', 'вопроса', 'вопросов', 'Ответь на него.', 'Ответь на них.');
  }
  if (read.decisions && openCount > 0) {
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
