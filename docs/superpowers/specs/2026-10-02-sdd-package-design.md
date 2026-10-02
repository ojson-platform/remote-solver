# Пакетирование remote-solver

Два входа, один репозиторий.

Машина цикла для чата — команда `sdd`. Она едет внутри скила `sdd-flow` и не требует `npm install` в сервисе. Шпион — команда `remote-solver` (`spy`, `issue`, `review`). С ней работают через `npm install` пакета `@ojson/remote-solver`: зависимости пакета, включая `@ai-hero/sandcastle`, ставятся вместе с ним. Шпион в файл скила не собирается.

Публичный пакет знает порты `Tracker`, `Review`, `Vcs`, `Runtime`, адаптеры GitHub и git и один runtime поверх любого `Vcs`. Трекер, Арканум и arc в пакет не импортируются. Ключа `host` в конфиге нет.

## Каталог скила

Публично вызываются два скила: `skills/sdd-flow` и соседний `skills/sdd-init`. Остальные процедуры — файлы шагов внутри `sdd-flow`, не отдельные скилы.

```
skills/sdd-flow/
  SKILL.md
  CONTEXT.md
  steps/
    plan.md
    specify.md
    ...
  scripts/
    sdd.mjs
skills/sdd-init/
  SKILL.md
```

Исходники остаются в корневом `src/`: `src/sdd.ts` — вход машины чата, `src/cli.ts` — вход шпиона. Из них собираются `skills/sdd-flow/scripts/sdd.mjs` и `bin/remote-solver.mjs`. Каталог `src/` в опубликованный tar не входит, тесты импортируют его напрямую и в каталог скила не кладутся.

Расширение `.mjs` выбрано потому, что в `ai/artifacts` над файлом нет `package.json` с `"type": "module"`, и Node прочитал бы `.js` как CommonJS.

`sdd-flow` по имени шага открывает `steps/<шаг>.md`. В первой строке шага — `mode: judgment` или `mode: mechanical`.

## Имена шагов

Таблица `ACTION_SKILL` в `src/machine/route.ts` отдаёт имя файла шага без префикса: `plan`, `baseline`, `specify`, `design`, `tasks`, `implement`, `fix`, `verify`, `pr-comments`, `accept`. То же имя идёт в `{{SKILL}}` промпта шпиона и в `modeOfSkill(stepsDir, skill)`, который читает `steps/<skill>.md`. Таблица Actions в `SKILL.md` роутера называет шаги этими же именами.

## Состав опубликованного пакета

`package.json` `files` называет то, что попадает в tar:

- `bin/remote-solver.mjs`, `prompts/` — шпион и его промпты
- `skills/sdd-init/SKILL.md`
- `skills/sdd-flow/SKILL.md`, `CONTEXT.md`, `steps/`, `scripts/sdd.mjs`

`src/`, тесты и `docs/` в tar нет. Перед публикацией `pnpm build` обновляет оба собранных файла.

## Кто что запускает

| Вход | Команда | Откуда берётся |
|---|---|---|
| Чат из `sdd-flow` | `node scripts/sdd.mjs <глагол>` | От каталога скила |
| `sdd-init` | `node ../sdd-flow/scripts/sdd.mjs <глагол>` | Соседний скил |
| Шпион, один тикет, review | `remote-solver spy`, `remote-solver issue <key>`, `remote-solver review` | Бинарь npm-пакета |

Путь считается от каталога скила, не от cwd сервиса. В shell уходит абсолютный путь открытого `SKILL.md`. `npx sdd` в тексте скилов не остаётся.

`scripts/sdd.mjs` — один файл. В сервис он попадает либо симлинком aisuite на каталог скила, либо как `bin.sdd` установленного пакета. `bin.remote-solver` — это `bin/remote-solver.mjs`. Оба запускаются через `node`. `tsx` в зависимостях пакета нет.

`sdd-init` описывает оба входа. На GitHub этап машины добавляет зависимость `@ojson/remote-solver` и пишет `sandcastle.yaml` с `comments.ignore`. На Arcadia тот же этап не пропускается: скилы уже приезжают пресетом `lavka/sdd`, зависимость ставится ради шпиона. `sandcastle.yaml` сервиса адаптеры не называет.

