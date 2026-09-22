# remote-solver

SDLC machine for one issue, one pull request, and one OpenSpec change. It reads the tracker, the review, and the change, then runs the next skill or waits on a human gate.

```bash
pnpm install
pnpm test
pnpm run test:types
```

Copy `.env.example` to `.env` for a live run. That file is not committed.

Agent notes are in `AGENTS.md`.
