# Service config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read queue, base, branch prefix, and ignored authors from the service `openspec/config.yaml`, and stop reading or creating `sandcastle.yaml`.

**Architecture:** `loadServiceConfig(serviceRoot)` is the only reader. `openMachine` calls it before ports and before `createAdapters`. The adapter receives that config and does not replace queues, base, or prefix. Cycle membership is `sdd:cycle` plus any configured queue name. `.sandcastle/` stays.

**Tech Stack:** TypeScript, vitest, Node, the `yaml` package bundled by esbuild. Arcadia adapters are plain `.mjs` tested with `node --test`.

## Global Constraints

- Config path is `<service root>/openspec/config.yaml`. The service root is the `sdd` process directory.
- Missing file, missing `sdd`, missing `queues`, an empty `queues` list, or an element without `name` stops the command and names what is missing.
- Absent `base` is `trunk`. Absent `branch-scope` is `sdd`. Absent `ignore-comments` is an empty list. `description` may be omitted.
- `base` is the branch name. A pull request opens against it. Git cuts `origin/<base>`. Arc cuts `<base>`.
- `branch-scope` is the prefix. The issue branch is `<prefix>/<key>`.
- `ignore-comments` entries are case-insensitive regular expressions. A pattern that does not compile names the key `ignore-comments`.
- The cycle reads every configured queue. Two queue names on one issue: the earlier name in the file wins. JSON `queue` is that issue's queue. JSON `base` is the service base. A decision with no issue uses the first queue.
- The first queue is where a new child issue is created. `decide` and `settle` do not read descriptions.
- `sandcastle.yaml` is not read and `sdd-init` does not create it. An existing file is left on disk. `.sandcastle/` is unchanged.
- `createAdapters` does not return its own queue or base.
- OpenSpec CLI 1.14.0 ignores the `sdd` key. `schema`, `context`, and `rules` stay valid.

---

### Task 1: Parse `openspec/config.yaml`

**Files:**
- Create: `src/machine/service-config.ts`
- Create: `src/machine/service-config.test.ts`
- Modify: `package.json` (add dependency `yaml`)
- Test: `src/machine/service-config.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `export type QueueConfig = {name: string; description?: string}` and `export type ServiceConfig = {queues: QueueConfig[]; base: string; branchScope: string; ignoreComments: RegExp[]}`. `export function loadServiceConfig(serviceRoot: string): ServiceConfig`.

- [ ] **Step 1: Add the YAML parser**

Run: `pnpm add yaml`
Expected: `yaml` appears in `dependencies`.

- [ ] **Step 2: Write the failing tests**

```ts
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'vitest';

import {loadServiceConfig} from './service-config.ts';

function service(body: string | undefined): string {
  const root = mkdtempSync(path.join(tmpdir(), 'sdd-config-'));
  if (body !== undefined) {
    mkdirSync(path.join(root, 'openspec'));
    writeFileSync(path.join(root, 'openspec', 'config.yaml'), body);
  }
  return root;
}

const queues = `sdd:\n  queues:\n    - name: LAVKAOPSCORE\n      description: Ordinary work\n    - name: OTHER\n`;

test('missing optional keys take trunk, sdd, and no ignored authors', () => {
  const config = loadServiceConfig(service(`schema: spec-driven\n${queues}`));
  assert.equal(config.base, 'trunk');
  assert.equal(config.branchScope, 'sdd');
  assert.deepEqual(config.ignoreComments.map(pattern => pattern.source), []);
  assert.deepEqual(config.queues, [
    {name: 'LAVKAOPSCORE', description: 'Ordinary work'},
    {name: 'OTHER'},
  ]);
});

test('base, branch-scope, and ignore-comments are read', () => {
  const config = loadServiceConfig(
    service(`${queues}  base: master\n  branch-scope: feature\n  ignore-comments:\n    - dependabot\n`),
  );
  assert.equal(config.base, 'master');
  assert.equal(config.branchScope, 'feature');
  assert.equal(config.ignoreComments[0].test('Dependabot[bot]'), true);
  assert.equal(config.ignoreComments[0].test('reviewer'), false);
});

