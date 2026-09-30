# remote-solver

SDLC machine for one issue, one pull request, and one OpenSpec change. See `README.md`.

```bash
pnpm install
pnpm test
pnpm run test:types
```

From the service repository: `remote-solver issue <key>`, `remote-solver spy`, and `remote-solver accept <key>` as an alternative to moving the gate phase on the issue. The bin is `bin/remote-solver.mjs`.

Secrets belong in `.env` and are not committed.

`CONTEXT.md` is the shared glossary; `CONTEXT-MAP.md` lists the module glossaries under `src/`. Name things in code, skills, and prompts with those terms. `docs/adr/` records decisions; before changing how the machine, a skill, or a prompt behaves, read the ADRs that touch that area, and record a new hard-to-reverse decision as the next number there.

Skills under `skills/` share every procedure through `prompts/context.md` (Publish, Fix thread, Hand-off, Wait, Delta, Artifacts, Layers). A skill names the section; it does not restate it. `src/machine/skill.test.ts` checks that shape.

<!-- OJSON_INFRA_AGENTS:BEGIN -->

## Important

Additional AI agent guidance is available as fragments in the `.agents/` directory:

- `.agents/core.md` — Core concepts, two modes (metapackage vs standalone), and mode detection
- `.agents/dev-infrastructure.md` — Lint/format/test tooling and @ojson/infra usage

This section is managed by `@ojson/infra` migrations. Edit content outside this block freely.

<!-- OJSON_INFRA_AGENTS:END -->
