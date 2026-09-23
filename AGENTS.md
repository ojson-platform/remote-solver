# remote-solver

SDLC machine for one issue, one pull request, and one OpenSpec change. See `README.md`.

```bash
pnpm install
pnpm test
pnpm run test:types
```

From the service repository: `remote-solver accept <key>`, `remote-solver issue <key>`, `remote-solver spy`. The bin is `bin/remote-solver.mjs`.

Secrets belong in `.env` and are not committed.

<!-- OJSON_INFRA_AGENTS:BEGIN -->

## Important

Additional AI agent guidance is available as fragments in the `.agents/` directory:

- `.agents/core.md` — Core concepts, two modes (metapackage vs standalone), and mode detection
- `.agents/dev-infrastructure.md` — Lint/format/test tooling and @ojson/infra usage

This section is managed by `@ojson/infra` migrations. Edit content outside this block freely.

<!-- OJSON_INFRA_AGENTS:END -->
