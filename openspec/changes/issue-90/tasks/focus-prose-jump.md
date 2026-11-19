- A scenario name stays a button.jump

sdd-delta: bfa2878e4eb945d1

## Source

`linkFocusProseParts` in the window still separates a scenario name in the written prose; paint runs on the text around it, and a jump is handled before the line click as it is today. A scenario name in that prose stays a `button.jump`. Assume `focus-prose-markdown`. Leave the live page sentence to `focus-prose-written`.

Linked issues: #88.

## Proof

`src/window/sidebar.test.ts` observes rendered `FocusBlocks` on a written focus whose prose contains a scenario name: that name is a `button.jump`.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/window/sidebar.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.