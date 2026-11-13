import type {Decision} from '../machine/decide/policy.ts';
import type {Phase} from '../machine/phase/phase.ts';

import {NO_OPEN_PULL} from '../machine/decide/pulls.ts';

import {turnAction, type BoardTurn, type ColumnName, type PhaseRow} from './types.ts';

/** Up to four lines of the closed plaque. The window reads them; it does not write them. */
export function plaqueLines(input: {
  ask?: string;
  gaps?: string;
  unanswered?: string;
  station?: ColumnName;
  phaseRow?: PhaseRow;
  reason?: string;
  action?: string;
  phase?: string | null;
  running?: boolean;
  turn?: BoardTurn;
  decision?: Decision;
  /** The open step. It names the plaque outside a review gate. */
  activity?: {phase: string; action: string};
  /** The plaque's decision. A review-gate wait stays here while a worker runs. */
  plaqueDecision?: Decision;
  checks?: 'green' | 'red' | 'pending' | 'none';
  /** First open task id from `tasks.md`. */
  task?: string;
}): {lines: string[]} {
  return {lines: pick(input).slice(0, 4).map(plain)};
}

const BREAKS = [
  'конфиг сервиса не читается',
  'очереди нет в конфиге сервиса',
  'не назван сервис',
  'конфига сервиса нет',
  'каталога нет',
];

const LAYER: Partial<Record<Phase, string>> = {
  proposing: 'Plan',
  specifying: 'Specify',
  designing: 'Design',
  tasking: 'Tasks',
  implementing: 'Code',
  verifying: 'Verify',
  accepting: 'Accept',
};

const REFUSAL: Record<string, string> = {
  'create-proposal': 'Отказ плана',
  'improve-proposal': 'Отказ плана',
  'create-initial-specs': 'Отказ спек',
  'improve-specs': 'Отказ спек',
  'restore-baseline': 'Отказ базовой спеки',
  'create-design': 'Отказ дизайна',
  'improve-design': 'Отказ дизайна',
  'create-tasks': 'Отказ задач',
  'improve-tasks': 'Отказ задач',
  'implement-next-task': 'Отказ задачи',
  'fix-implementation': 'Отказ кода',
  'classify-failures': 'Отказ разбора',
  'classify-comments': 'Отказ разметки',
  unarchive: 'Отказ разархива',
};

type PlaqueInput = Parameters<typeof plaqueLines>[0];

function plain(line: string): string {
  return line.replace(/\.+$/, '').trim();
}

function ru(count: number, one: string, few: string, many: string): string {
  const teen = count % 100;
  const tail = count % 10;
  const word = teen >= 11 && teen <= 14 ? many : tail === 1 ? one : tail >= 2 && tail <= 4 ? few : many;
  return `${count} ${word}`;
}

