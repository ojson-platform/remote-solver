# SDD Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The machine no longer builds a runtime on its own, checkouts go through the `Vcs` port, one `agentRuntime` runs the agent on top of any `Vcs` without sandcastle's `run`, both entrypoints load `adapters/index.mjs` through `openMachine`, and skills call `scripts/sdd.mjs`.

**Architecture:** `machine()` stays synchronous and GitHub-backed for tracker, review, and vcs; `runtime` comes only from options. `agentRuntime` uses `vcs.prepare`/`vcs.tip` and `runAgent`, which drives the sandcastle `AgentProvider` (command, stream parsing, sessions, usage) but not sandcastle's git-bound lifecycle. `openMachine()` looks for `adapters/index.mjs` beside the running script, then for `ai/artifacts/skills/teams/lavka/sdd/sdd-flow/scripts/adapters/index.mjs` walking up from the service root. `sandcastle.yaml` is not read for this. Steps are files under `skills/sdd-flow/steps/`, named by `ACTION_SKILL`.

**Tech Stack:** TypeScript, vitest, Node.js, `@ai-hero/sandcastle` for `AgentProvider` only.

## Global Constraints

- Публичный пакет не импортирует Трекер, Арканум и arc. Ключа `host` нет.
- Машина чата — `skills/sdd-flow/scripts/sdd.mjs`. Шпион — `bin/remote-solver.mjs` пакета `@ojson/remote-solver`.
- `createAdapters(root, config)` возвращает `{config?, tracker, review, vcs}`. Модуль адаптеров импортирует только `node:*`. Runtime строит пакет.
- Каталог артефактов — `ai/artifacts/skills/teams/lavka/sdd`. Пресет — `ai/artifacts/presets/lavka/sdd.yaml`.
- Коммит в remote-solver — одна фраза, без префикса `feat:`.
- Проверка пакета: `pnpm test -- <файл>` из `devops/remote-solver`.

---

### Task 1: find adapters/index.mjs

**Files:**
- Create: `src/adapters/locate.ts`
- Test: `src/adapters/locate.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `adapterFile(scriptPath: string, root: string): string | undefined`. The Arcadia file is `ai/artifacts/skills/teams/lavka/sdd/sdd-flow/scripts/adapters/index.mjs` under an ancestor of `root`. Beside the script it is `<dirname(scriptPath)>/adapters/index.mjs`. Beside the script wins.

- [ ] **Step 1: Write the failing test**

`src/adapters/locate.test.ts`:

```ts
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'vitest';

import {adapterFile} from './locate.ts';

const arcadiaFile = 'ai/artifacts/skills/teams/lavka/sdd/sdd-flow/scripts/adapters/index.mjs';

