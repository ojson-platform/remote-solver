# remote-solver

SDLC machine for one issue, one pull request, and one OpenSpec change. It reads the tracker, the review, and the change, then runs the next skill or waits on a human gate.

```bash
pnpm install
pnpm test
pnpm run test:types
```

Copy `.env.example` to `.env` for a live run. That file is not committed.

Run from the service repository. The working directory stays the service: that is the repository the machine reads.

A person closes a review gate on the issue by moving its phase, e.g. `sdd:proposing` to `sdd:proposed`. `sdd accept` does the same from the command line. `remote-solver` starts a run. Cycle verbs are the `sdd` bin.

```bash
npx sdd accept <key>
npx remote-solver issue <key>
npx remote-solver spy --parallel 2
npx remote-solver board
```

`remote-solver board` serves the window on `127.0.0.1`, prints the page URL, and runs the spy in the same process. The home file is `~/.aifactory/config.yaml` unless `--home` names another one. The first launch watches this repository's `owner/repo`. The working directory is the checkout the page reads for that repository. Take assigns a cycle, and the spy runs its agent. The page shows the spy's latest line.

The metapackage depends on this package, so `npx` finds the bin from the service directory.

Agent notes are in `AGENTS.md`.
