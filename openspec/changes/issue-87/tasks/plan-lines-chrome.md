- With no pull request, the line stays a p.line and is not a comment target
- The phase foot stays outside the document

sdd-delta: 5203d0361d4326a4

## Source

In `src/window/client/sidebar.tsx`, when there is no pull request a place in the rendered document is `p.line` and is not a comment target. With a pull request the remark slice already keeps the rendered place as the comment target.

Keep `reviewFold` as the phase foot, a sibling after the document, not inside `.doc`.

Assume earlier slices: one markdown document, remark targets when a pull request exists, and section structure. This slice closes the no-PR and foot boundaries only.

Seams (no child issues): pull-request presence branch in `PlanLines` vs `reviewFold` placement in the sidebar tree.

## Proof

`src/window/source-line.test.ts` observes that without a pull request lines are `p.line` and not comment targets, and that the phase foot sits outside the document.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/window/source-line.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