test('the file beside the script wins, then the arcadia tree above root', () => {
  const mount = mkdtempSync(path.join(tmpdir(), 'arcadia-'));
  const placed = path.join(mount, arcadiaFile);
  mkdirSync(path.dirname(placed), {recursive: true});
  writeFileSync(placed, '');
  const service = path.join(mount, 'taxi/lavka/service');
  mkdirSync(service, {recursive: true});
  assert.equal(adapterFile(path.join(service, 'node_modules/remote-solver/bin/remote-solver.mjs'), service), placed);

  const beside = path.join(mount, 'skills/sdd-flow/scripts/adapters/index.mjs');
  mkdirSync(path.dirname(beside), {recursive: true});
  writeFileSync(beside, '');
  assert.equal(adapterFile(path.join(mount, 'skills/sdd-flow/scripts/sdd.mjs'), service), beside);
  assert.equal(adapterFile(path.join(tmpdir(), 'nope.mjs'), tmpdir()), undefined);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/adapters/locate.test.ts`

Expected: FAIL, `./locate.ts` is not found.

- [ ] **Step 3: Write the minimal implementation**

```ts
import {existsSync} from 'node:fs';
import path from 'node:path';

const ARCADIA = 'ai/artifacts/skills/teams/lavka/sdd/sdd-flow/scripts/adapters/index.mjs';

export function adapterFile(scriptPath: string, root: string): string | undefined {
  const beside = path.join(path.dirname(scriptPath), 'adapters', 'index.mjs');
  if (existsSync(beside)) {
    return beside;
  }
  let dir = path.resolve(root);
  for (;;) {
    const candidate = path.join(dir, ARCADIA);
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return undefined;
    }
    dir = parent;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/adapters/locate.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/adapters/locate.ts src/adapters/locate.test.ts
git commit -m "$(cat <<'EOF'
Find the Arcadia adapter file beside the script or above the service.

EOF
)"
```

### Task 2: the machine stops building a runtime

**Files:**
- Modify: `src/adapters/compose.ts` (`Machine.runtime?`, no runtime import, `solverRoot` walks to the package)
- Modify: `src/machine/port.ts` (`SkillRun.mode`, `SkillRun.resumeSession?`, `SkillOutcome.sessionId?/usage?`, `Runtime.ask` returns `AgentResult`)
- Modify: `src/main.ts` (`driveIssue` computes `mode`, requires `box.runtime`)
- Modify: `src/reviewer/run.ts`, `src/reviewer/judge.ts` (require `box.runtime`; `ask(...).text`)
- Test: `src/adapters/compose.test.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `machine(root, options)` returns `runtime` only when `options.runtime` is given. `SkillRun` has `mode: SkillMode`.

- [ ] **Step 1: Write the failing test**

`src/adapters/compose.test.ts`: `machine(tmpdir)` has `runtime === undefined`. `machine(tmpdir, {runtime: fake})` returns that fake. Read `src/adapters/compose.ts` as text and assert it does not contain `runtime.ts`, `agent.ts`, or `@ai-hero/sandcastle`. `solverRoot()` ends with `devops/remote-solver` when called from the test.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/adapters/compose.test.ts`

Expected: FAIL, `machine()` builds a sandcastle runtime.

- [ ] **Step 3: Implement**

`compose.ts`: drop the `sandcastleRuntime` import; `runtime: options.runtime`. `solverRoot()` walks up from `import.meta.url` until a `package.json` with `"name": "@ojson/remote-solver"`; if none, returns two directories above the running file.

`port.ts`:

```ts
export type AgentUsage = {inputTokens: number; cacheCreationInputTokens: number; cacheReadInputTokens: number; outputTokens: number};
export type AgentResult = {text: string; sessionId?: string; sessionFilePath?: string; usage?: AgentUsage};
export type SkillRun = {skill: string; action: string; key: IssueKey; phase: string; pull: string; mode: SkillMode; resumeSession?: string};
export type SkillOutcome = {commits: number; sessionId?: string; usage?: AgentUsage};
export type Runtime = {run(skill: SkillRun): Promise<SkillOutcome>; ask(request: RuntimeAsk): Promise<AgentResult>};
```

`main.ts`: `driveIssue` reads `const runtime = box.runtime; if (!runtime) throw new Error('runtime is not configured');` once at the top, passes `mode: modeOfSkill(path.join(solverRoot(), 'skills/sdd-flow/steps'), decision.skill)`, and logs `sessionId` and `usage` when present. `reviewer/run.ts` does the same check; `judge.ts` reads `(await runtime.ask(...)).text`.

The old `runtime.ts` keeps compiling in this task by returning `{text}` from `ask`; it is replaced in Task 5.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/adapters/compose.test.ts`. Then `pnpm test`.

Expected: PASS. Tests that built `machine()` and read `runtime` now pass a fake runtime.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/compose.ts src/adapters/compose.test.ts src/machine/port.ts src/main.ts src/reviewer/run.ts src/reviewer/judge.ts src/adapters/runtime.ts
git commit -m "$(cat <<'EOF'
Take the runtime from the caller instead of building it in the machine.

EOF
)"
```

### Task 3: checkouts through the Vcs port

**Files:**
- Modify: `src/machine/port.ts` (`Vcs.prepare`, `Vcs.tip`, `Link`)
- Modify: `src/adapters/vcs.ts` (`gitVcs.prepare`, `gitVcs.tip`, `packageLinks`)
- Modify: `src/adapters/runtime.ts` (`linkCommand` builds from `Link[]`)
- Modify: `src/sdd.ts` (`worktree()` calls `box.vcs.prepare`)
- Test: `src/adapters/vcs.test.ts`

**Interfaces:**
- Consumes: `prepareCheckout`, `linkCommand`
- Produces: `Vcs.prepare(key, {worktreesDir, links}): string`; `Vcs.tip(key): string`; `packageLinks(solverRoot): Link[]` with `{from, to}` for `skills`, `prompts`, `.env` that exist.

- [ ] **Step 1: Write the failing test**

In `src/adapters/vcs.test.ts`: on a temp git repo with one commit, `gitVcs(root).prepare('7', {worktreesDir, links: [{from: someDir, to: 'skills'}]})` returns a directory on branch `sdd/7` whose `.sandcastle/skills` is a symlink to `someDir`, and `info/exclude` has `/.sandcastle/`. Calling it again returns the same path. `tip('7')` equals `git rev-parse sdd/7`; `tip('nope')` throws. `packageLinks(dirWithSkillsOnly)` returns one link.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/adapters/vcs.test.ts`

Expected: FAIL, `prepare` is not a function.

- [ ] **Step 3: Implement**

`gitVcs.prepare` wraps `prepareCheckout` and `linkCommand(links, serviceRoot)`. `gitVcs.tip` is `git rev-parse --verify <branch>`. `worktree()` in `sdd.ts` becomes:

```ts
const dir = box.vcs.prepare(key, {worktreesDir: SESSION_WORKTREES, links: packageLinks(solverRoot())});
```

and the `prepareCheckout` import leaves `sdd.ts`. `linkCommand` moves to `vcs.ts` so `sdd.ts` does not import `runtime.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/adapters/vcs.test.ts`. Then `pnpm test`.

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/machine/port.ts src/adapters/vcs.ts src/adapters/vcs.test.ts src/adapters/runtime.ts src/sdd.ts
git commit -m "$(cat <<'EOF'
Prepare checkouts through the Vcs port.

EOF
)"
```

### Task 4: runAgent on the sandcastle AgentProvider

**Files:**
- Create: `src/adapters/agent.ts`
- Modify: `src/machine/skill.ts` (`agentFor(mode): AgentProvider`)
- Modify: `src/adapters/host-sandbox.ts` (keep `openHostHandle`; delete `hostSandbox` and `skipsGlobalGitConfig`)
- Test: `src/adapters/agent.test.ts`; trim `src/adapters/host-sandbox.test.ts`

**Interfaces:**
- Consumes: `AgentProvider` from `@ai-hero/sandcastle`; `openHostHandle` as `BindMountSandboxHandle`
- Produces: `runAgent(run: AgentRun): Promise<AgentResult>`, `AgentRun` from the package spec; `agentFor(mode)` returns `cursor(modelFor(mode))`.

- [ ] **Step 1: Write the failing test**

`agent.test.ts` uses a hand-written `AgentProvider` fake, not `cursor()`:

- `buildPrintCommand` records its options and returns `{command: 'fake-agent'}`; a fake `fake-agent` executable on `PATH` records cwd and prints three lines: `{"kind":"session","id":"s1"}`, `{"kind":"text","text":"hello <answer>42</answer>"}`, `{"kind":"result"}`.
- `parseStreamLine` maps those lines to `session_id`, `text`, `result` events.
- `captureSessions: true`, `sessionStorage` fake records `captureToHost` arguments and returns a JSONL for `readHostSession`; `parseSessionUsage` returns `{inputTokens: 1, cacheCreationInputTokens: 0, cacheReadInputTokens: 0, outputTokens: 2}`.

Assert `runAgent({cwd, hostCwd, provider, name: 'x', promptFile, promptArgs: {ISSUE: '7'}, logPath, outputTag: 'answer', resumeSession: 's0'})`:

- `buildPrintCommand` got the prompt with `7` substituted for `{{ISSUE}}`, `dangerouslySkipPermissions: true`, `resumeSession: 's0'`;
- `resumeIntoSandbox` was called before the process started with `sessionId: 's0'`;
- the fake ran in `cwd`;
- the result is `{text: '42', sessionId: 's1', sessionFilePath: <from fake>, usage: {inputTokens: 1, …}}`;
- `captureToHost` was called with `hostCwd`, `sandboxCwd: cwd`, `sessionId: 's1'`;
- the log file is not empty.

Second test: a provider with `captureSessions: false` and no `sessionStorage` returns `{text}` only. Third: a fake that exits 3 makes `runAgent` reject. Fourth: a fake that prints `result` and then sleeps makes `runAgent` resolve within a short `resultGraceMs` test override (default 60 s in code). Fifth: `.sandcastle/.env` under `hostCwd` with `CURSOR_API_KEY=k` reaches the child env.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/adapters/agent.test.ts`