function joinKeys(ids: readonly string[]): string {
  const named = ids.map(id => (id.startsWith('#') ? id : `#${id}`));
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

function breakLine(reason: string | undefined): string | undefined {
  if (!reason) {
    return undefined;
  }
  const first = reason.split(' · ')[0] ?? '';
  return BREAKS.find(item => first === item || first.startsWith(item));
}

function isCode(input: PlaqueInput): boolean {
  return input.station === 'implementing' || input.phase === 'implementing';
}

function archiveRefusal(reason: string): boolean {
  return (
    reason.startsWith('archive refused:') ||
    reason.startsWith('the rebuilt spec would have no requirement') ||
    reason.startsWith('refused archive:')
  );
}

function refusalLine(reason: string): string | undefined {
  if (reason.startsWith('refused archive:')) {
    return 'Архив отказал';
  }
  const action = /^refused ([a-z-]+):/.exec(reason)?.[1];
  if (!action) {
    return undefined;
  }
  return REFUSAL[action] ?? 'Повторный отказ';
}

function gateLine(from: string): string | undefined {
  if (from === 'proposing') {
    return 'Проверь план';
  }
  if (from === 'specifying') {
    return 'Проверь спеки';
  }
  if (from === 'designing') {
    return 'Проверь дизайн';
  }
  return undefined;
}

function firstAsk(body: string): string {
  const lines = body.split('\n');
  const head = lines[0]?.trim() ?? '';
  const start = head === 'sdd:wait-human' || head.endsWith('sdd:wait-human') ? 1 : 0;
  const text = lines.slice(start).join(' ').replace(/\s+/g, ' ').trim();
  if (text === '') {
    return '';
  }
  const cut = text.search(/[.!?](\s|$)/);
  return cut === -1 ? text : text.slice(0, cut).trim();
}

function back(to: string): string {
  return `Назад на ${LAYER[to as Phase] ?? to}`;
}

function advanceLines(reason: string, to: string): string[] | undefined {
  if (reason === 'review thread sent the change back') {
    return [back(to)];
  }
  if (reason === 'pull request conflicts with the base') {
    return ['Конфликт с базой', back(to)];
  }
  if (reason === 'proposal.md is missing') {
    return ['Нет плана', back(to)];
  }
  if (reason === 'delta spec is missing') {
    return ['Нет спеки', back(to)];
  }
  if (reason === 'design.md is missing') {
    return ['Нет дизайна', back(to)];
  }
  if (reason === 'tasks.md is missing') {
    return ['Нет задач', back(to)];
  }
  if (
    reason.startsWith('the delta revision is not the card') ||
    reason.startsWith('no card for ') ||
    reason.startsWith('no task for ')
  ) {
    return ['Задачи не покрывают сценарий', back(to)];
  }
  if (reason === 'return the delta to the change') {
    return ['Возвращаю дельту из архива'];
  }
  if (reason === 'enter the cycle') {
    return ['Фазы нет', 'Назад на Plan'];
  }
  if (reason === 'the change is not archived') {
    return ['Не в архиве'];
  }
  return undefined;
}

function pullIds(reason: string): string[] {
  return (reason.split(':')[1] ?? '')
    .split(',')
    .map(id => id.trim().replace(/^#/, ''))
    .filter(id => id !== '');
}

function leaveOne(reason: string): string {
  const ids = pullIds(reason);
  return ids.length > 0 ? `Оставь один: ${joinKeys(ids)}` : 'Оставь один';
}

function severalLine(input: PlaqueInput): string | undefined {
  const reason = input.decision?.kind === 'wait' ? input.decision.reason : '';
  if (reason.startsWith('cycle stopped until one open PR remains')) {
    return leaveOne(reason);
  }
  if (input.reason?.includes('несколько pull request')) {
    return 'Оставь один';
  }
  return undefined;
}

function codeLines(input: PlaqueInput, extra?: string): string[] {
  const lines: string[] = [];
  const row = input.phaseRow;
  if (row && typeof row === 'object' && 'done' in row) {
    lines.push(`Done ${row.done}/${row.done + row.open}`);
  }
  if (input.task) {
    lines.push(input.task);
  }
  if (extra) {
    lines.push(extra);
  }
  return lines;
}

function reviewGate(decision: Decision | undefined): boolean {
  return decision?.kind === 'wait' && decision.gate !== undefined;
}

function actionOf(input: PlaqueInput): {action: string; reason: string} | undefined {
  const plaque = input.plaqueDecision ?? input.decision;
  if (reviewGate(plaque)) {
    return undefined;
  }
  if (input.activity) {
    return {action: input.activity.action, reason: ''};
  }
  if (plaque?.kind === 'agent') {
    return {action: plaque.action, reason: plaque.reason};
  }
  if (input.decision !== undefined) {
    return undefined;
  }
  const action = turnAction(input.turn) ?? input.action;
  return action ? {action, reason: ''} : undefined;
}

function actionLines(action: string, reason: string, input: PlaqueInput): string[] | undefined {
  switch (action) {
    case 'create-proposal':
      return [reason.startsWith('publish proposal') ? 'Публикую план' : 'Пишу план'];
    case 'improve-proposal':
      return ['Правлю план по замечанию'];
    case 'create-initial-specs':
      return [reason === 'the proposal revision is not the stamp' ? 'Обновляю спеки под план' : 'Пишу спеки'];
    case 'improve-specs':
      return ['Правлю спеки по замечанию'];
    case 'restore-baseline':
      return ['Восстанавливаю базовую спеку'];
    case 'create-design':
      return ['Пишу дизайн'];
    case 'improve-design':
      return ['Правлю дизайн по замечанию'];
    case 'create-tasks':
      return ['Пишу задачи'];
    case 'improve-tasks':
      return ['Правлю задачи по замечанию'];
    case 'implement-next-task': {
      const lines = codeLines(input, severalLine(input));
      return lines.length > 0 ? lines : undefined;
    }
    case 'fix-implementation':
      return [reason === 'rebase onto the base' ? 'Перекладываю ветку на базу' : 'Чиню код по замечанию'];
    case 'classify-failures':
      return ['Разбираю красные проверки'];
    case 'classify-comments':
      return ['Размечаю комментарии'];
    case 'archive':
      return ['Архивирую'];
    case 'unarchive':
      return ['Возвращаю дельту из архива'];
    default:
      return undefined;
  }
}

function countLine(count: number, station: string | undefined, phase: string | null | undefined): string | undefined {
  if (count <= 0) {
    return undefined;
  }
  if (station === 'proposing' || phase === 'proposing') {
    return `Ответь: ${ru(count, 'вопрос', 'вопроса', 'вопросов')}`;
  }
  if (station === 'designing' || phase === 'designing') {
    return `Закрой: ${ru(count, 'решение', 'решения', 'решений')}`;
  }
  return undefined;
}

function waitLines(reason: string, input: PlaqueInput): string[] | undefined {
  if (reason === NO_OPEN_PULL) {
    if (isCode(input)) {
      const lines = codeLines(input);
      if (lines.length > 0) {
        return [...lines, 'Нет открытого пул-реквеста'];
      }
    }
    return ['Нет открытого пул-реквеста'];
  }
  if (reason.startsWith('cycle stopped until one open PR remains')) {
    const line = leaveOne(reason);
    if (isCode(input)) {
      const lines = codeLines(input, line);
      return lines.length > 0 ? lines : [line];
    }
    return [line];
  }
  if (reason === 'Too many mechanical transitions') {
    return ['Слишком много механических переходов'];
  }
  if (reason.startsWith('service is ')) {
    return ['Опрос идёт не в том каталоге сервиса'];
  }
  const mergeId = reason.match(/#(\d+)/)?.[1];
  if (reason.startsWith('wait for green checks before merge of PR #') && mergeId) {
    return [`#${mergeId} не зелёные`];
  }
  if (reason.startsWith('wait for merge of PR #') && mergeId) {
    return [`Смержи #${mergeId}`];
  }
  if (reason.startsWith('checks are ') && reason !== 'checks are red' && reason !== 'checks are green') {
    return ['Проверки ещё идут'];
  }
  if (reason.startsWith('wait for children')) {
    const keys = keysIn(reason);
    return keys.length > 0 ? [`Жду принятия ${joinKeys(keys)}`] : undefined;
  }
  if (reason.startsWith('wait for blockers')) {
    const keys = keysIn(reason);
    if (keys.length === 1) {
      return [`Жду блокер #${keys[0]}`];
    }
    return keys.length > 1 ? [`Жду блокеры ${joinKeys(keys)}`] : undefined;
  }
  if (reason.startsWith('sdd:wait-human is set')) {
    return ['Метка ожидания стоит'];
  }
  if (reason.startsWith('no task for ')) {
    return ['Сценарий без задачи'];
  }
  if (reason === 'the change is not archived') {
    return ['Не в архиве'];
  }
  if (reason === 'accepted needs a merged pull request') {
    return ['Нет смерженного пул-реквеста'];
  }
  if (reason.includes('Open questions') || reason.includes('open decision')) {
    const count = typeof input.phaseRow === 'number' ? input.phaseRow : 0;
    const line = countLine(count, input.station, input.phase);
    return line ? [line] : undefined;
  }
  return undefined;
}

function notSpecified(input: PlaqueInput): string | undefined {
  const row = input.phaseRow;
  if (!row || typeof row !== 'object' || !('waits' in row) || row.waits.length === 0) {
    return undefined;
  }
  return `Жду ${joinKeys(row.waits)}`;
}

function checkLines(input: PlaqueInput): string[] | undefined {
  const color =
    input.checks === 'red' || input.checks === 'green' || input.checks === 'pending'
      ? input.checks
      : input.phaseRow === 'red' || input.phaseRow === 'green' || input.phaseRow === 'pending'
        ? input.phaseRow
        : undefined;
  if (color === 'red') {
    return ['Красные без разбора'];
  }
  if (color === 'pending') {
    return ['Проверки ещё идут'];
  }
  if (color === 'green') {
    return ['Проверки зелёные'];
  }
  return undefined;
}

function pick(input: PlaqueInput): string[] {
  const broken = breakLine(input.reason);
  if (broken) {
    return [broken];
  }
  const decision = input.decision;
  const reason = decision?.reason ?? '';
  if (archiveRefusal(reason)) {
    return ['Архив отказал'];
  }
  if (reason.startsWith('refused ')) {
    const line = refusalLine(reason);
    if (line) {
      return [line];
    }
  }
  if (decision?.kind === 'wait' && decision.gate) {
    const gate = gateLine(decision.gate.from);
    if (gate) {
      return [gate];
    }
  }
  if (input.ask) {
    const sentence = firstAsk(input.ask);
    if (sentence !== '') {
      return [sentence];
    }
  }
  if (decision?.kind === 'archive') {
    return ['Архивирую'];
  }
  if (decision?.kind === 'unarchive') {
    return ['Возвращаю дельту из архива'];
  }
  if (decision?.kind === 'merge') {
    return [`Смержи #${decision.pull}`];
  }
  const acting = actionOf(input);
  if (acting) {
    const worked = actionLines(acting.action, acting.reason, input);
    if (worked && worked.length > 0) {
      return worked;
    }
  }
  if (decision?.kind === 'advance') {
    const moved = advanceLines(decision.reason, decision.to);
    if (moved) {
      return moved;
    }
  }
  if (decision?.kind === 'wait') {
    const waited = waitLines(reason, input);
    if (waited) {
      return waited;
    }
  }
  const child = notSpecified(input);
  if (child) {
    return [child];
  }
  if (typeof input.phaseRow === 'number') {
    const line = countLine(input.phaseRow, input.station, input.phase);
    if (line) {
      return [line];
    }
  }
  const tasks = input.phaseRow;
  if (tasks && typeof tasks === 'object' && 'done' in tasks) {
    const idle = codeLines(input, isCode(input) ? severalLine(input) : undefined);
    if (idle.length > 0) {
      return idle;
    }
  }
  const checks = checkLines(input);
  if (checks) {
    return checks;
  }
  return [];
}
