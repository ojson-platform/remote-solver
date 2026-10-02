# SDD Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `pnpm build` writes the chat file and the spy file, `tsx` leaves `dependencies`, and the tarball carries only built files and skills.

**Architecture:** esbuild bundles `src/sdd.ts` into `skills/sdd-flow/scripts/sdd.mjs` and `src/cli.ts` into `bin/remote-solver.mjs`, both ESM with a shebang. The chat file has no sandcastle import because the machine no longer builds a runtime (package plan Task 2). The spy file keeps `@ai-hero/sandcastle` external. Adapter directories are not bundled. The build script takes `--outdir` so tests do not touch committed files.

**Tech Stack:** esbuild, Node.js, vitest.

Depends on package plan Tasks 2, 3, and 6: without them the chat entry imports sandcastle.

## Global Constraints

- Публичный пакет не импортирует Трекер, Арканум и arc. Ключа `host` нет.
- Машина чата — `skills/sdd-flow/scripts/sdd.mjs`. Шпион — `bin/remote-solver.mjs` пакета `@ojson/remote-solver`.
- `createAdapters(root, config)` возвращает `{config?, tracker, review, vcs}`. Runtime строит пакет.
- Каталог артефактов — `ai/artifacts/skills/teams/lavka/sdd`. Пресет — `ai/artifacts/presets/lavka/sdd.yaml`.
- Коммит в remote-solver — одна фраза, без префикса `feat:`.
- Проверка пакета: `pnpm test -- <файл>` из `devops/remote-solver`.

---

### Task 1: build script with two entries

**Files:**
- Create: `scripts/build-sdd.mjs`
- Modify: `package.json` (script `build`, devDependency `esbuild`)
- Test: `src/adapters/bundle.test.ts`

**Interfaces:**
- Consumes: `src/sdd.ts`, `src/cli.ts`
- Produces: `skills/sdd-flow/scripts/sdd.mjs` and `bin/remote-solver.mjs`; with `--outdir <dir>`, `<dir>/sdd.mjs` and `<dir>/remote-solver.mjs`.

- [ ] **Step 1: Write the failing test**

`src/adapters/bundle.test.ts` spawns `node scripts/build-sdd.mjs --outdir <tmp>` with the package root as cwd. Then:

- `node <tmp>/sdd.mjs` with no args: exit code is not 0, output includes `Usage: sdd`. The file text does not contain `@ai-hero/sandcastle`.
- `node <tmp>/remote-solver.mjs` with no args: exit code is not 0, output includes `remote-solver spy`. The file text contains `from "@ai-hero/sandcastle"` (an external import, not the library body).
- `git status --porcelain` for `skills/sdd-flow/scripts` and `bin` is unchanged by the test run.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/adapters/bundle.test.ts`

Expected: FAIL, `scripts/build-sdd.mjs` is missing.

- [ ] **Step 3: Write the build**

```js
import * as esbuild from 'esbuild';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outdirFlag = process.argv.indexOf('--outdir');
const outdir = outdirFlag === -1 ? null : path.resolve(process.argv[outdirFlag + 1]);

const target = (committed, name) => (outdir ? path.join(outdir, name) : path.join(root, committed));

const common = {absWorkingDir: root, bundle: true, platform: 'node', format: 'esm', banner: {js: '#!/usr/bin/env node'}};

await esbuild.build({...common, entryPoints: ['src/sdd.ts'], outfile: target('skills/sdd-flow/scripts/sdd.mjs', 'sdd.mjs')});
await esbuild.build({
  ...common,
  entryPoints: ['src/cli.ts'],
  outfile: target('bin/remote-solver.mjs', 'remote-solver.mjs'),
  external: ['@ai-hero/sandcastle'],
});
```

`package.json` script `"build": "node scripts/build-sdd.mjs"`. Install the builder with `pnpm add -D esbuild`. Do not add it to `dependencies`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/adapters/bundle.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml scripts/build-sdd.mjs src/adapters/bundle.test.ts
git commit -m "$(cat <<'EOF'
Build the chat machine and the spy with esbuild.

EOF
)"
```

### Task 2: bins, files, and no tsx

**Files:**
- Modify: `package.json` (`bin`, `files`, remove `tsx`)
- Delete: `bin/sdd.mjs`
- Replace: `bin/remote-solver.mjs` with the build output
- Create: `skills/sdd-flow/scripts/sdd.mjs` (build output)
- Test: `src/adapters/bundle.test.ts`

**Interfaces:**
- Consumes: Task 1
- Produces: `npm pack --dry-run --json` lists `bin/remote-solver.mjs`, `prompts/sdd.md`, `skills/sdd-init/SKILL.md`, `skills/sdd-flow/SKILL.md`, `skills/sdd-flow/CONTEXT.md`, `skills/sdd-flow/steps/*.md`, `skills/sdd-flow/scripts/sdd.mjs`, and nothing under `src/`. `dependencies` has `@ai-hero/sandcastle` and no `tsx`.

- [ ] **Step 1: Write the failing test**

Extend `src/adapters/bundle.test.ts`. Read `package.json`: `bin.sdd` is `./skills/sdd-flow/scripts/sdd.mjs`, `bin['remote-solver']` is `./bin/remote-solver.mjs`, `dependencies.tsx` is undefined. Spawn `npm pack --dry-run --json` in the package root and check the file list as above. Assert `bin/sdd.mjs` does not exist.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/adapters/bundle.test.ts`

Expected: FAIL, `tsx` is still a dependency and `src/` is packed.

- [ ] **Step 3: Implement**

`package.json`:

```json
"bin": {
  "remote-solver": "./bin/remote-solver.mjs",
  "sdd": "./skills/sdd-flow/scripts/sdd.mjs"
},
"files": [
  "bin/remote-solver.mjs",
  "prompts",
  "skills/sdd-init",
  "skills/sdd-flow/SKILL.md",
  "skills/sdd-flow/CONTEXT.md",
  "skills/sdd-flow/steps",
  "skills/sdd-flow/scripts/sdd.mjs"
]
```

`pnpm remove tsx`. Delete `bin/sdd.mjs`. Run `pnpm build` so `bin/remote-solver.mjs` becomes the bundle and `skills/sdd-flow/scripts/sdd.mjs` exists. The argv guards in `sdd.ts` and `cli.ts` accept `.mjs` (package plan Task 6).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/adapters/bundle.test.ts`. Then `pnpm test`.

Expected: PASS. `node bin/remote-solver.mjs` and `node skills/sdd-flow/scripts/sdd.mjs` run from the repository without `tsx`.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml bin/remote-solver.mjs skills/sdd-flow/scripts/sdd.mjs src/adapters/bundle.test.ts
git add -u bin/sdd.mjs
git commit -m "$(cat <<'EOF'
Ship the built files, drop tsx, and keep source out of the tarball.

EOF
)"
```

### Task 3: CI keeps the committed bundles fresh

**Files:**
- Modify: the CI workflow this package already runs (or the root `package.json` check script if that is where checks live)

- [ ] **Step 1: Add the check**

After install: `pnpm build && git diff --exit-code -- bin skills/sdd-flow/scripts`.

- [ ] **Step 2: Verify**

Run the same two commands locally after Task 2. Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add <workflow file>
git commit -m "$(cat <<'EOF'
Fail CI when the committed bundles are stale.

EOF
)"
```
