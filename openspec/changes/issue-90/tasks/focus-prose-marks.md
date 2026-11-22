- Marks stay beside the jump button

sdd-delta: 1e4329fa9ba10afb

## Source

In `src/window/client/sidebar.tsx`, when a scenario name sits in a list item that spans more than one line, `FocusBlocks` shows the list mark in front of the jump button; a heading mark and emphasis marks stay beside that button the same way. `paintSourceDocument` in `src/window/client/source-line.tsx` runs on the text around that scenario name, and the document paint for that line does not include those marks; heading, list, emphasis, link, and code marks do not stay the characters that were written. Update `src/window/FACE.md` and the Focus block entry in `src/window/CONTEXT.md`: the list mark stays in front of the jump button and the document paint for that line does not include those marks. Assume `focus-prose-jump`. Leave the live page sentence to `focus-prose-written`.

Linked issues: #88.

## Proof

`src/window/sidebar.test.ts` observes rendered `FocusBlocks` on a written focus whose prose carries heading, list, emphasis, link, and code marks and a scenario name in a multi-line list item: the list mark sits in front of the jump button, heading and emphasis marks stay beside that button, document paint for that line excludes those marks, paint runs on the text around the scenario name, and the marks do not stay the characters that were written.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/window/sidebar.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.