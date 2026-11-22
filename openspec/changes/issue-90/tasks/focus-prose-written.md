- The live page sentence is not the written prose

sdd-delta: 60598f439f900bc1

## Source

In `src/window/client/sidebar.tsx`, `FocusBlocks` keeps the prose beside the badge as the written prose from focus content, not the live page sentence. Assume `focus-prose-heading-jump`.

Linked issues: #88.

## Proof

`src/window/sidebar.test.ts` observes rendered `FocusBlocks` on a written focus: the prose beside the badge is the written prose and is not the live page sentence.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --maxWorkers=1 --reporter=default src/window/sidebar.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.