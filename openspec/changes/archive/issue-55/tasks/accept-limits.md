Unarchive stays a revert of the archive commit

The step does not merge the pull request

## Source

In `skills/sdd-flow/steps/accept.md`, keep `## unarchive` a revert of the archive commit only; do not add archive fold steps there. In `## archive`, state explicitly that this step does not merge the pull request. Do not change machine merge policy in this slice unless accept text already contradicts it.

Seams (no child issues): archive commit vs unarchive revert; accept archive vs merge gate elsewhere.

## Proof

`src/machine/hook.test.ts` observes accept step section order and that unarchive stays separate from archive fold instructions. Tests may read `skills/sdd-flow/steps/accept.md` and hook fixtures the file already uses.

- `pnpm exec vitest --run --reporter=default src/machine/hook.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