test('a missing file, a missing sdd key, and a queue without a name stop', () => {
  assert.throws(() => loadServiceConfig(service(undefined)), /openspec\/config.yaml is missing/);
  assert.throws(() => loadServiceConfig(service('schema: spec-driven\n')), /sdd is missing/);
  assert.throws(() => loadServiceConfig(service('sdd:\n  base: trunk\n')), /queues is missing/);
  assert.throws(() => loadServiceConfig(service('sdd:\n  queues: []\n')), /queues is empty/);
  assert.throws(() => loadServiceConfig(service('sdd:\n  queues:\n    - description: no name\n')), /queue name is missing/);
  assert.throws(
    () => loadServiceConfig(service('sdd:\n  queues:\n    - name: Q\n  ignore-comments:\n    - "("\n')),
    /ignore-comments/,
  );
});
```

The third fixture in the second test must be one YAML document. Write it as a single template literal with `sdd:` once, `queues` first, then `base`, `branch-scope`, and `ignore-comments`.

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `./node_modules/.bin/vitest --run src/machine/service-config.test.ts`
Expected: FAIL, `loadServiceConfig` is not defined. The spec-coverage reporter may then exit 1 because the suite is partial. The assertion failure is the signal for this step.

- [ ] **Step 4: Implement the reader**

```ts
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {parse} from 'yaml';

export type QueueConfig = {name: string; description?: string};

export type ServiceConfig = {
  queues: QueueConfig[];
  base: string;
  branchScope: string;
  ignoreComments: RegExp[];
};

export function loadServiceConfig(serviceRoot: string): ServiceConfig {
  const file = path.join(serviceRoot, 'openspec', 'config.yaml');
  if (!existsSync(file)) {
    throw new Error('openspec/config.yaml is missing');
  }
  const raw = parse(readFileSync(file, 'utf8')) as {sdd?: unknown} | null;
  const sdd = raw && typeof raw === 'object' ? raw.sdd : undefined;
  if (!sdd || typeof sdd !== 'object') {
    throw new Error('openspec/config.yaml: sdd is missing');
  }
  const section = sdd as {
    base?: unknown;
    'branch-scope'?: unknown;
    'ignore-comments'?: unknown;
    queues?: unknown;
  };
  if (!Array.isArray(section.queues)) {
    throw new Error('openspec/config.yaml: queues is missing');
  }
  if (section.queues.length === 0) {
    throw new Error('openspec/config.yaml: queues is empty');
  }
  const queues = section.queues.map(item => {
    const record = item && typeof item === 'object' ? (item as {name?: unknown; description?: unknown}) : {};
    if (typeof record.name !== 'string' || record.name === '') {
      throw new Error('openspec/config.yaml: queue name is missing');
    }
    const queue: QueueConfig = {name: record.name};
    if (typeof record.description === 'string') {
      queue.description = record.description;
    }
    return queue;
  });
  const ignoreComments = compileIgnore(section['ignore-comments']);
  return {
    queues,
    base: typeof section.base === 'string' && section.base !== '' ? section.base : 'trunk',
    branchScope:
      typeof section['branch-scope'] === 'string' && section['branch-scope'] !== ''
        ? section['branch-scope']
        : 'sdd',
    ignoreComments,
  };
}

function compileIgnore(value: unknown): RegExp[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    throw new Error('openspec/config.yaml: ignore-comments is missing');
  }
  return value.map(item => {
    try {
      return new RegExp(item, 'i');
    } catch {
      throw new Error(`openspec/config.yaml: ignore-comments pattern ${JSON.stringify(item)} does not compile`);
    }
  });
}
```

A non-array `ignore-comments` throws `ignore-comments is missing`. The broken-regex test expects the message to contain `ignore-comments`.

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `./node_modules/.bin/vitest --run src/machine/service-config.test.ts`
Expected: the three tests PASS. Partial-suite spec-coverage may still exit 1.

- [ ] **Step 6: Confirm OpenSpec ignores the `sdd` key**

Write a temp service with `openspec/config.yaml` that has `schema: spec-driven` and an `sdd` key, plus an empty `openspec/specs` directory if the CLI requires it. Run `openspec validate --no-interactive` in that directory.
Expected: exit 0. The CLI does not reject the unknown key.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml src/machine/service-config.ts src/machine/service-config.test.ts
git commit -m "$(cat <<'EOF'
Read the service sdd settings from openspec/config.yaml.

EOF
)"
```

---

### Task 2: Cycle membership is any configured queue

**Files:**
- Create: `src/machine/queues.ts`
- Create: `src/machine/queues.test.ts`
- Modify: `src/machine/snapshot.ts`
- Modify: `src/machine/flow.ts`
- Modify: `src/machine/flow.test.ts`
- Modify: `src/adapters/compose.ts`
- Modify: `src/openspec.test.ts` (every `queueLabel:` argument)
- Test: `src/machine/queues.test.ts`, `src/machine/flow.test.ts`

