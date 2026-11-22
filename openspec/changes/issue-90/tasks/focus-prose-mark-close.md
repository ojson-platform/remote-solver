- A mark that opens on the first line closes as markdown

sdd-delta: 60598f439f900bc1

## Source

In `src/window/client/sidebar.tsx`, when a scenario name sits on the first line of a multi-line list item and text remains on that line after the name, `FocusBlocks` renders an emphasis mark, a link mark, and a code mark that each open on that line and close on a later line as markdown. Those marks do not stay the characters that were written. The jump line does not show the written emphasis mark, the written link mark, or the written code mark. The later line does not paint that mark on its own. Update `src/window/FACE.md` and the Focus block entry in `src/window/CONTEXT.md` with that sentence. Assume `focus-prose-middle`.

Linked issues: #88.

## Proof

`src/window/sidebar.test.ts` observes rendered `FocusBlocks` on a written focus where a scenario name sits on the first line of a multi-line list item, text remains on that line after the name, and an emphasis mark, a link mark, and a code mark each open on that line and close on a later line: those marks do not stay the characters that were written, the jump line does not show the written emphasis mark, the written link mark, or the written code mark, the later line does not paint that mark on its own, and emphasis, a link, and code on that line render as markdown.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --maxWorkers=1 --reporter=default 'src/window/sidebar.test.ts' -t '<titles>'`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.