Expected: FAIL, `./agent.ts` is not found.

- [ ] **Step 3: Implement**

`runAgent` follows the package spec order: substitute `{{KEY}}`; `resumeIntoSandbox` when asked and available; `buildPrintCommand({prompt, dangerouslySkipPermissions: true, resumeSession, forkSession})`; spawn `sh -c <command>` in `cwd` with `process.env`, the parsed `<hostCwd>/.sandcastle/.env`, and `provider.env`; pipe `stdin` if the command has one; feed stdout lines to `parseStreamLine`; render events to `logPath` with `renderAgentEvent` (moved into `agent.ts`); remember `session_id`; stop on exit, or 60 s after `result`, or after `idleTimeoutSeconds` of silence (reject); after success run `captureToHost`, `hostSessionFilePath`, `readHostSession`, `parseSessionUsage` when the provider supports them; return the `outputTag` slice or the whole text. The handle for `sessionStorage` is `openHostHandle(cwd)`.

`skill.ts`: `export function agentFor(mode: SkillMode): AgentProvider { return cursor(modelFor(mode)); }`.

`host-sandbox.ts`: keep `openHostHandle` and `spawnShell`; delete `hostSandbox` and `skipsGlobalGitConfig`; drop their tests.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/adapters/agent.test.ts`. Then `pnpm test`.

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/adapters/agent.ts src/adapters/agent.test.ts src/machine/skill.ts src/adapters/host-sandbox.ts src/adapters/host-sandbox.test.ts
git commit -m "$(cat <<'EOF'
Run the agent through the sandcastle provider without its git lifecycle.

EOF
)"
```