## Машина без runtime

`machine(root, options)` собирает порты сразу. Методы `tracker`, `review` и `vcs`, которые ходят в сеть или в VCS, возвращают Promise. `decide` и `settle` остаются синхронными: им передают уже загруженные записи. `phaseHint` и чтение файлов через `filesAt` тоже синхронные. Порты по умолчанию — GitHub и git. Порт `runtime` машина сама не строит: он берётся только из `options.runtime`, и в типе `Machine` он необязателен.

```ts
export type Machine = {
  root: string;
  config: MachineConfig;
  tracker: Tracker;
  review: Review;
  vcs: Vcs;
  runtime?: Runtime;
};
```

Чат (`sdd.ts`) runtime не использует и не передаёт. Поэтому `sdd.mjs` не импортирует `runtime.ts`, `agent.ts`, `host-sandbox.ts` и `@ai-hero/sandcastle`. Шпион и ревьюер требуют `runtime` при старте: `main.ts` и `reviewer/run.ts` падают с текстом `runtime is not configured`, если его нет.

## Checkout через порт

У `Vcs` появляются два метода:

```ts
prepare(key: IssueKey, options: {worktreesDir: string; links: Link[]}): string;
/** Вершина локальной ветки `sdd/<key>`. Исключение, если ветки нет. */
tip(key: IssueKey): string;
```

`prepare` возвращает путь к checkout ветки `sdd/<key>` и создаёт его, если нужно. Повторный вызов возвращает тот же путь. `Link` — `{from: string; to: string}`: путь в пакете и имя внутри `.sandcastle/` в checkout. Список даёт `packageLinks(solverRoot())`: `skills`, `prompts` и `.env`, если они есть. `gitVcs.prepare` — сегодняшний `prepareCheckout` вместе с `linkCommand` и записью в `info/exclude`. Адаптер arc делает `arc-wt` и ссылки без git.

`sdd worktree` вызывает `box.vcs.prepare(...)`. Прямого импорта `prepareCheckout` в `sdd.ts` нет. `filesAt` адаптера читает тот каталог, который `prepare` записал для ветки.

## Один runtime

Жизненный цикл `run` из `@ai-hero/sandcastle` в пакете не используется: он привязан к git на хосте (`git rev-parse`, `git rev-list`, `git worktree add` мимо провайдера sandbox, во всех стратегиях ветки) и не работает в каталоге arc. Форк с абстракцией над git отвергнут: сквозной патч по ~40 местам Effect-кода. Вместо этого пакет держит один runtime поверх `Vcs`:

```ts
export function agentRuntime(options: {
  root: string;
  vcs: Vcs;
  config: MachineConfig;
  solverRoot: string;
}): Runtime;
```

`run(skill)`:

1. `dir = vcs.prepare(skill.key, {worktreesDir: <root>/.sandcastle/worktrees, links: packageLinks(solverRoot)})`.
2. `before = vcs.tip(skill.key)`.
3. `runAgent({cwd: dir, hostCwd: root, provider: agentFor(skill.mode), name: skill.action, promptFile: <solverRoot>/prompts/sdd.md, promptArgs: {ISSUE, ACTION, PHASE, PR, SKILL, QUEUE, BASE}, logPath, resumeSession: skill.resumeSession})`.
4. `commits` — число строк в `vcs.compare(before, vcs.tip(key)).commits`. Возвращает `{commits, sessionId, usage}`.

`ask(request)` — ключ берётся из `request.branch` без префикса, тот же `prepare`, `runAgent` с `request.promptFile` и `outputTag`; возвращает `{text, sessionId, usage}`.

Один и тот же runtime работает на GitHub с `gitVcs` и на Аркадии с `arcVcs` из адаптеров. Адаптеры Аркадии runtime не реализуют.

### От sandcastle берётся провайдер агента