**Interfaces:**
- Consumes: `QueueConfig` from `src/machine/service-config.ts`
- Produces: `export function queueOf(labels: readonly string[], queues: readonly QueueConfig[]): QueueConfig | undefined` — the earliest configured queue whose `name` is in `labels`. `loadCycle`, `resolveCycle`, `resolveIssue`, `performIssue`, and `performCycle` take `queues: QueueConfig[]` instead of `queueLabel: string`.

- [ ] **Step 1: Write the failing queue test**

```ts
import assert from 'node:assert/strict';
import {test} from 'vitest';

import {queueOf} from './queues.ts';

const queues = [{name: 'FIRST', description: 'default child'}, {name: 'SECOND'}];

test('the earlier configured queue wins', () => {
  assert.equal(queueOf(['sdd:cycle', 'SECOND', 'FIRST'], queues)?.name, 'FIRST');
  assert.equal(queueOf(['sdd:cycle'], queues), undefined);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `./node_modules/.bin/vitest --run src/machine/queues.test.ts`
Expected: FAIL, `queueOf` is not defined.

- [ ] **Step 3: Implement `queueOf`**

```ts
import type {QueueConfig} from './service-config.ts';

export function queueOf(labels: readonly string[], queues: readonly QueueConfig[]): QueueConfig | undefined {
  return queues.find(queue => labels.includes(queue.name));
}
```

- [ ] **Step 4: Thread `queues` through the cycle**

In `snapshot.ts`, change the last parameter of `loadCycle` to `queues: QueueConfig[]`. Keep an issue when `queueOf(issue.labels, queues)` is defined and `issue.labels` includes `sdd:cycle`.

In `flow.ts`, replace `queueLabel: string` with `queues: QueueConfig[]` on `resolveCycle`, `resolveIssue`, `performIssue`, and `performCycle`. `queueLabelOf` lists issues whose labels include any queue name. The empty-cycle reason is:

```ts
`No open sdd:cycle issues. ${queues.map(queue => queue.name).join(', ')} queue: ${nums}. Add the sdd:cycle label to enter the cycle.`
```

`resolveIssue` finds the record with `issue.key === key`, `queueOf(issue.labels, options.queues)`, and `sdd:cycle`.

`MachineConfig` in `compose.ts` becomes:

```ts
export type MachineConfig = {
  queues: QueueConfig[];
  base: string;
  branchScope: string;
  ignoreComments: RegExp[];
};
```

`machine()` fills `base: 'trunk'`, `branchScope: 'sdd'`, `ignoreComments: []` when those fields are omitted, then throws `openspec/config.yaml: queues is missing` when `queues` is missing or empty. `gitVcs` receives `branchPrefix: config.branchScope` and `defaultBranch: \`origin/${config.base}\``. `githubAdapters` receives `prBase: config.base`. `turn` passes `queues: box.config.queues`.

Replace every `queueLabel: 'Sandcastle'` passed into `loadCycle`, `resolveCycle`, `resolveIssue`, or `performIssue` with `queues: [{name: 'Sandcastle'}]`. Files: `src/machine/flow.test.ts`, `src/openspec.test.ts`.

Add one cycle test in `flow.test.ts`. Two open issues, labels `['FIRST', 'sdd:cycle', 'sdd:proposed']` and `['SECOND', 'sdd:cycle', 'sdd:proposed']`. `loadCycle` with `queues: [{name: 'FIRST'}, {name: 'SECOND'}]` returns both keys. A third issue labeled `['SECOND', 'FIRST', 'sdd:cycle', 'sdd:proposed']` is in the cycle once, and `queueOf` on its labels is `FIRST`.

- [ ] **Step 5: Run the cycle tests**

Run: `./node_modules/.bin/vitest --run src/machine/queues.test.ts src/machine/flow.test.ts src/openspec.test.ts src/adapters/compose.test.ts`
Expected: PASS, apart from the partial-suite spec-coverage exit. `compose.test.ts` still reads `queueLabel` until Task 3; if it fails on the type, update its assertions to `queues` in this same step: a bare `machine(dir)` throws `/queues is missing/`, and a call that needs a queue passes `config: {queues: [{name: 'Sandcastle'}]}`.

- [ ] **Step 6: Commit**

```bash
git add src/machine/queues.ts src/machine/queues.test.ts src/machine/snapshot.ts src/machine/flow.ts src/machine/flow.test.ts src/adapters/compose.ts src/openspec.test.ts src/adapters/compose.test.ts
git commit -m "$(cat <<'EOF'
Match a cycle issue against every configured queue.

EOF
)"
```

