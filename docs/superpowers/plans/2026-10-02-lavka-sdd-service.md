# Lavka SDD Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One Lavka service links the preset and runs the chat machine from the skill and the spy from npm.

**Architecture:** No new package code. The service extends `lavka/sdd` and installs `@ojson/remote-solver`. Adapters come from the file already placed under `ai/artifacts`. The service `sandcastle.yaml` does not name them.

**Tech Stack:** aisuite, npm, the built `sdd.mjs`.

## Global Constraints

- Публичный пакет не импортирует Трекер, Арканум и arc. Ключа `host` нет.
- Машина чата — `skills/sdd-flow/scripts/sdd.mjs`. Шпион — `bin/remote-solver.mjs` пакета `@ojson/remote-solver`.
- `createAdapters(root, config)` возвращает `{config?, tracker, review, vcs}`. Runtime строит пакет.
- Каталог артефактов — `ai/artifacts/skills/teams/lavka/sdd`. Пресет — `ai/artifacts/presets/lavka/sdd.yaml`.
- Коммит в remote-solver — одна фраза, без префикса `feat:`. Правка сервиса коммитится в репозиторий сервиса.
- Проверка пакета: `pnpm test -- <файл>` из `devops/remote-solver`.

Зависит от готовых `sync.sh` и `sdd.mjs`. Адаптеры включаются файлом `sdd-flow/scripts/adapters/index.mjs` в артефактах, не настройкой сервиса.

---

### Task 1: Extend the preset

**Files:**
- Modify: the service `aisuite.yaml`

- [ ] **Step 1: Add the preset**

`extends` includes `lavka/sdd` next to the presets the service already has. Do not remove `lavka/openspec` if it is there.

- [ ] **Step 2: Install skills**

Run the service's usual `ya tool aisuite setup` (or the command that service already documents).

Expected: a symlink whose target is `ai/artifacts/skills/teams/lavka/sdd/sdd-flow`, and `scripts/sdd.mjs` is reachable through it.

- [ ] **Step 3: Run the linked file**

```bash
node <symlink>/scripts/sdd.mjs
```

Expected: exit code is not 0, output contains `Usage: sdd`.

### Task 2: Install the spy

**Files:**
- Modify: the service package manifest that already installs npm dependencies

- [ ] **Step 1: Add the dependency**

`@ojson/remote-solver` at the version that contains the spy bin. Install with the service's package manager.

- [ ] **Step 2: Run the bin**

```bash
remote-solver
```

Expected: exit code is not 0, output contains `remote-solver spy` and does not contain `Usage: sdd`.

### Task 3: Confirm the adapter file is the one in artifacts

**Files:**
- Modify: none in the service for adapters. Leave `sandcastle.yaml` without an adapters path.

- [ ] **Step 1: Check the placed file**

From the service directory, this path must exist when adapters have been committed:

`ai/artifacts/skills/teams/lavka/sdd/sdd-flow/scripts/adapters/index.mjs`

resolved by walking parents of the service root. The service `sandcastle.yaml` has no `adapters:` line.

- [ ] **Step 2: Check the checkout the spy prepares**

If the service documents an `arc-wt` path filter, it must include `ai/artifacts/skills/teams/lavka/sdd`. Otherwise the chat file inside the spy's checkout finds no adapters and falls back to GitHub ports. Open a checkout the way the adapter does and confirm the path above exists in it.

- [ ] **Step 3: Commit the service**

One commit in the service repository: the preset and the npm dependency.
