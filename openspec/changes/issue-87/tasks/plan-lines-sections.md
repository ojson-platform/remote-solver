- On Design, model.design.questions is passed only for Open questions, and a checkbox outside Open questions stays a line comment
- A ## line stays the section h3, not a button
- A ### line stays the h4 from partsOf, not a button

sdd-delta: e878d73e50f8c514

## Source

`sectionsOf` in `src/window/spine.ts` keeps a `##` line as the section `h3` with its source line number; that line does not reach `PlanLines` as a button. `partsOf` in `src/window/client/sidebar.tsx` keeps lifting a `###` line to the `h4` and does not pass that line to `PlanLines`.

`DesignDocument` passes `model.design.questions` only into Open questions; every other section passes an empty list so a checkbox outside Open questions is painted through `PlanLines` and stays a line comment, not an open-question control.

Assume rendered markdown lines and remark behavior from earlier slices. Leave no-pull-request `p.line` and `reviewFold` outside the document to the chrome slice.

Seams (no child issues): spine section split vs sidebar `partsOf` lift vs Design props vs `PlanLines` checkbox presentation.

## Proof

`src/window/source-line.test.ts` observes Design Open questions vs other sections, that `##` is an `h3` not a button, that `###` is an `h4` from `partsOf` not a button, and that an outside checkbox stays a line comment.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/window/source-line.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
