# Tracker, Arcanum, and arc Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Подключить цикл к Трекеру, Аркануму и arc тремя адаптерами за текущими портами, не меняя машину, скиллы и рантайм.

**Architecture:** Чистая таблица воркфлоу AI SDLC переводит фазу в статус и обратно. Адаптер Трекера читает теги и пишет переходы. Адаптер Арканума находит ревью по полю задач. Адаптер arc публикует ветку `sdd/<ключ>`. `compose` выбирает эту тройку, когда `host` равен `arcadia`; иначе остаётся GitHub и git.

**Tech Stack:** TypeScript, vitest, порты из `src/machine/port.ts`, Tracker API `POST /v3/issues/{key}/transitions/{id}/_execute`, Arcanum `GET /v1/pull-requests/{id}?fields=issues`.

## Global Constraints

- Машина, скиллы, политика и рантайм не меняются. Граф воркфлоу не меняется.
- Тип тикета цикла — `typicalTask`. Воркфлоу — AI SDLC, `W69886`.
- Ключ цикла — ключ тикета. Ветка — `sdd/<ключ>`. Ревью принадлежит тикету, когда поле `issues` ревью содержит этот ключ.
- Метки `sdd:cycle` и метка очереди дописываются при чтении и не пишутся обратно.
- Теги `sdd:auto-plan`, `sdd:auto-spec`, `sdd:auto-design`, `sdd:auto-merge`, `sdd:auto-review`, `sdd:wait-human` проходят как есть. Переход по тегу не выбирается.
- `merge()` возвращается только когда ревью уже `MERGED`. Флаг `on_satisfied_requirements` не включается и не снимается.
- Ошибка адаптера — исключение, не `sdd:wait-human`.
- Коммиты — одна фраза, как в истории `remote-solver`, без префикса `feat:`.
- Проверка задачи: `pnpm test -- <файл>` из `devops/remote-solver`.

---

### Task 1: Таблица воркфлоу

**Files:**
- Create: `src/adapters/tracker-workflow.ts`
- Test: `src/adapters/tracker-workflow.test.ts`

**Interfaces:**
- Consumes: ничего
- Produces:
  - `phaseOfStatus(status: string): Phase | null`
  - `statusOfPhase(phase: Phase): string`
  - `statusPath(from: string, to: string): string[]` — статусы от `from` до `to` включительно; нет пути — бросает `Error`
  - `phaseHint(from: Phase, to: Phase): string`

- [ ] **Step 1: Write the failing test**

Создать `src/adapters/tracker-workflow.test.ts`:

