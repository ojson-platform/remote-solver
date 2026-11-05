A scenario name in the prose is a link to that scenario's row lower in the sidebar

A name that is not a row stays text

## Source

Treat a scenario name in focus prose as the text after `#### Scenario: ` on a spec row of the open ticket, including a row inside a fold. Link each occurrence in the prose, longest name first, without overlap. The first capability in spine order whose rows contain that name owns the link. Render `button.jump` with that `data-cap` and the name as its text so `onJump` opens Specify, the capability, a closed fold, and scrolls the `[data-scenario]` row via `scenarioTarget` in `src/window/client/gesture.ts`. A name that matches no row stays text. Do not link the badge.

Leave pager navigation, Accept caption, and spine phase sentences untouched.

## Proof

`src/window/board.test.ts` observes scenario names in focus prose: a name that matches a spec row is a jump to that row, including inside a fold; a name that matches no row stays text.

- `pnpm exec vitest --run --reporter=default src/window/board.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