`AgentProvider` — публичный интерфейс sandcastle, и всё агентное лежит в нём: `buildPrintCommand({prompt, dangerouslySkipPermissions, resumeSession, forkSession})`, `parseStreamLine` (события `text`, `tool_call`, `result`, `session_id`), `env`, `sessionStorage`, `parseSessionUsage`. Пакет выбирает провайдер в одном месте — `agentFor(mode): AgentProvider` в `src/machine/skill.ts`; сегодня это `cursor(modelFor(mode))`. Переход на `claudeCode` или свой провайдер с сессиями для Cursor — правка этой функции.

`runAgent` в `src/adapters/agent.ts`:

```ts
export type AgentRun = {
  cwd: string;
  /** Корень сервиса. Под ним sessionStorage хранит сессии. */
  hostCwd: string;
  provider: AgentProvider;
  name: string;
  promptFile: string;
  promptArgs: Record<string, string>;
  logPath: string;
  outputTag?: string;
  resumeSession?: string;
  forkSession?: boolean;
  /** Секунды тишины в stdout до остановки. По умолчанию 600. */
  idleTimeoutSeconds?: number;
};
export type AgentResult = {text: string; sessionId?: string; sessionFilePath?: string; usage?: AgentUsage};
export function runAgent(run: AgentRun): Promise<AgentResult>;
```

Что он делает, в порядке sandcastle `run`:

1. Читает `promptFile`, подставляет `{{KEY}}` из `promptArgs`.
2. Если задан `resumeSession` и у провайдера есть `sessionStorage` — `resumeIntoSandbox({hostCwd, sandboxCwd: cwd, sessionId, handle})`.
3. `provider.buildPrintCommand({prompt, dangerouslySkipPermissions: true, resumeSession, forkSession})`; запуск через `sh -c` в `cwd`; env — `process.env`, переменные из `<hostCwd>/.sandcastle/.env`, `provider.env`. `stdin` команды, если есть, уходит в процесс.
4. Каждую строку stdout — в `provider.parseStreamLine`; события пишутся в `logPath` через `renderAgentEvent`; `text` накапливается; `session_id` запоминается.
5. Остановка: процесс завершился сам; или после события `result` процесс не вышел за 60 секунд — завершить его и считать запуск успешным; или `idleTimeoutSeconds` тишины — завершить и отвергнуть.
6. После успешного завершения, если `provider.captureSessions` и есть `sessionStorage` и `sessionId`: `captureToHost(...)`, `hostSessionFilePath`, затем `readHostSession` → `parseSessionUsage` → `usage`.
7. Ответ — текст между `<outputTag>…</outputTag>`, если тег задан, иначе весь текст. Ненулевой код выхода — исключение с кодом и хвостом stderr.

`handle` для `sessionStorage` — `openHostHandle(cwd)` из `host-sandbox.ts`: он уже реализует `BindMountSandboxHandle`. Функция `hostSandbox()` и перехват `git config --global` из этого файла удаляются вместе с `sandcastleRuntime`.

Порты расширяются под сессии:

```ts
export type SkillRun = {skill; action; key; phase; pull; mode: SkillMode; resumeSession?: string};
export type SkillOutcome = {commits: number; sessionId?: string; usage?: AgentUsage};
export type Runtime = {
  run(skill: SkillRun): Promise<SkillOutcome>;
  ask(request: RuntimeAsk): Promise<AgentResult>;
};
```

`driveIssue` вычисляет `mode` через `modeOfSkill` и передаёт в `run`; `sessionId` и `usage` оно сегодня только логирует.

### Что из sandcastle не используется осознанно

Изоляция агента в контейнере (docker, podman, vercel, daytona) и перенос коммитов патчами, `interactive()`, `createSandbox()`, стратегия `merge-to-head`, `Output.object` с `maxRetries`, итерации с `completionSignal`. Первое — единственная потеря с ценой: путь к запуску агента не на хосте шпиона закрыт. На Аркадии он и так не работал бы; на GitHub не требовался.

## Адаптеры рядом с процессом

Путь к адаптерам в конфиг сервиса не пишется. Файл кладётся один раз рядом с собранной машиной:

`ai/artifacts/skills/teams/lavka/sdd/sdd-flow/scripts/adapters/index.mjs`

`openMachine(root, options)` ищет этот файл так:

