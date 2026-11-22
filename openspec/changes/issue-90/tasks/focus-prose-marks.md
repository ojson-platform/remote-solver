- Marks stay beside the jump button

sdd-delta: f9ac38635ce24bd5

## Source

In `src/window/client/sidebar.tsx`, when a scenario name sits on a line of a multi-line list item, `FocusBlocks` shows that item's list mark once and a heading mark on that line once, in front of the jump button. `paintSourceDocument` in `src/window/client/source-line.tsx` runs on the text around the name, including a later line of the item. That line's document paint does not include those two marks. Emphasis, a link, and code on that line render as markdown. Link marks and code marks do not stay the characters that were written. Update `src/window/FACE.md` and the Focus block entry in `src/window/CONTEXT.md` with that same sentence. Assume `focus-prose-jump`. Leave the live page sentence to `focus-prose-written`.

Linked issues: #88.

## Proof

`src/window/sidebar.test.ts` observes rendered `FocusBlocks` on a written focus whose prose carries a heading, a list, emphasis, a link, and code, and a scenario name on a line of a multi-line list item, including a later line: the list mark and a heading mark on that line sit once in front of the jump button, the document paint excludes those two marks, and emphasis, the link, and the code on that line render as markdown.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/window/sidebar.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.