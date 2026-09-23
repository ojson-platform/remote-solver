# Комментарий человека на accepting — план

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Комментарий человека в разговоре пул-реквеста на `accepting` откатывает задачу на слой, который выбирает шпион, и скилл этого слоя делает работу.

**Architecture:** Адаптер помечает каждое опубликованное тело префиксом `🤖 `. Чтение считает шпионом этот префикс или логин на `[bot]`, а не совпадение с логином запуска. `reviewOf` берёт открытый `sdd:layer=` из комментариев разговора так же, как из треда. Существующий откат в `decide` переводит `accepting` на этот слой. Новая команда `thread say` пишет ответ в разговор пул-реквеста.

**Tech Stack:** TypeScript, node:test через `tsx --test`, GitHub CLI `gh` в адаптере.

## Global Constraints

- Префикс публикации: `🤖 ` (эмодзи U+1F916 и пробел). Тело, которое уже начинается с `🤖`, не получает второй префикс.
- Шпион при чтении: тело начинается с `🤖`, либо логин заканчивается на `[bot]`. Логин процесса шпионом не является.
- Ребейз и конфликт мержа — слой `code`, фаза `implementing`.
- `sdd:fixed` закрывает открытый слой разговора, в том числе в том же комментарии, что и `sdd:layer=`.
- Политика `decide` нового ветвления для `accepting` не получает.
- Коммиты в этом плане не создавать, пока человек отдельно не попросит.

---

### Task 1: Маркер разговора

**Files:**
- Modify: `src/machine/review.ts`
- Modify: `src/machine/port.ts` (комментарий к `Conversation`)
- Test: `src/machine/review.test.ts`

**Interfaces:**
- Consumes: `Conversation`, `Thread`, `reviewOf`
- Produces: `markRobot(body: string): string`, `spokeByRobot(body: string, login: string): boolean`, `reviewOf` с слоем из разговора

- [ ] **Step 1: Write the failing test**

В конец `src/machine/review.test.ts`:

```ts
test('the spy mark and a bot login are the robot, the shared login is not', () => {
  assert.equal(spokeByRobot('Нужно поребейзить ПР', '3y3'), false);
  assert.equal(spokeByRobot('🤖 sdd:layer=code → implementing', '3y3'), true);
  assert.equal(spokeByRobot('Quality Gate passed', 'sonarqubecloud[bot]'), true);
  assert.equal(markRobot('sdd:layer=code → implementing'), '🤖 sdd:layer=code → implementing');
  assert.equal(markRobot('🤖 sdd:note fyi'), '🤖 sdd:note fyi');
});

test('a conversation layer stays open until a later sdd:fixed', () => {
  const open = reviewOf(
    [],
    [
      {robot: false, body: 'Нужно поребейзить ПР'},
      {robot: true, body: '🤖 sdd:layer=code → implementing'},
    ],
  );
  assert.equal(open.unanswered, false);
  assert.equal(open.rollback, 'implementing');
  assert.deepEqual(open.layers, ['code']);

  const closed = reviewOf(
    [],
    [
      {robot: false, body: 'Нужно поребейзить ПР'},
      {robot: true, body: '🤖 sdd:layer=code → implementing'},
      {robot: true, body: '🤖 sdd:fixed abc'},
    ],
  );
  assert.equal(closed.unanswered, false);
  assert.equal(closed.rollback, null);
  assert.deepEqual(closed.layers, []);
});
```

Импорт в том же файле заменить на:

```ts
import {markRobot, reviewOf, spokeByRobot} from './review.ts';
```

- [ ] **Step 2: Run test to verify it fails**

Run from `/Users/3y3k0/doctools/ojson/devops/remote-solver`:

```bash
pnpm exec tsx --test src/machine/review.test.ts
```

Expected: FAIL, `spokeByRobot` is not exported.

- [ ] **Step 3: Write minimal implementation**

В `src/machine/review.ts` после импортов:

```ts
export const ROBOT_MARK = '🤖 ';

export function markRobot(body: string): string {
  return body.startsWith('🤖') ? body : `${ROBOT_MARK}${body}`;
}

export function spokeByRobot(body: string, login: string): boolean {
  return body.startsWith('🤖') || login.endsWith('[bot]');
}

function conversationLayer(comments: Conversation[]): string | null {
  let layer: string | null = null;
  for (const comment of comments) {
    if (comment.body.includes('sdd:fixed')) {
      layer = null;
      continue;
    }
    const found = comment.body.match(/sdd:layer=([a-z]+)/)?.[1];
    if (found) {
      layer = found;
    }
  }
  return layer;
}
```

В `reviewOf`, сразу после цикла по тредам и до чтения `comments.at(-1)`:

```ts
  const fromConversation = conversationLayer(comments);
  if (fromConversation) {
    layers.push(fromConversation);
  }
```