### Task 5: agentRuntime replaces sandcastleRuntime

**Files:**
- Rewrite: `src/adapters/runtime.ts` (`agentRuntime`, `agentLogPath`, `ensureServiceEnv`; no `run`, `cursor`, `Output`, `hostSandbox`)
- Test: `src/adapters/runtime.test.ts`

**Interfaces:**
- Consumes: `Vcs.prepare`, `Vcs.tip`, `Vcs.compare`, `runAgent`, `agentFor`, `packageLinks`
- Produces: `agentRuntime({root, vcs, config, solverRoot}): Runtime`

- [ ] **Step 1: Write the failing test**

Fake `vcs`: `prepare` returns a temp dir and records arguments; `tip` returns `aaa` then `ccc`; `compare('aaa', 'ccc')` returns `{commits: 'c1\nc2\n', diff: ''}`. Inject `runAgent` through an optional `agent` option on `agentRuntime` and record its argument.

- `run({skill: 'plan', action: 'create-proposal', key: '7', phase: 'proposing', pull: '', mode: 'judgment'})`: `prepare` called with key `7`, `worktreesDir` under `<root>/.sandcastle/worktrees`, and `packageLinks(solverRoot)`; `runAgent` called with `cwd` = prepared dir, `hostCwd: root`, `promptFile: <solverRoot>/prompts/sdd.md`, `promptArgs` `{ISSUE: '7', ACTION, PHASE, PR, SKILL: 'plan', QUEUE: config.queueLabel, BASE: config.prBase}`, `logPath` = `agentLogPath(root, 'sdd/7', 'create-proposal')`; result is `{commits: 2, sessionId, usage}` as returned by the fake agent.
- `ask({name: 'review', mode: 'judgment', promptFile: '/p/review.md', promptArgs: {}, branch: 'sdd/7', outputTag: 'verdict'})`: `prepare` called with key `7`; `runAgent` called with `outputTag: 'verdict'`; returns the agent result.
- The file `src/adapters/runtime.ts` does not contain `from '@ai-hero/sandcastle'` except a `type` import.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/adapters/runtime.test.ts`

Expected: FAIL, `agentRuntime` is not exported.

- [ ] **Step 3: Implement**

Rewrite `runtime.ts` to the spec. `linkCommand` already lives in `vcs.ts` (Task 3). Keep `agentLogPath` and `ensureServiceEnv`. Delete the sandcastle `run` call, `hostSandbox`, `Output`, and the `LINKED` table.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/adapters/runtime.test.ts`. Then `pnpm test`.

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/adapters/runtime.ts src/adapters/runtime.test.ts
git commit -m "$(cat <<'EOF'
Drive the agent on top of the Vcs port instead of sandcastle run.

