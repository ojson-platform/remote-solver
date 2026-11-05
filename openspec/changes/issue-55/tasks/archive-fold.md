The accept step folds a delta with the archive command instead of editing the baseline by hand

The command applies RENAMED, then REMOVED, then MODIFIED, then ADDED

The baseline shows the fold in section order

## Source

Replace hand-editing in `## archive` of `skills/sdd-flow/steps/accept.md` with `openspec archive issue-<key> --yes` as the fold. Leave `## unarchive` and merge out of this slice. Add `src/machine/archive.test.ts` with a fixture checkout whose delta renames one requirement, removes a second, modifies the renamed requirement, and adds a third; after the accept archive path runs, assert section order and baseline content match the delta (no removal prose copied).

Leave `applyDelta` in `src/window/spec-diff.ts` untouched; it is the board diff, not this fold.

Seams: accept `## archive` as the only fold; OpenSpec CLI applies the delta (external contract, child #60); `applyDelta` stays out of scope.

## Proof

`src/machine/archive.test.ts` observes the archive command on the fixture instead of hand edits, RENAMED then REMOVED then MODIFIED then ADDED, and the baseline after a mixed delta. Tests may read fixture trees under the test file, `skills/sdd-flow/steps/accept.md`, and helpers the file already imports.

- `pnpm exec vitest --run --reporter=default src/machine/archive.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