1. Рядом со скриптом процесса: `<каталог argv[1]>/adapters/index.mjs`. `sdd.mjs` и `adapters/` лежат в `scripts/`. Node подставляет в `argv[1]` реальный путь, поэтому симлинк aisuite и `node_modules/.bin/sdd` ведут туда же, где лежит файл.
2. Иначе вверх от `root` по родителям. У каталога `dir` проверяется `dir/ai/artifacts/skills/teams/lavka/sdd/sdd-flow/scripts/adapters/index.mjs`. Так шпион из npm, запущенный в сервисе внутри монтирования Аркадии, находит тот же файл.
3. Иначе порты не подменяются, остаются GitHub и git.

Модуль адаптеров — JavaScript с одним экспортом:

```ts
export function createAdapters(root: string, config: MachineConfig): {
  config?: Partial<MachineConfig>;
  tracker: Tracker;
  review: Review;
  vcs: Vcs;
};
```

Модуль не импортирует ничего, кроме `node:*`. Runtime он не возвращает: его строит пакет поверх `vcs`.

`config` в аргументе — дефолты пакета (`Sandcastle`, `origin/master`, `master`). Модуль возвращает свой `config` для своего хоста: очередь Трекера, `trunk`.

```ts
export async function openMachine(
  root: string,
  options: {runtime?: (box: Omit<Machine, 'runtime'>) => Runtime} = {},
): Promise<Machine> {
  const file = adapterFile(process.argv[1] ?? '', root);
  let built = machine(root);
  if (file) {
    const loaded = await import(pathToFileURL(file).href);
    const made = loaded.createAdapters(root, built.config);
    built = machine(root, {config: made.config, tracker: made.tracker, review: made.review, vcs: made.vcs});
  }
  return {...built, runtime: options.runtime?.(built)};
}
```

Чат вызывает `openMachine(cwd)`. Шпион и ревьюер — `openMachine(cwd, {runtime: box => agentRuntime({root, vcs: box.vcs, config: box.config, solverRoot: solverRoot()})})`.

`printStep` печатает `queue` и `base` из итогового `config`, поэтому промпт шпиона на Аркадии получает значения адаптеров.

`sandcastle.yaml` остаётся файлом сервиса (`comments.ignore` и то, что сервис уже туда пишет). Ключа для адаптеров в нём нет.

## Что давало отдельное SKILL.md

У шага нет своего каталога в `skills/`. В каждом таком каталоге сейчас только `SKILL.md`. Машина не читает `name`, `description` и фразу `Trigger:`: действие выбирает таблица маршрута. Эти поля видит харнесс, поэтому `/sdd-plan` и похожие команды пропадают. Так и задумано: из чата человек вызывает `sdd-flow` и `sdd-init`.

Шпион текст шага читает. `prompts/sdd.md` говорит открыть `.sandcastle/skills/{{SKILL}}/SKILL.md` и `.sandcastle/prompts/context.md`. `modeOfSkill` читает `mode` из того же `SKILL.md`. Ссылки в `.sandcastle/` ставит `prepare`.

После переноса промпт шпиона открывает `.sandcastle/skills/sdd-flow/steps/{{SKILL}}.md` и `.sandcastle/skills/sdd-flow/CONTEXT.md`. Модель берётся из строки `mode:` этого шага. Ссылка `prompts/` остаётся: там лежит сам `prompts/sdd.md`.

Правило «шаг не называет другой шаг» сохраняется. Тесты в `src/machine/skill.test.ts` проверяют два источника: `skills/*/SKILL.md` — только `sdd-flow` и `sdd-init`; `skills/sdd-flow/steps/*.md` — первая строка `mode:`, секция Stop с Publish, Wait или Hand-off, упоминание `CONTEXT.md`, множество имён шагов равно множеству значений `ACTION_SKILL`, шаг не называет другой шаг. Проверка `Trigger:` уходит вместе с frontmatter.

## Что не меняется

Политика, фазы, грамматика `sdd:*` и глаголы `sdd` не меняются. Ветка `tracker-arcanum-cycle` в публичный пакет не сливается: оттуда берутся только адаптеры, и они живут в Аркадии.