```ts
import assert from 'node:assert/strict';
import {test} from 'vitest';

import {phaseHint, phaseOfStatus, statusOfPhase, statusPath} from './tracker-workflow.ts';

test('a workflow status is one phase label', () => {
  assert.equal(phaseOfStatus('open'), null);
  assert.equal(phaseOfStatus('closed'), null);
  assert.equal(phaseOfStatus('proposal'), 'proposing');
  assert.equal(phaseOfStatus('solutionProposed'), 'proposed');
  assert.equal(phaseOfStatus('requirementsGathering'), 'specifying');
  assert.equal(phaseOfStatus('specification'), 'specified');
  assert.equal(phaseOfStatus('design'), 'designing');
  assert.equal(phaseOfStatus('theDesignIsConsistent'), 'designed');
  assert.equal(phaseOfStatus('decomposition'), 'tasking');
  assert.equal(phaseOfStatus('development'), 'implementing');
  assert.equal(phaseOfStatus('check'), 'verifying');
  assert.equal(phaseOfStatus('needAcceptance'), 'accepting');
  assert.equal(phaseOfStatus('confirmed'), 'accepted');
  assert.equal(phaseOfStatus('cancelled'), 'cancelled');
  assert.throws(() => phaseOfStatus('inProgress'), /unknown status inProgress/);
});

test('the robot walks the gate in two statuses when the machine skips it', () => {
  assert.deepEqual(statusPath('proposal', 'requirementsGathering'), [
    'proposal',
    'solutionProposed',
    'requirementsGathering',
  ]);
  assert.deepEqual(statusPath('requirementsGathering', 'design'), [
    'requirementsGathering',
    'specification',
    'design',
  ]);
  assert.deepEqual(statusPath('design', 'decomposition'), [
    'design',
    'theDesignIsConsistent',
    'decomposition',
  ]);
  assert.deepEqual(statusPath('solutionProposed', 'requirementsGathering'), [
    'solutionProposed',
    'requirementsGathering',
  ]);
  assert.deepEqual(statusPath('needAcceptance', 'confirmed'), ['needAcceptance', 'confirmed']);
  assert.deepEqual(statusPath('confirmed', 'closed'), ['confirmed', 'closed']);
  assert.deepEqual(statusPath('open', 'proposal'), ['open', 'proposal']);
  assert.deepEqual(statusPath('specification', 'design'), ['specification', 'design']);
  assert.deepEqual(statusPath('theDesignIsConsistent', 'decomposition'), [
    'theDesignIsConsistent',
    'decomposition',
  ]);
  assert.deepEqual(statusPath('decomposition', 'development'), ['decomposition', 'development']);
  assert.deepEqual(statusPath('development', 'check'), ['development', 'check']);
  assert.deepEqual(statusPath('check', 'needAcceptance'), ['check', 'needAcceptance']);
});

test('a rollback follows edges the workflow already has', () => {
  assert.deepEqual(statusPath('check', 'decomposition'), ['check', 'development', 'decomposition']);
  assert.deepEqual(statusPath('specification', 'proposal'), [
    'specification',
    'requirementsGathering',
    'proposal',
  ]);
  assert.throws(() => statusPath('confirmed', 'proposal'), /no path from confirmed to proposal/);
});

test('phaseHint names the button a person presses', () => {
  assert.equal(phaseHint('proposing', 'proposed'), 'Предложить');
  assert.equal(phaseHint('specifying', 'specified'), 'Согласовать');
  assert.equal(phaseHint('designing', 'designed'), 'Согласовать');
  assert.equal(statusOfPhase('proposing'), 'proposal');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/adapters/tracker-workflow.test.ts`

Expected: FAIL, `tracker-workflow.ts` не найден.

- [ ] **Step 3: Write minimal implementation**

Создать `src/adapters/tracker-workflow.ts`. Рёбра — цели переходов из `W69886`, по одной дуге на целевой статус.

```ts
import type {Phase} from '../machine/phase.ts';

const PHASE_STATUS: Record<Phase, string> = {
  proposing: 'proposal',
  proposed: 'solutionProposed',
  specifying: 'requirementsGathering',
  specified: 'specification',
  designing: 'design',
  designed: 'theDesignIsConsistent',
  tasking: 'decomposition',
  implementing: 'development',
  verifying: 'check',
  accepting: 'needAcceptance',
  accepted: 'confirmed',
  cancelled: 'cancelled',
};

const EDGES: Record<string, readonly string[]> = {
  open: ['closed', 'proposal', 'cancelled'],
  closed: ['open'],
  proposal: ['solutionProposed', 'cancelled'],
  solutionProposed: ['requirementsGathering', 'proposal', 'cancelled'],
  requirementsGathering: ['proposal', 'specification', 'cancelled'],
  specification: ['design', 'requirementsGathering', 'cancelled'],
  design: ['theDesignIsConsistent', 'requirementsGathering', 'proposal', 'cancelled'],
  theDesignIsConsistent: ['decomposition', 'design', 'cancelled'],
  decomposition: ['development', 'proposal', 'requirementsGathering', 'design', 'cancelled'],
  development: ['check', 'proposal', 'requirementsGathering', 'design', 'decomposition', 'cancelled'],
  check: ['needAcceptance', 'development', 'design', 'requirementsGathering', 'proposal', 'cancelled'],
  needAcceptance: ['confirmed', 'development', 'design', 'requirementsGathering', 'proposal', 'cancelled'],
  confirmed: ['closed'],
  cancelled: ['open'],
};

const HINTS: Partial<Record<Phase, Partial<Record<Phase, string>>>> = {
  proposing: {proposed: 'Предложить'},
  specifying: {specified: 'Согласовать'},
  designing: {designed: 'Согласовать'},
};

export function phaseOfStatus(status: string): Phase | null {
  if (status === 'open' || status === 'closed') {
    return null;
  }
  const found = (Object.entries(PHASE_STATUS) as [Phase, string][]).find(([, value]) => value === status);
  if (!found) {
    throw new Error(`unknown status ${status}`);
  }
  return found[0];
}

export function statusOfPhase(phase: Phase): string {
  return PHASE_STATUS[phase];
}

export function statusPath(from: string, to: string): string[] {
  const queue: string[][] = [[from]];
  const seen = new Set<string>([from]);
  while (queue.length > 0) {
    const path = queue.shift()!;
    const tip = path[path.length - 1];
    if (tip === to) {
      return path;
    }
    for (const next of EDGES[tip] ?? []) {
      if (seen.has(next)) {
        continue;
      }
      seen.add(next);
      queue.push([...path, next]);
    }
  }
  throw new Error(`no path from ${from} to ${to}`);
}

export function phaseHint(from: Phase, to: Phase): string {
  return HINTS[from]?.[to] ?? statusOfPhase(to);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/adapters/tracker-workflow.test.ts`

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/tracker-workflow.ts src/adapters/tracker-workflow.test.ts
git commit -m "$(cat <<'EOF'
Translate an AI SDLC status into a phase and back along existing edges.