---

### Task 3: Load the file at startup and drop `sandcastle.yaml`

**Files:**
- Modify: `src/adapters/load.ts`
- Modify: `src/adapters/load.test.ts`
- Modify: `src/adapters/github.ts`
- Modify: `src/machine/ignore.ts`
- Modify: `src/machine/ignore.test.ts`
- Modify: `src/machine/review.ts` (the comment on `spokeByRobot`)
- Modify: `src/sdd.ts`
- Modify: `src/main.ts`
- Modify: `src/cli.ts`
- Modify: `src/adapters/runtime.ts`
- Test: `src/adapters/load.test.ts`, `src/machine/ignore.test.ts`

**Interfaces:**
- Consumes: `loadServiceConfig`, `ServiceConfig`, `queueOf`
- Produces: `openMachine` loads the file and keeps that config when an adapter module is present. `githubAdapters({prBase, ignoreComments})` does not read a file. `authorIgnored` remains. `parseIgnoredAuthors` and `loadIgnoredAuthors` are deleted. `printStep(decision, box, labels)` writes `queue` from `queueOf(labels, box.config.queues)?.name ?? box.config.queues[0].name` and `base` from `box.config.base`. The agent prompt `QUEUE` is `box.config.queues[0].name`.

- [ ] **Step 1: Rewrite the ignore tests**

Delete the sandcastle file test. Keep a direct `authorIgnored` test:

```ts
test('an ignored pattern is a case-insensitive login expression', () => {
  const patterns = [/sonarqubecloud/i];
  assert.equal(authorIgnored('sonarqubecloud[bot]', patterns), true);
  assert.equal(authorIgnored('SonarQubeCloud', patterns), true);
  assert.equal(authorIgnored('reviewer[bot]', patterns), false);
});
```

`ignore.ts` keeps only `authorIgnored`. Delete `parseIgnoredAuthors` and `loadIgnoredAuthors`.

- [ ] **Step 2: Pass patterns into GitHub**

`GitHubAdapters` is `{prBase?: string; ignoreComments?: RegExp[]}`. `githubAdapters` uses `options.ignoreComments ?? []` and does not import `loadIgnoredAuthors`. `machine()` passes `ignoreComments: config.ignoreComments`. The comment in `review.ts` says the pattern list instead of `sandcastle.yaml`.

- [ ] **Step 3: Load config in `openMachine`**

```ts
export async function openMachine(root: string, options: {runtime?: (box: Omit<Machine, 'runtime'>) => Runtime} = {}): Promise<Machine> {
  const config = loadServiceConfig(root);
  const file = adapterFile(process.argv[1] ?? '', root);
  let built = machine(root, {config});
  if (file) {
    const loaded = (await import(pathToFileURL(file).href)) as AdapterModule;
    const made = loaded.createAdapters(root, built.config);
    built = machine(root, {config, tracker: made.tracker, review: made.review, vcs: made.vcs});
  }
  return {...built, runtime: options.runtime?.(built)};
}
```

Returned `made.config` is not applied.

`load.test.ts` plants this config at `<root>/openspec/config.yaml`:

```yaml
sdd:
  queues:
    - name: FROM-FILE
```

The planted adapter still returns `config: {queueLabel: 'LAVKA', ...}`. Assert `chat.config.queues[0].name === 'FROM-FILE'`, `chat.config.base === 'trunk'`, and `chat.tracker.login()` is `from-adapter`. The test without an adapter file writes the same yaml and asserts `queues[0].name === 'FROM-FILE'`. A root with no yaml rejects `/openspec\/config.yaml is missing/`.

- [ ] **Step 4: Print the issue queue**

`printStep` takes the issue labels. `step` passes `record.labels` on the early return and the labels from `box.tracker.issue` before `turn` for the settled decision. `plan` passes `[]`, so a plan-wide decision prints the first queue. `runtime.ts` and `cli.ts` pass `queues[0].name` as the `QUEUE` placeholder, `branchScope` as `branchPrefix`, and `base` as `prBase`.

Update the openspec step tests that assert `named.queue` and `named.base`. Those tests call `machine(...)` and must pass `config: {queues: [{name: 'Sandcastle'}], base: 'master'}` so the printed fields stay `Sandcastle` and `master`.

- [ ] **Step 5: Run the focused tests**

