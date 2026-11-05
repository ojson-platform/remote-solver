When the command refuses, the step does not publish

A refusal because a baseline would have no requirement is a Wait that names that baseline

## Source

Assume `archive-purpose` landed. In `skills/sdd-flow/steps/accept.md` `## archive`, when `openspec archive issue-<key> --yes` exits non-zero, do not commit and do not publish. When the refusal is because a baseline would have no requirement after the fold, call Wait naming that baseline (same stop as a delta that removes the last requirement). Extend `src/machine/archive.test.ts` with a fixture delta that would empty a baseline.

Seams (no child issues): refusal is CLI exit with no commit; empty baseline Wait matches § Delta and existing accept stop.

## Proof

`src/machine/archive.test.ts` observes no commit and no publish on refusal, and Wait text naming the baseline when the fold would leave no requirement. Tests may read accept step text and fixture deltas.

- `pnpm exec vitest --run --reporter=default src/machine/archive.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
