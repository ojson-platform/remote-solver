# remote-solver

SDLC machine for one issue, one pull request, and one OpenSpec change. It reads the tracker, the review, and the change, then runs the next skill or waits on a human gate.

```bash
pnpm install
pnpm test
pnpm run test:types
```

Copy `.env.example` to `.env` for a live run. That file is not committed.

Run from the service repository. The working directory stays the service: that is the repository the machine reads.

```bash
npx remote-solver accept <key>
npx remote-solver issue <key>
npx remote-solver spy --parallel 2
```

The metapackage depends on this package, so `npx` finds the bin from the service directory.

Agent notes are in `AGENTS.md`.