EOF
)"
```

### Task 6: openMachine

**Files:**
- Create: `src/adapters/load.ts`
- Test: `src/adapters/load.test.ts`
- Modify: `src/sdd.ts` (bottom block uses `openMachine(process.cwd())`)
- Modify: `src/cli.ts` (`runCli` opens the machine once with `agentRuntime` and passes it on)
- Modify: `src/main.ts` (`runIssue`, `runSpy` take a `Machine`)

**Interfaces:**
- Consumes: `adapterFile`, `machine`, `agentRuntime`
- Produces: `openMachine(root, {runtime?}): Promise<Machine>` from the package spec.

- [ ] **Step 1: Write the failing test**

`src/adapters/load.test.ts`:

```ts
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'vitest';

import {openMachine} from './load.ts';

const file = 'ai/artifacts/skills/teams/lavka/sdd/sdd-flow/scripts/adapters/index.mjs';

function plant(mount: string, body: string): string {
  const placed = path.join(mount, file);
  mkdirSync(path.dirname(placed), {recursive: true});
  writeFileSync(placed, body);
  const root = path.join(mount, 'taxi/lavka/service');
  mkdirSync(root, {recursive: true});
  return root;
}

const module = `export function createAdapters(root, config) {
  return {
    config: {queueLabel: 'LAVKA', defaultBranch: 'trunk', prBase: 'trunk'},
    tracker: {login: () => 'from-adapter'},
    review: {},
    vcs: {marker: 'arc'},
  };
}\n`;

test('adapters replace the ports and the config; the runtime is built over their vcs', async () => {
  const root = plant(mkdtempSync(path.join(tmpdir(), 'sdd-adapters-')), module);
  const chat = await openMachine(root);
  assert.equal(chat.tracker.login(), 'from-adapter');
  assert.equal(chat.config.queueLabel, 'LAVKA');
  assert.equal(chat.config.prBase, 'trunk');
  assert.equal(chat.runtime, undefined);

  const seen: unknown[] = [];
  const fake = {run: async () => ({commits: 0}), ask: async () => ({text: ''})};
  const spy = await openMachine(root, {runtime: box => (seen.push(box.vcs), fake)});
  assert.equal(spy.runtime, fake);
  assert.deepEqual(seen, [{marker: 'arc'}]);
});

test('without the adapter file the ports stay GitHub and git', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'sdd-plain-'));
  const box = await openMachine(root);
  assert.equal(box.config.queueLabel, 'Sandcastle');
  assert.equal(box.runtime, undefined);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/adapters/load.test.ts`

Expected: FAIL, module `./load.ts` is not found.

- [ ] **Step 3: Write the minimal implementation**

`load.ts` as in the package spec. `sdd.ts` bottom:

```ts
if (process.argv[1]?.endsWith('sdd.ts') || process.argv[1]?.endsWith('sdd.mjs')) {
  runSdd(process.argv.slice(2), await openMachine(process.cwd()));
}
```

`runSdd`'s default argument stays `machine()` so unit tests that pass no box keep GitHub ports.

`cli.ts`:

```ts
const box = await openMachine(process.cwd(), {
  runtime: built => agentRuntime({root: built.root, vcs: built.vcs, config: built.config, solverRoot: solverRoot()}),
});
```

passed to `runSpy`, `driveIssue`, and `runReview`. The argv guard in `cli.ts` accepts `cli.ts` and `remote-solver.mjs`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/adapters/load.test.ts`. Then `pnpm test`.

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/adapters/load.ts src/adapters/load.test.ts src/sdd.ts src/cli.ts src/main.ts
git commit -m "$(cat <<'EOF'
Load cycle adapters from the Arcadia adapter file.