Run: `./node_modules/.bin/vitest --run src/adapters/load.test.ts src/machine/ignore.test.ts src/sdd.test.ts src/openspec.test.ts src/adapters/github.test.ts`
Expected: PASS, apart from partial-suite spec-coverage.

- [ ] **Step 6: Commit**

```bash
git add src/adapters/load.ts src/adapters/load.test.ts src/adapters/github.ts src/machine/ignore.ts src/machine/ignore.test.ts src/machine/review.ts src/sdd.ts src/main.ts src/cli.ts src/adapters/runtime.ts src/openspec.test.ts
git commit -m "$(cat <<'EOF'
Load service config at startup and stop reading sandcastle.yaml.

EOF
)"
```

---

### Task 4: Tell `sdd-init` to write the `sdd` key

**Files:**
- Modify: `skills/sdd-init/SKILL.md`
- Modify: `docs/superpowers/specs/2026-10-02-sdd-package-design.md`
- Modify: `docs/superpowers/specs/2026-10-02-arcadia-adapters-design.md`
- Modify: `docs/superpowers/specs/2026-10-02-lavka-sdd-service-design.md`
- Modify: `docs/adr/0027-the-chat-machine-travels-with-the-skill.md`

**Interfaces:**
- Consumes: the file shape from Task 1
- Produces: the skill text an agent follows. No new code.

- [ ] **Step 1: Replace stage 5 in `skills/sdd-init/SKILL.md`**

The machine stage says: `openspec/config.yaml` already exists from stage 1. Ask for the queues (each name required, description optional) and which bots comment on pull requests. Write the `sdd` key into that file. `queues` is required. `base`, `branch-scope`, and `ignore-comments` are written only when the service differs from `trunk`, `sdd`, and an empty bot list. Leave `schema`, `context`, and `rules` as they are. Do not create `sandcastle.yaml`. Do not write an adapters path. The rest of the stage (npm install, chat command, Arcadia preset) stays.

- [ ] **Step 2: Update the living specs**

In `2026-10-02-sdd-package-design.md`, the machine stage writes the `sdd` key, not `sandcastle.yaml`. The sentence that says `sandcastle.yaml` remains the service file becomes: service settings are the `sdd` key in `openspec/config.yaml`.

In `2026-10-02-arcadia-adapters-design.md`, `createAdapters` returns `tracker`, `review`, and `vcs`. It does not return `config`. Queues, base, and prefix come from the `config` argument.

In `2026-10-02-lavka-sdd-service-design.md`, the service has no adapters path and no `sandcastle.yaml` requirement. The `sdd` key in its `openspec/config.yaml` names the queues.

In ADR 0027, the sentence that `sandcastle.yaml` does not name the adapters becomes: the service config is the `sdd` key of `openspec/config.yaml`, and that file does not name the adapters.

- [ ] **Step 3: Commit**

```bash
git add skills/sdd-init/SKILL.md docs/superpowers/specs/2026-10-02-sdd-package-design.md docs/superpowers/specs/2026-10-02-arcadia-adapters-design.md docs/superpowers/specs/2026-10-02-lavka-sdd-service-design.md docs/adr/0027-the-chat-machine-travels-with-the-skill.md
git commit -m "$(cat <<'EOF'
Point sdd-init at the sdd key in openspec/config.yaml.

EOF
)"
```

---

### Task 5: Arcadia adapters use the passed config

**Files:**
- Modify: `ai/artifacts/skills/teams/lavka/sdd/sdd-flow/scripts/adapters/index.mjs`
- Modify: `ai/artifacts/skills/teams/lavka/sdd/sdd-flow/scripts/adapters/index.test.mjs`
- Modify: `ai/artifacts/skills/teams/lavka/sdd/sdd-flow/scripts/adapters/tracker.mjs`
- Modify: `ai/artifacts/skills/teams/lavka/sdd/sdd-flow/scripts/adapters/tracker.test.mjs`
- Modify: `ai/artifacts/skills/teams/lavka/sdd/sdd-flow/scripts/adapters/arcanum.mjs`
- Modify: `ai/artifacts/skills/teams/lavka/sdd/sdd-flow/scripts/adapters/arc.mjs` (only if `defaultBranch` is still treated as a remote ref; pass `config.base` through unchanged)
- Test: `node --test` in the adapters directory

This task is in the Arcadia checkout `users/3y3k0/sdd-arcadia`, not in the git package. Commit it with `arc`.

**Interfaces:**
- Consumes: `config.queues`, `config.base`, `config.branchScope`, `config.ignoreComments` as `loadServiceConfig` returns them. `ignoreComments` is a `RegExp[]` in the same process.
- Produces: `createAdapters(root, config)` returns `{tracker, review, vcs}` and no `config`.