EOF
)"
```

---

### Task 2: Адаптер Трекера

**Files:**
- Create: `src/adapters/tracker.ts`
- Test: `src/adapters/tracker.test.ts`

**Interfaces:**
- Consumes: `phaseOfStatus`, `statusOfPhase`, `statusPath`, `phaseHint` из Task 1. `Tracker` и `IssueRecord` из `src/machine/port.ts`.
- Produces: `trackerAdapter(client, options): Tracker` и тип `TrackerClient`.

`TrackerClient`:

```ts
export type TrackerIssue = {
  key: string;
  summary: string;
  description: string;
  statusKey: string;
  typeKey: string;
  tags: string[];
};

export type TrackerLink = {type: string; direction: 'inward' | 'outward'; key: string};

export type TrackerClient = {
  myself(): string;
  search(queue: string, typeKey: string): TrackerIssue[];
  get(key: string): TrackerIssue;
  setTags(key: string, tags: string[]): void;
  comment(key: string, text: string): void;
  setDescription(key: string, description: string): void;
  transitions(key: string): {id: string; target: string}[];
  execute(key: string, transitionId: string): void;
  links(key: string): {parent?: string; links: TrackerLink[]};
};
```

Реальный клиент ходит в `https://st-api.yandex-team.ru/v3`. Поиск: `POST /v3/issues/_search` с телом `{query: 'Queue: <queue> Type: typicalTask Resolution: unresolved()'}` не нужен, если `search` уже отфильтрован вызывающим. Переход: `GET /v3/issues/{key}/transitions`, затем `POST /v3/issues/{key}/transitions/{id}/_execute`. Связи: поле `parent.key` и `GET /v3/issues/{key}/links`.

- [ ] **Step 1: Write the failing test**

`src/adapters/tracker.test.ts` держит фейковый `TrackerClient` в памяти. Три теста:

```ts
import assert from 'node:assert/strict';
import {test} from 'vitest';

import {trackerAdapter, type TrackerClient, type TrackerIssue} from './tracker.ts';

function issue(over: Partial<TrackerIssue> = {}): TrackerIssue {
  return {
    key: 'LAVKAOPSCORE-1',
    summary: 'span end',
    description: '',
    statusKey: 'proposal',
    typeKey: 'typicalTask',
    tags: ['sdd:auto-spec'],
    ...over,
  };
}

function client(initial: TrackerIssue): TrackerClient & {executed: string[]} {
  const executed: string[] = [];
  let current = initial;
  return {
    executed,
    myself: () => 'robot',
    search: () => [current],
    get: () => current,
    setTags: (_key, tags) => {
      current = {...current, tags};
    },
    comment: () => undefined,
    setDescription: () => undefined,
    transitions: () =>
      [
        {id: 'propose', target: 'solutionProposed'},
        {id: 'approved', target: 'requirementsGathering'},
      ],
    execute: (_key, id) => {
      executed.push(id);
      const target = id === 'propose' ? 'solutionProposed' : 'requirementsGathering';
      current = {...current, statusKey: target};
    },
    links: () => ({parent: 'LAVKAOPSCORE-9', links: [{type: 'depends on', direction: 'outward', key: 'LAVKAOPSCORE-3'}]}),
  };
}

test('a read adds the cycle label and the queue label and does not write them', () => {
  const port = client(issue());
  const tracker = trackerAdapter(port, {queue: 'LAVKAOPSCORE', queueLabel: 'Sandcastle'});
  assert.deepEqual(tracker.labels('LAVKAOPSCORE-1').sort(), [
    'Sandcastle',
    'sdd:auto-spec',
    'sdd:cycle',
    'sdd:proposing',
  ]);
  tracker.editLabels('LAVKAOPSCORE-1', ['sdd:cycle', 'Sandcastle'], []);
  assert.deepEqual(port.executed, []);
  assert.deepEqual(port.get('LAVKAOPSCORE-1').tags, ['sdd:auto-spec']);
});

test('skipping a gate executes both transitions and stops on the gate when the second fails', () => {
  const port = client(issue());
  port.execute = (key, id) => {
    port.executed.push(id);
    if (id === 'approved') {
      throw new Error('screen');
    }
    port.get = () => issue({statusKey: 'solutionProposed'});
  };
  const tracker = trackerAdapter(port, {queue: 'LAVKAOPSCORE', queueLabel: 'Sandcastle'});
  assert.throws(() => tracker.editLabels('LAVKAOPSCORE-1', ['sdd:specifying'], ['sdd:proposing']), /screen/);
  assert.deepEqual(port.executed, ['propose', 'approved']);
  assert.equal(tracker.labels('LAVKAOPSCORE-1').includes('sdd:proposed'), true);
});

test('parent and depends come from tracker links', () => {
  const tracker = trackerAdapter(client(issue()), {queue: 'LAVKAOPSCORE', queueLabel: 'Sandcastle'});
  const record = tracker.issue('LAVKAOPSCORE-1');
  assert.equal(record.parent, 'LAVKAOPSCORE-9');
  assert.deepEqual(record.dependsOn, ['LAVKAOPSCORE-3']);
});
```

Фейк во втором тесте после правки `execute` должен обновлять `statusKey` через общую переменную, а не через подмену `get` после факта. В реализации теста одна переменная `current`, и `execute` на `approved` бросает после того, как `propose` уже сменил статус на `solutionProposed`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/adapters/tracker.test.ts`

Expected: FAIL, модуль не найден.

- [ ] **Step 3: Write minimal implementation**

`trackerAdapter` в `src/adapters/tracker.ts`:

- `labels`: теги плюс `sdd:cycle`, плюс `queueLabel`, плюс `sdd:${phaseOfStatus(status)}` когда фаза есть. Дубликаты не повторять.
- `listOpen`: `search(queue, 'typicalTask')`, каждый через `asRecord`. Чужой `typeKey` отбросить.
- `issue`: `get`. `typeKey !== 'typicalTask'` — `Error`.
- `editLabels`: снять и добавить теги, которые не равны `sdd:cycle`, `queueLabel` и не являются `sdd:<phase>`. Если среди `add` есть метка фазы, взять `statusPath(currentStatus, statusOfPhase(phase))` и для каждого шага после первого найти переход с этим `target` и вызвать `execute`. Нет такого перехода — `Error` с текстом `no transition to <status>`.
- `phaseHint`: делегирует в `phaseHint` из Task 1.
- `comment`: тело через `markRobot`, как в `github.ts` перед записью комментария.
- `close(key, comment)`: `client.comment(key, markRobot(comment))`, затем `statusPath(current, 'closed')` и те же `execute`.
- `updateBody`: `client.setDescription`. Это зеркало тикета из `sdd mirror` (`src/sdd.ts`).
- Parent: `links().parent`. Depends: исходящие связи типа `depends on`, ключ объекта.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/adapters/tracker.test.ts src/adapters/tracker-workflow.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/tracker.ts src/adapters/tracker.test.ts
git commit -m "$(cat <<'EOF'
Read a typicalTask as cycle labels and write a phase as workflow transitions.

EOF
)"
```

