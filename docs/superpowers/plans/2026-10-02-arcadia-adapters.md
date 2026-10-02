# Arcadia Adapters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tracker, Arcanum, and arc implement `createAdapters(root, config)` inside the sdd-flow skill directory in Arcadia, and the commands match the real tools.

**Architecture:** Code moves off `tracker-arcanum-cycle` into `ai/artifacts/skills/teams/lavka/sdd/sdd-flow/scripts/adapters`. Files are `.mjs`, imports are `node:*` only. Tests are `node --test`. The public package does not gain these files. The runtime is the package's `agentRuntime` over this module's `vcs`; the module does not implement one. Behavior the cycle spec already fixed stays: the workflow table, merge only when the review is merged, no `auto_merge`.

**Tech Stack:** Node.js built-in test runner; port shapes from `src/machine/port.ts` of remote-solver copied as JSDoc types.

## Global Constraints

- Публичный пакет не импортирует Трекер, Арканум и arc. Ключа `host` нет.
- Машина чата — `skills/sdd-flow/scripts/sdd.mjs`. Шпион — `bin/remote-solver.mjs` пакета `@ojson/remote-solver`.
- `createAdapters(root, config)` возвращает `{config, tracker, review, vcs}`. Модуль импортирует только `node:*`. Runtime строит пакет.
- Каталог артефактов — `ai/artifacts/skills/teams/lavka/sdd`. Пресет — `ai/artifacts/presets/lavka/sdd.yaml`.
- Коммит в remote-solver — одна фраза, без префикса `feat:`. Эти файлы коммитятся в Аркадию.
- Проверка адаптеров: `node --test` в `sdd-flow/scripts/adapters`. Сети нет.

Исходная спека поведения: `docs/superpowers/specs/2026-10-01-tracker-arcanum-cycle-design.md`. Контракт модуля: `docs/superpowers/specs/2026-10-02-sdd-package-design.md`.

Depends on package plan Task 3 (`Vcs.prepare`, `Vcs.tip`) for the port shape.

---

### Task 1: createAdapters module

**Files:**
- Create: `sdd-flow/scripts/adapters/index.mjs`
- Create: `sdd-flow/scripts/adapters/index.test.mjs`
- Source: `src/adapters/tracker-workflow.ts`, `tracker.ts`, `arcanum.ts`, `arc.ts` and their tests on the worktree branch. Do not merge that branch to `master`.

**Interfaces:**
- Consumes: port shapes `Tracker`, `Review`, `Vcs` from remote-solver, as JSDoc
- Produces: `createAdapters(root, config)`

- [ ] **Step 1: Write the failing test**

`index.test.mjs` imports `createAdapters`. Call it with `{queueLabel: 'Sandcastle', branchPrefix: 'sdd', defaultBranch: 'origin/master', prBase: 'master'}`. Assert:

- the return has `tracker`, `review`, `vcs`, and no `runtime`;
- `config` is `{queueLabel: 'LAVKAOPSCORE', defaultBranch: 'trunk', prBase: 'trunk'}`;
- `tracker.phaseHint('proposing', 'proposed')` is `Предложить`;
- `vcs` has `prepare`, `tip`, `filesAt`, `compare`, `push`, `head`, `published`, `dirty`.

Run: `node --test`

Expected: FAIL, `createAdapters` is not exported.

- [ ] **Step 2: Port the workflow table and the three adapters**

Take the pure table from `tracker-workflow.ts` and the adapter bodies from the worktree, as `.mjs` without type imports. `index.mjs` wires them:

```js
const QUEUE = 'LAVKAOPSCORE';

export function createAdapters(root, config) {
  const own = {queueLabel: QUEUE, defaultBranch: 'trunk', prBase: 'trunk'};
  const merged = {...config, ...own};
  return {
    config: own,
    tracker: trackerAdapter(trackerClient(), {queue: QUEUE}),
    review: arcanumAdapter(arcanumClient()),
    vcs: arcVcs(root, merged, arcRunner(root)),
  };
}
```

- [ ] **Step 3: Run the test**

Run: `node --test`

Expected: PASS

### Task 2: arc commands, prepare, tip, and filesAt

**Files:**
- Modify: `sdd-flow/scripts/adapters/arc.mjs`
- Test: `sdd-flow/scripts/adapters/arc.test.mjs`

- [ ] **Step 1: Write the failing tests**

Fake runner records argv joined by a space and returns canned output per command.

- `published(key, sha)` runs `log -n 1 --format={commit} arcadia/sdd/<key>`. When the runner returns that sha, published is true. When it returns another sha and `merge-base <sha> <tip>` returns `<sha>`, published is true. When the runner throws, published is false.
- `compare` of a missing object returns null. `compare('aaa', 'ccc').commits` has one line per commit.
- `prepare('7', {worktreesDir, links: [{from: '/pkg/skills', to: 'skills'}]})` runs `arc-wt` for branch `sdd/7`, then creates `.sandcastle/skills` in the returned directory as a symlink to `/pkg/skills`, without any `git` call. Calling it again does not run `arc-wt` again.
- `tip('7')` runs `log -n 1 --format={commit}` in the prepared directory and returns the sha; before `prepare`, it throws.
- `filesAt('7').read('openspec/x.md')` reads from the directory `prepare` returned, not from `<root>/.sandcastle/worktrees`.
- `dirty()` drops paths under `.sandcastle/`.

- [ ] **Step 2: Run the tests and confirm they fail**

Expected: FAIL on `--format=%H`, `--is-ancestor`, or `.sandcastle/worktrees` if those strings are still in the ported code.

- [ ] **Step 3: Implement the commands from the spec**

```js
function published(key, sha) {
  let tip;
  try {
    tip = runner.exec(['log', '-n', '1', '--format={commit}', `arcadia/sdd/${key}`]).trim();
  } catch {
    return false;
  }
  if (!tip) {
    return false;
  }
  if (tip === sha) {
    return true;
  }
  try {
    return runner.exec(['merge-base', sha, tip]).trim() === sha;
  } catch {
    return false;
  }
}
```

`prepare` keeps a map `branch → directory` in the adapter instance and on disk under `<worktreesDir>/<branch-with-dashes>.path` so a second process finds the same directory. Links are `fs.symlinkSync` with `mkdirSync('.sandcastle')`; no `git`.

- [ ] **Step 4: Run `node --test`**

Expected: PASS

### Task 3: review checks

**Files:**
- Modify: `sdd-flow/scripts/adapters/arcanum.mjs`
- Test: `sdd-flow/scripts/adapters/arcanum.test.mjs`

- [ ] **Step 1: Write the failing test**

A fake `fetch` returns a review payload with one required check `status: failed`. `createAdapters(...).review.pulls(key)[0].checks` is `red`. A payload with no checks field makes `pulls` throw, not return `green`. `merge` sends a body that is `{}` and does not contain `auto_merge`.

- [ ] **Step 2: See it fail, then map checks**

Request `fields=id,status,issues,vcs,checks`. Map required checks the way the cycle spec says. Do not force `checks: []`.

- [ ] **Step 3: Run `node --test`**

Expected: PASS

### Task 4: Commit in Arcadia

```bash
# from the arcadia mount, only the adapters directory
arc add ai/artifacts/skills/teams/lavka/sdd/sdd-flow/scripts/adapters
arc commit -m "Add Tracker, Arcanum, and arc adapters beside the sdd skill."
```

Do not add these files under `devops/remote-solver`.
