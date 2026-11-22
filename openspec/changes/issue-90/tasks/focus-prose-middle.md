- A middle line stays beside the badge

sdd-delta: 60598f439f900bc1

## Source

In `src/window/client/sidebar.tsx`, when a scenario name sits on the first line of a list item that spans three or more lines and that line has no text after the name, `FocusBlocks` keeps the words on the line between the first and the last beside the badge. Those words are the words after the marker line and are not rewritten. Update `src/window/FACE.md` and the Focus block entry in `src/window/CONTEXT.md` with that sentence. Assume `focus-prose-marks`.

Linked issues: #88.

## Proof

`src/window/sidebar.test.ts` observes rendered `FocusBlocks` on a written focus where a scenario name sits on the first line of a list item that spans three or more lines, and that line has no text after the name: the words on the line between the first and the last are beside the badge, the prose beside the badge is the words after the marker line, and those words are not rewritten.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --maxWorkers=1 --reporter=default 'src/window/sidebar.test.ts' -t '<titles>'`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.