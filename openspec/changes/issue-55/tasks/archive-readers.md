The machine, the window, review, and unarchive keep reading archive/issue-<key>

## Source

Assume `archive-commit` landed. Keep `archiveDir` in `src/machine/naming.ts` on `openspec/changes/archive/issue-<key>/` with no date segment. Leave `src/window/change-files.ts`, `archiveChangePath` in `src/reviewer/act.ts`, and archive tip reads in `src/adapters/vcs.ts` on that undated path. Do not teach readers `openspec/changes/archive/<date>-issue-<key>/`. Extend or add assertions in the tests that already cover those readers.

Seams (no child issues): `archiveDir` naming; window content tree; VCS archive mark; reviewer archive path; unarchive still reads the same tree via naming—no dated archive in product paths.

## Proof

Tests observe undated `archive/issue-<key>` on the machine (`src/machine/change.test.ts`), VCS archive mark (`src/adapters/vcs.test.ts`), window content tree (`src/window/spec-diff.test.ts`), and review archive path (`src/reviewer/reviewer.test.ts`).

- `pnpm exec vitest --run --reporter=default src/machine/change.test.ts`
- `pnpm exec vitest --run --reporter=default src/adapters/vcs.test.ts`
- `pnpm exec vitest --run --reporter=default src/window/spec-diff.test.ts`
- `pnpm exec vitest --run --reporter=default src/reviewer/reviewer.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
