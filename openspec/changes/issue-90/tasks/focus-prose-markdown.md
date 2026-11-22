- The prose renders markdown
- The prose is rendered beside the badge

sdd-delta: f9ac38635ce24bd5

## Source

In `src/window/client/sidebar.tsx`, `FocusBlocks` paints the prose beside the badge with `paintSourceDocument` from `src/window/client/source-line.tsx` instead of a `pre`. A heading, a list, emphasis, a link, and code render, and their marks do not stay the characters that were written. Update `src/window/FACE.md` and the Focus block entry in `src/window/CONTEXT.md` so the prose beside the badge is markdown paint, not a quiet pre. Assume `focus-prose-marker`. Leave scenario jumps and the live page sentence to later slices.

Linked issues: #88.

## Proof

`src/window/sidebar.test.ts` observes rendered `FocusBlocks` on a written focus whose prose carries a heading, a list, emphasis, a link, and code: the prose beside the badge renders those elements with marks removed, and it is not left in a `pre`.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --maxWorkers=1 --reporter=default src/window/sidebar.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.