---

### Task 3: Адаптер Арканума

**Files:**
- Create: `src/adapters/arcanum.ts`
- Test: `src/adapters/arcanum.test.ts`

**Interfaces:**
- Consumes: `Review`, `Pull`, `ThreadRecord`, `Conversation` из `src/machine/port.ts`. `markRobot` из `src/machine/marker.ts`.
- Produces: `arcanumAdapter(client): Review`.

```ts
export type ArcanumReview = {
  id: string;
  status: 'open' | 'merged' | 'discarded' | 'closed';
  issues: string[];
  head: string;
  base: string | null;
  checks: {name: string; required: boolean; status: 'green' | 'red' | 'pending'}[];
};

export type ArcanumComment = {
  id: string;
  issueId: string | null;
  body: string;
  path?: string;
  line?: number | null;
  author: string;
  resolved: boolean;
};

export type ArcanumClient = {
  linkedIds(ticket: string): string[];
  review(id: string): ArcanumReview;
  comments(id: string): ArcanumComment[];
  create(branch: string, title: string, body: string, ticket: string): string;
  merge(id: string): void;
  post(id: string, body: string, place?: {path: string; line?: number}): string;
  reply(commentId: string, body: string): void;
  resolve(issueId: string): void;
  checksText(id: string): string;
};
```

`linkedIds` читает remotelinks тикета, где `object.application.type == "ru.yandex.arcanum"`, и возвращает `object.key`. `review` читает `GET /v1/pull-requests/{id}?fields=id,status,issues,vcs`. `create` создаёт ревью на ветке и записывает тикет в `issues` через `PUT /v1/review-requests/{id}/issues` с телом `{"issues":["<ticket>"]}`.

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import {test} from 'vitest';

import {arcanumAdapter, type ArcanumClient, type ArcanumReview} from './arcanum.ts';

function review(over: Partial<ArcanumReview> = {}): ArcanumReview {
  return {
    id: '100',
    status: 'open',
    issues: ['LAVKAOPSCORE-1'],
    head: 'aaa',
    base: 'trunk',
    checks: [{name: 'tests', required: true, status: 'green'}],
    ...over,
  };
}

test('pulls keeps a review whose issues name the ticket', () => {
  const client: ArcanumClient = {
    linkedIds: () => ['100', '101'],
    review: id => review(id === '101' ? {id, issues: ['OTHER-1'], status: 'open'} : {id}),
    comments: () => [],
    create: () => '102',
    merge: () => undefined,
    post: () => '1',
    reply: () => undefined,
    resolve: () => undefined,
    checksText: () => '',
  };
  const adapter = arcanumAdapter(client);
  assert.deepEqual(
    adapter.pulls('LAVKAOPSCORE-1').map(pull => pull.id),
    ['100'],
  );
  assert.equal(adapter.pulls('LAVKAOPSCORE-1')[0].checks, 'green');
});

