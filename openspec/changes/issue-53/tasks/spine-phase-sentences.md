Each spine row keeps the first sentence of the latest written focus of that phase

## Source

Keep `scanFocusComments` writing the first sentence of the latest phase focus onto Plan, Specify, Design, Tasks, and Code rows. `applyPhaseSentences` still drops a layer that is not one of those. A `sdd:focus` comment stays off every row. An accept comment does not supply a phase row sentence. The open pager page does not replace a row's sentence.

Leave Accept caption, pager navigation, and scenario-name links to other tasks.

## Proof

`src/window/spine.test.ts` observes each spine row keeping the first sentence of the latest written focus of that phase.

- `pnpm exec vitest --run --reporter=default src/window/spine.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
