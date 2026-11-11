# remote-solver

SDLC machine for one issue, one pull request, and one OpenSpec change. See `README.md`.

```bash
pnpm install
pnpm test
pnpm run test:types
```

From the service repository: `remote-solver issue <key>` and `remote-solver spy`. A gate is `sdd accept <key>`. The bins are `bin/remote-solver.mjs` and `skills/sdd-flow/scripts/sdd.mjs`; `pnpm build` writes them from `src/`, and they are not committed.

Secrets belong in `.env` and are not committed.

`CONTEXT.md` is the shared glossary; `CONTEXT-MAP.md` lists the module glossaries under `src/`. Name things in code, skills, and prompts with those terms. `src/window/FACE.md` is the window's look: the room, the type, the ground, the colour roles, and which control wears them. A change to that look updates `FACE.md` in the same session. A spec names a control and what it does; a colour, the ground, or a measure belongs on the face. `docs/adr/` records decisions; before changing how the machine, a skill, or a prompt behaves, read the ADRs that touch that area, and record a new hard-to-reverse decision as the next number there.

Skills under `skills/` share every procedure through `skills/sdd-flow/CONTEXT.md` (Publish, Fix thread, Hand-off, Wait, Delta, Once, Artifacts, Layers). A skill names the section; it does not restate it. `src/machine/skill/skill.test.ts` checks that shape.

## Code

A directory is one subject. Its files and its tests live in it, and callers import the file inside that directory. The root of a package keeps only what every subject shares. In the machine that is `port.ts`, and the subjects are `decide`, `flow`, `change`, `phase`, `mark`, `spy`, and `skill`. In the adapters the root keeps `compose.ts`, `load.ts`, and `locate.ts`, and the subjects are `tracker`, `review`, `vcs`, `runtime`, and `openspec`. A port implementation takes the machine object and calls only that object. `adapterMachine` is the host: the mark, the branch name, the pull title, and the archive tip. `runtimeMachine` adds the prompt and the content stamp, and only the runtime this package ships receives it. `createAdapters(root, config, machine)` passes `adapterMachine`. A port implementation does not import a machine subject. `compose.ts` and `load.ts` may call `performIssue` and `loadServiceConfig`. A test may import the subject it asserts. ADR 0035 records this. A fixture that only tests use lives in that subject's `__tests__` directory.

A file inside a subject holds one concern of it. A function does one thing a reader can hold at once. The next step and the next check are the next functions. A function that has grown long, or whose branches are those next steps, becomes its own file in the same subject.

The name says what a file or a function returns. A comment says why a branch exists. A new concern joins the subject it belongs to. A concern that is none of those subjects is a new directory.

<!-- OJSON_INFRA_AGENTS:BEGIN -->

## Important

Additional AI agent guidance is available as fragments in the `.agents/` directory:

- `.agents/core.md` — Core concepts, two modes (metapackage vs standalone), and mode detection
- `.agents/dev-infrastructure.md` — Lint/format/test tooling and @ojson/infra usage

This section is managed by `@ojson/infra` migrations. Edit content outside this block freely.

<!-- OJSON_INFRA_AGENTS:END -->