- [ ] **Step 1: Write the failing index test**

```js
test('createAdapters uses the passed queues and does not return config', () => {
  const made = createAdapters('/repo', {
    queues: [{name: 'FROM-FILE', description: 'work'}],
    base: 'trunk',
    branchScope: 'sdd',
    ignoreComments: [/robot/i],
  });
  assert.equal('config' in made, false);
  assert.equal(made.tracker.phaseHint('proposing', 'proposed'), 'Предложить');
});
```

The existing test that expects `made.config.queueLabel === 'LAVKAOPSCORE'` is deleted.

- [ ] **Step 2: Run it and confirm it fails**

Run from the adapters directory: `node --test index.test.mjs`
Expected: FAIL, `config` is still returned.

- [ ] **Step 3: Stop hardcoding the queue**

`index.mjs`:

```js
export function createAdapters(root, config) {
  return {
    tracker: trackerAdapter(trackerClient(), {queues: config.queues}),
    review: arcanumAdapter(arcanumClient(), config.ignoreComments ?? []),
    vcs: arcVcs(root, {branchPrefix: config.branchScope, defaultBranch: config.base}, arcRunner(root)),
  };
}
```

`trackerAdapter` options are `{queues: {name: string}[]}`. `issueFrom` keeps `queue: payload.queue?.key ?? ''`. `displayLabels` adds that queue key when it is one of the configured names. `writesTag` treats every configured queue name as synthetic, the same way it treats today's single `queueLabel`: those names are shown on the record and are not written back as Tracker tags. `listOpen` searches each queue with `client.search(queue.name, 'typicalTask')`. A direct `issue(key)` and `labels(key)` use the queue key on the payload, not the first configured name.

`arcanumAdapter(client, patterns)` deletes `ignoredAuthors`, the `sandcastle.yaml` reader, and the `root` parameter. `robot` uses `patterns` with the same `pattern.test(login)` check.

- [ ] **Step 4: Cover two searches**

Existing tracker tests pass `{queue: 'LAVKAOPSCORE', queueLabel: 'Sandcastle'}` and expect the label `Sandcastle`. Change them to `{queues: [{name: 'LAVKAOPSCORE'}]}`, put `queue: 'LAVKAOPSCORE'` on the issue fixture, and expect the label `LAVKAOPSCORE`.

Add a `listOpen` test. A fake client `search` records the queue and returns one issue per call, with `queue.key` equal to the searched queue. `listOpen` on queues `ONE` and `TWO` calls `search` twice, and the two records include `sdd:cycle` plus `ONE` or `TWO`. A direct `issue(key)` whose payload queue is `TWO` is labeled `TWO`, not `ONE`.

- [ ] **Step 5: Run the adapter tests**

Run: `node --test *.test.mjs` from the adapters directory.
Expected: all tests pass.

- [ ] **Step 6: Commit in Arcadia**

```bash
arc add ai/artifacts/skills/teams/lavka/sdd/sdd-flow/scripts/adapters
arc commit -m "$(cat <<'EOF'
Take queues and ignored authors from the service config.

EOF
)"
```

Do not `arc add` unrelated untracked files.

---

### Task 6: Rebuild the bundles and run the full suite

**Files:**
- Modify: `skills/sdd-flow/scripts/sdd.mjs`
- Modify: `bin/remote-solver.mjs`
- Test: `pnpm test` in `devops/remote-solver`

**Interfaces:**
- Consumes: Tasks 1–4
- Produces: published entrypoints that contain `loadServiceConfig` and do not contain `sandcastle.yaml`.

- [ ] **Step 1: Rebuild**

Run: `pnpm build`
Expected: exit 0.

- [ ] **Step 2: Confirm the bundle**

Run: `rg -n "sandcastle.yaml" skills/sdd-flow/scripts/sdd.mjs bin/remote-solver.mjs src`
Expected: no matches. `rg -n "loadServiceConfig" skills/sdd-flow/scripts/sdd.mjs` prints a match.

- [ ] **Step 3: Run the full test suite**

Run: `pnpm test`
Expected: exit 0. Every test file passes, and spec-coverage does not report gaps.

- [ ] **Step 4: Commit the bundles**

```bash
git add skills/sdd-flow/scripts/sdd.mjs bin/remote-solver.mjs
git commit -m "$(cat <<'EOF'
Rebuild the chat and the spy with service config.

EOF
)"
```