test('merge throws when the review is still open', () => {
  let status: ArcanumReview['status'] = 'open';
  const client: ArcanumClient = {
    linkedIds: () => ['100'],
    review: () => review({status}),
    comments: () => [],
    create: () => '100',
    merge: () => {
      status = 'open';
    },
    post: () => '1',
    reply: () => undefined,
    resolve: () => undefined,
    checksText: () => '',
  };
  assert.throws(() => arcanumAdapter(client).merge('100'), /left it open/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/adapters/arcanum.test.ts`

Expected: FAIL, модуль не найден.

- [ ] **Step 3: Write minimal implementation**

`pulls(key)`: для каждого id из `linkedIds` взять `review`. Оставить те, чей `issues` содержит `key` и чей `status` — `open` или `merged`. `open` → `OPEN`, `merged` → `MERGED`. Чеки: нет обязательных — `none`; есть `red` — `red`; есть `pending` при отсутствии `red` — `pending`; иначе `green`. Статус `merged` → `green`.

`merge`: вызвать `client.merge`, снова прочитать `review`. `status !== 'merged'` — `throw new Error(\`merge of PR #${id} left it ${status}\`)`.

`ensurePull`: если среди `pulls` ровно одно `OPEN`, вернуть его id. Иначе `create('sdd/' + key, title, body, key)`.

`threads` / `threadList`: комментарии с `issueId`. `resolved` берётся из `resolved`. `path` и `line` — из комментария. Разговор — комментарии без `path`, по порядку списка. `say` постит через `post` тело `markRobot(body)`. `speak` постит тело без метки. `flag`: заметка с `path` — `post` с местом; без `path` — один `speak` со соединёнными телами. `range` — `head` и `base` ревью. `checksText` делегирует клиенту. Непрочитанные чеки: `review()` бросает, адаптер не подставляет `green`.

`client.merge` реального клиента вызывает слияние ревью и не пишет поле `auto_merge`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/adapters/arcanum.test.ts`

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/arcanum.ts src/adapters/arcanum.test.ts
git commit -m "$(cat <<'EOF'
Find an Arcanum review by the ticket on it, and merge only when it is merged.

EOF
)"
```

---

### Task 4: Адаптер arc

**Files:**
- Create: `src/adapters/arc.ts`
- Test: `src/adapters/arc.test.ts`
- Modify: `src/sdd.ts` — `worktree` вызывает подготовку checkout этой VCS, когда `config.host === 'arcadia'`

**Interfaces:**
- Consumes: `Vcs` из `src/machine/port.ts`. `branchName` из `src/adapters/vcs.ts` (если функция не экспортирована, экспортировать её без смены поведения git).
- Produces: `arcVcs(root, config, runner): Vcs` и `prepareArcCheckout(...)`.

```ts
export type ArcRunner = {
  exec(args: string[]): string;
  succeed(args: string[]): boolean;
};
```

`published` смотрит `arc log -n 1 --oneline arcadia/sdd/<key>` (конец ветки на сервере). Коммит равен этой вершине или является её предком (`arc merge-base --is-ancestor`). Чужой ключ и отсутствие ветки — `false`.

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import {test} from 'vitest';

import {arcVcs, type ArcRunner} from './arc.ts';

function runner(lines: Record<string, string | null>): ArcRunner & {calls: string[]} {
  const calls: string[] = [];
  return {
    calls,
    exec(args) {
      calls.push(args.join(' '));
      const hit = lines[args.join(' ')];
      if (hit == null) {
        throw new Error(args.join(' '));
      }
      return hit;
    },
    succeed(args) {
      calls.push(args.join(' '));
      return lines[args.join(' ')] === 'ok';
    },
  };
}

test('published is false for another key and for a commit the server does not have', () => {
  const arc = runner({
    'log -n 1 --format=%H arcadia/sdd/LAVKAOPSCORE-1': 'aaa',
  });
  const vcs = arcVcs('/repo', {branchPrefix: 'sdd'}, arc);
  assert.equal(vcs.published('LAVKAOPSCORE-1', 'aaa'), true);
  assert.equal(vcs.published('LAVKAOPSCORE-2', 'aaa'), false);
  assert.equal(vcs.published('LAVKAOPSCORE-1', 'bbb'), false);
});

test('compare of a missing commit is null', () => {
  const arc = runner({});
  const vcs = arcVcs('/repo', {branchPrefix: 'sdd'}, arc);
  assert.equal(vcs.compare('trunk', 'missing'), null);
});
```

Для предка дополнить `runner`: `succeed` на `merge-base --is-ancestor bbb aaa` возвращает true только когда карта говорит `ok`. В тесте выше `bbb` не предок, `succeed` возвращает false.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/adapters/arc.test.ts`

Expected: FAIL, модуль не найден.

- [ ] **Step 3: Write minimal implementation**

`arcVcs`:
- `push(key)`: `runner.exec(['push', '-u', branchName(key, prefix)])`. Ревью не создаёт.
- `published`: прочитать вершину `arcadia/<branch>`. Ошибка или пусто — `false`. Иначе вершина равна коммиту или `succeed(['merge-base', '--is-ancestor', commit, tip])`.
- `compare`: `exec(['log', '--oneline', base + '..' + head])` и `exec(['diff', base + '...' + head])`. Любое исключение — `null`.
- `dirty`: разобрать `arc status --short`. Пустой вывод — `[]`.
- `head`: `arc rev-parse HEAD`.
- `filesAt`: читать файлы из worktree этой ветки. Каталог — настроенный `worktreesDir` плюс имя ветки, где `/` заменён на `-`. В тесте этой задачи достаточно, чтобы `filesAt` не падал на отсутствующем каталоге и возвращал пустой `FileSource`, если каталога нет; чтение существующего файла покрыть одним утверждением, если каталог передан через `root`.

`prepareArcCheckout(root, key, config)` не пользуется `git worktree`. Каталог выбирает `ya tool arc-wt`, не `.sandcastle/worktrees`: `arc-wt add` не принимает путь. Имя ветки всё равно `sdd/<ключ>`.

- Worktree этой ветки уже есть (`ya tool arc-wt list` содержит её) — вернуть путь `ya tool arc-wt cd <branch>`. Грязное дерево не перематывать.
- Ветки на сервере нет — `ya tool arc-wt add <branch> --base <defaultBranch>`.
- Ветка на сервере есть — `ya tool arc-wt add <branch> --base arcadia/<branch>`. Без `--base` arc-wt отрежет новую локальную ветку от trunk и проигнорирует уже опубликованные коммиты.

`filesAt` читает этот путь. В тесте задачи достаточно `published` и `compare`; checkout в этом коммите не исполняется.

В `src/sdd.ts` функция `worktree`: при `box.config.host === 'arcadia'` звать `prepareArcCheckout`, иначе текущий `prepareCheckout`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/adapters/arc.test.ts`

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/arc.ts src/adapters/arc.test.ts src/adapters/vcs.ts src/sdd.ts
git commit -m "$(cat <<'EOF'
Publish sdd/<key> with arc and treat a missing commit as a failed range.

EOF
)"
```

---

### Task 5: Выбор адаптеров

**Files:**
- Modify: `src/adapters/compose.ts`
- Test: `src/adapters/compose.test.ts`

**Interfaces:**
- Consumes: `trackerAdapter`, `arcanumAdapter`, `arcVcs`, клиенты по умолчанию из своих модулей (`trackerClient()`, `arcanumClient()`, `arcRunner()`), которые ходят в сеть и в Task 5 только конструируются, без вызова в тесте.
- Produces: `MachineConfig.host: 'github' | 'arcadia'`. По умолчанию `'github'`.

- [ ] **Step 1: Write the failing test**

В `compose.test.ts` добавить тест: `machine(root, {config: {host: 'arcadia'}, tracker, review, vcs})` возвращает переданные порты, а `machine(root)` без `host` по-прежнему строится (существующие тесты compose не падают). Отдельное утверждение: при `host: 'arcadia'` и без переданных портов `config.host` равен `'arcadia'`. Не вызывать сеть: если конструктор клиента сразу ходит в API, принимать клиенты фабрикой `options.clients`, а в тесте подставлять фейки. Фабрика по умолчанию — реальные клиенты.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/adapters/compose.test.ts`

Expected: FAIL, `host` не входит в конфиг либо arcadia-ветка не отличается.

- [ ] **Step 3: Write minimal implementation**

```ts
host: 'github',
```

в дефолтный `MachineConfig`. Когда `config.host === 'arcadia'` и порт не передан в `options`:

```ts
tracker: options.tracker ?? trackerAdapter(trackerClient(), {queue: config.queueLabel, queueLabel: config.queueLabel}),
review: options.review ?? arcanumAdapter(arcanumClient()),
vcs: options.vcs ?? arcVcs(root, {branchPrefix: config.branchPrefix, defaultBranch: config.defaultBranch, worktreesDir: '.sandcastle/worktrees'}),
```

`queue` и `queueLabel` в этой схеме совпадают: метка, которую машина фильтрует, равна ключу очереди Трекера. Для GitHub `queueLabel` остаётся `'Sandcastle'`.

Рантайм не переключать.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test`

Expected: весь набор PASS. Существующие тесты машины не импортируют Трекер.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/compose.ts src/adapters/compose.test.ts src/adapters/tracker.ts src/adapters/arcanum.ts src/adapters/arc.ts
git commit -m "$(cat <<'EOF'
Use the Tracker, Arcanum, and arc adapters when the host is Arcadia.

EOF
)"
```