EOF
)"
```

### Task 7: steps inside sdd-flow

**Files:**
- Modify: `src/machine/route.ts` (`ACTION_SKILL` values without the `sdd-` prefix)
- Move: `prompts/context.md` → `skills/sdd-flow/CONTEXT.md`
- Move: `skills/sdd-<name>/SKILL.md` → `skills/sdd-flow/steps/<name>.md` for every step; delete the emptied directories
- Modify: `skills/sdd-flow/SKILL.md`, `skills/sdd-init/SKILL.md`
- Modify: `prompts/sdd.md`
- Modify: `src/machine/skill.ts` (`modeOfSkill(stepsDir, skill)` reads `<stepsDir>/<skill>.md`)
- Rewrite: `src/machine/skill.test.ts`

**Interfaces:**
- Consumes: the path and naming rules in the package spec
- Produces: `Skill` is the union of step file names.

- [ ] **Step 1: Write the failing tests**

Rewrite `src/machine/skill.test.ts`:

- `skills/` has exactly `sdd-flow` and `sdd-init`.
- Every `skills/sdd-flow/steps/*.md`: first line matches `^mode: (mechanical|judgment)$`; `modelFor(skillMode(body))` maps `mechanical` to `composer-2.5-fast` and `judgment` to `grok-4.7-high-fast`; mechanical steps are exactly `tasks`, `implement`, `fix`, `pr-comments`; has a `## Stop` section naming Publish, Wait, or Hand-off; mentions `CONTEXT.md`; names no other step (regex on the other file names).
- The set of step file names equals the set of `ACTION_SKILL` values.
- The Actions table in `skills/sdd-flow/SKILL.md` maps to `ACTION_SKILL`.
- `sdd-flow/SKILL.md`, `CONTEXT.md`, every step: no `npx sdd`, no `pnpm`, no `Sandcastle`, no `master`; `CONTEXT.md` and `SKILL.md` contain `node scripts/sdd.mjs`. `sdd-init/SKILL.md` contains `node ../sdd-flow/scripts/sdd.mjs`.
- `modeOfSkill(stepsDir, 'tasks')` is `mechanical`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/machine/skill.test.ts`

Expected: FAIL, step directories still exist and files contain `npx sdd`.

- [ ] **Step 3: Move and rewrite**

`route.ts`: `'create-proposal': 'plan'`, …, `archive: 'accept'`. Fix whatever the compiler flags.

Move each `skills/sdd-<name>/SKILL.md` to `skills/sdd-flow/steps/<name>.md`: drop the frontmatter, keep `mode: …` as the first line, keep the body. Replace every `npx sdd` with `node scripts/sdd.mjs`. Replace `context.md` references with `CONTEXT.md`.

`skills/sdd-flow/SKILL.md`: commands are `node scripts/sdd.mjs step <key>` and `node scripts/sdd.mjs worktree <key>`; the Actions table names steps `plan`, `specify`, …; the router opens `steps/<name>.md` instead of naming another skill.

`skills/sdd-init/SKILL.md` stage 5:

- `sandcastle.yaml` still gets `comments.ignore`.
- GitHub: `npm install` this package so `remote-solver` is the spy. The chat uses `node scripts/sdd.mjs` from the `sdd-flow` skill.
- Arcadia: do not skip the stage. The preset `lavka/sdd` already linked the skills. `npm install` the same package for the spy. Do not write an adapters path into `sandcastle.yaml`. The file `sdd-flow/scripts/adapters/index.mjs` is placed once in `ai/artifacts`.

The table row "The cycle after this skill / does not run" becomes "runs. The spy is `remote-solver` from the package. The chat is `scripts/sdd.mjs` from the skill."

`prompts/sdd.md`: read `.sandcastle/skills/sdd-flow/CONTEXT.md` and `.sandcastle/skills/sdd-flow/steps/{{SKILL}}.md`.

`skill.ts`: `modeOfSkill(stepsDir, skill)` reads `path.join(stepsDir, `${skill}.md`)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/machine/skill.test.ts`. Then `pnpm test`.

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A skills prompts src/machine/route.ts src/machine/skill.ts src/machine/skill.test.ts
git commit -m "$(cat <<'EOF'
Fold the step skills into sdd-flow and point them at the sdd file.

EOF
)"
```
