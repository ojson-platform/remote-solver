The step still makes one commit

Its body contains a line Sdd-Archive: issue-<key>

That commit stays the tip until unarchive

The command archives to openspec/changes/archive/<date>-issue-<key>/

Before the commit, the step moves that directory to openspec/changes/archive/issue-<key>/

openspec validate --all --strict --no-interactive still runs before the commit

The archive commit is the tip

## Source

Assume `archive-fold` landed. In `skills/sdd-flow/steps/accept.md` `## archive`, after `openspec archive issue-<key> --yes`, move `openspec/changes/archive/<date>-issue-<key>/` to `openspec/changes/archive/issue-<key>/` before the single commit. Run `openspec validate --all --strict --no-interactive` after any Purpose edit in later tasks and before that commit. The commit body includes `Sdd-Archive: issue-<key>`; no second commit for the move. Extend `src/machine/archive.test.ts` to observe one commit, the dated directory the command wrote, the undated path in the commit, validate before commit, and the tip until unarchive.

Leave `archiveDir` in `src/machine/naming.ts` on the undated path. Do not change unarchive or merge behavior here.

Seams (no child issues): dated directory is CLI output only; undated `archive/issue-<key>` is what readers and the commit use; one commit is the archive tip.

## Proof

`src/machine/archive.test.ts` observes one archive commit, `Sdd-Archive: issue-<key>` in the body, tip until unarchive, the dated archive directory from the command, the move to `openspec/changes/archive/issue-<key>/`, and validate before commit. Tests may read the fixture checkout, accept step text, and git state the file already uses.

- `pnpm exec vitest --run --reporter=default src/machine/archive.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