В `src/machine/port.ts` заменить комментарий типа:

```ts
/** A conversation comment. `robot` is a spy mark or a `[bot]` login. */
export type Conversation = {body: string; robot: boolean};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm exec tsx --test src/machine/review.test.ts
```

Expected: PASS.

---

### Task 2: Публикация с префиксом и `thread say`

**Files:**
- Modify: `src/machine/port.ts` (`Review.say`)
- Modify: `src/adapters/github.ts`
- Modify: `src/sdd.ts`
- Modify: `src/cli.ts`
- Test: `src/adapters/github.test.ts`

**Interfaces:**
- Consumes: `markRobot`, `spokeByRobot` из `src/machine/review.ts`
- Produces: `Review.say(pull: string, body: string): void`. `comments()` ставит `robot` через `spokeByRobot`. `openThread`, `reply`, `say`, `tracker.comment`, `tracker.close` публикуют `markRobot(body)`.

- [ ] **Step 1: Write the failing test**

В конец `src/adapters/github.test.ts`:

```ts
test('posted bodies carry the spy mark, and the shared login is not the robot', () => {
  const {tracker, review, calls} = memoryPorts({user: '3y3'});
  tracker.comment('7', 'sdd:accept proposal accepted by @3y3');
  tracker.close('7', 'SDLC accepted');
  review.openThread('15', {commit: 'abc', path: 'src/a.ts', line: 1, body: 'sdd:note baseline'});
  review.reply('15', '9', 'sdd:fixed abc');
  review.say('15', 'sdd:layer=code → implementing');
  assert.deepEqual(
    calls.filter(call => call.startsWith('body:')),
    [
      'body:🤖 sdd:accept proposal accepted by @3y3',
      'body:🤖 SDLC accepted',
      'body:🤖 sdd:note baseline',
      'body:🤖 sdd:fixed abc',
      'body:🤖 sdd:layer=code → implementing',
    ],
  );
});
```

`memoryPorts` в этом тесте должен принимать вызовы без заранее созданного тикета `7` для `comment`/`close`, либо тест создаёт тикет. `close` сейчас делает `find(key)` и бросает `no issue 7`. Создай тикет в seed:

```ts
test('posted bodies carry the spy mark, and the shared login is not the robot', () => {
  const {tracker, review, calls} = memoryPorts({
    user: '3y3',
    issues: [{key: '7', title: '#7: title', body: '', state: 'OPEN', labels: []}],
  });
  tracker.comment('7', 'sdd:accept proposal accepted by @3y3');
  review.openThread('15', {commit: 'abc', path: 'src/a.ts', line: 1, body: 'sdd:note baseline'});
  review.reply('15', '9', 'sdd:fixed abc');
  review.say('15', 'sdd:layer=code → implementing');
  tracker.close('7', 'SDLC accepted');
  assert.deepEqual(
    calls.filter(call => call.startsWith('body:')),
    [
      'body:🤖 sdd:accept proposal accepted by @3y3',
      'body:🤖 sdd:note baseline',
      'body:🤖 sdd:fixed abc',
      'body:🤖 sdd:layer=code → implementing',
      'body:🤖 SDLC accepted',
    ],
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm exec tsx --test src/adapters/github.test.ts
```

Expected: FAIL, `review.say` is not a function.

- [ ] **Step 3: Write minimal implementation**

В `src/machine/port.ts` в тип `Review`, после `reply`:

```ts
  /** Issue comment on the pull request. The adapter adds the spy mark. */
  say(pull: string, body: string): void;
```

В `src/adapters/github.ts` импортировать `markRobot` и `spokeByRobot` из `../machine/review.ts`.

`comments()`: убрать `const me = login()` и ставить

```ts
robot: spokeByRobot(comment.body, comment.login),
```

`tracker.comment`:

```ts
comment(key, body) {
  gh(['issue', 'comment', key, '--repo', repoSlug(), '--body', markRobot(body)]);
},
```

`tracker.close`: в аргумент `--comment` передать `markRobot(comment)`.

`openThread`: `body=${markRobot(target.body)}`.

`reply`: `body=${markRobot(body)}`.

Новый метод `say`:

```ts
say(pull, body) {
  gh(['issue', 'comment', pull, '--repo', repoSlug(), '--body', markRobot(body)]);
},
```

В `memoryPorts` те же методы пишут вызов и помеченное тело. `comment`, `close`, `openThread`, `reply` сохраняют прежнее имя вызова (`comment`, `close:${...}`, `openThread`, `reply`) и добавляют `calls.push(`body:${markRobot(...)}`)`. `close` по-прежнему закрывает тикет. `say`:

```ts
say(_pull, body) {
  calls.push('say');
  calls.push(`body:${markRobot(body)}`);
},
```

В `src/sdd.ts` в ветке `command === 'thread'` добавить `say` рядом с `reply`:

```ts
} else if (sub === 'say') {
  const pull = need(rest[1], usage);
  const body = rest.slice(2).join(' ');
  if (!body) {
    fail(usage);
  }
  box.review.say(pull, body);
}
```

Строку usage в `src/sdd.ts` и `src/cli.ts` заменить `thread open|reply|resolve` на `thread open|reply|say|resolve`.

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm exec tsx --test src/adapters/github.test.ts src/machine/flow.test.ts
pnpm exec tsc --noEmit
```

Expected: PASS, `tsc` без ошибок. `flow.test.ts` по-прежнему видит `close:`.

---

### Task 3: Откат с accepting

**Files:**
- Test: `src/machine/policy.test.ts`
- Modify: `src/machine/policy.ts` только если тест не проходит без правки. Ожидание: правки нет.

**Interfaces:**
- Consumes: `decide`, `PullSnapshot.review.rollback`
- Produces: зафиксированное поведение: архивный зелёный PR на `sdd:accepting` с маркером `implementing` возвращает `{kind: 'advance', to: 'implementing'}`

- [ ] **Step 1: Write the failing test**

Рядом с тестом `a green archived pull request waits for a person to merge` в `src/machine/policy.test.ts`:

```ts
test('an accepting pull request rolls back when a conversation layer is open', () => {
  const decision = decide(
    issue(1, ['sdd:accepting']),
    [],
    [
      pull(9, {
        checks: 'green',
        reviewCheck: 'green',
        review: {unanswered: false, rollback: 'implementing', layers: ['code']},
      }),
    ],
    change({proposal: true, delta: true, design: true, tasks: true, archived: true}),
  );
  assert.deepEqual(decision, {
    kind: 'advance',
    issue: '1',
    to: 'implementing',
    reason: 'review thread sent the change back',
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm exec tsx --test src/machine/policy.test.ts
```

Expected: PASS уже на текущем `decide`. Если PASS, шаг 3 пропустить. Если FAIL, не добавлять отдельную ветку `accepting`: маркер должен обрабатываться общим откатом выше `mergeOrWait`.

- [ ] **Step 3: Run the test again only if step 2 failed and the shared rollback path was fixed**

```bash
pnpm exec tsx --test src/machine/policy.test.ts
```

Expected: PASS.

---

### Task 4: Скиллы

**Files:**
- Modify: `skills/sdd-pr-comments/SKILL.md`
- Modify: `skills/sdd-implement/SKILL.md`
- Modify: `skills/sdd-flow/SKILL.md`
- Modify: `prompts/context.md`

**Interfaces:**
- Consumes: `npx remote-solver thread say <pull> '<body>'`
- Produces: текст, по которому агент классифицирует комментарий разговора и ребейзит на `code`

- [ ] **Step 1: Update `skills/sdd-pr-comments/SKILL.md`**

В описание добавить: классифицирует и комментарий разговора пул-реквеста.

В Steps после пункта про треды:

```md
2. The last conversation comment with no spy mark and no `sdd:note`, `sdd:layer=`, or `sdd:begin` is one request. Reply with `npx remote-solver thread say <pull> 'sdd:layer=<layer> → <phase>'`. A rebase or a merge conflict is `sdd:layer=code → implementing`.
```

Прежние пункты 2–5 сдвинуть. В Check: у этого комментария есть следующий комментарий с `sdd:layer=`.

- [ ] **Step 2: Update `skills/sdd-implement/SKILL.md`**

В `fix-implementation` после пункта про треды:

```md
A conversation comment with an open `sdd:layer=code` is the same work. A request to rebase or to resolve a merge conflict: rebase `sdd/<issue>` onto the pull request base, edit only files git marks conflicted, Publish. Then `npx remote-solver thread say <pull> 'sdd:fixed <commit>'`. There is no thread to resolve. A remark about behavior: stop.
```

- [ ] **Step 3: Update `skills/sdd-flow/SKILL.md` and `prompts/context.md`**

В `sdd-flow` в абзац про `accepting` добавить фразу: комментарий человека в разговоре пул-реквеста классифицируется и откатывает задачу на слой маркера до ожидания мержа.

В `prompts/context.md` в блок Review threads добавить строку:

```bash
npx remote-solver thread say <pull> '<body>'
```

И одну фразу: команда сама ставит `🤖 ` в начало тела.

- [ ] **Step 4: Run the suite**

```bash
pnpm test
pnpm exec tsc --noEmit
```

Expected: все тесты PASS, `tsc` без ошибок.

---

## Self-review

- Спека: префикс, чтение, `thread say`, слой разговора, откат, ребейз в `fix-implementation`, архив не раскрывается. Задачи 1–4 закрывают каждый пункт.
- `decide` не получает новой ветки. Task 3 это проверяет.
- Имена: `markRobot`, `spokeByRobot`, `Review.say`, префикс `🤖 `.
