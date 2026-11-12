- Back still walks older written comments, newest first
- Forward still returns toward now

sdd-delta: e51e36369ca7899f

## Source

Client memory in `src/window/client/main.tsx`: Back still increments the page index; Forward still decrements it. A quiet round does not fire the click because the listener already ignores a disabled button; the click does not post. Which comment is a page stays `src/window/focus.ts`. Assume round chevron controls and quiet boundaries from earlier slices.

Seams (no child issues): index in client memory vs rendered page in `FocusBlocks`; disabled control vs ignored click; no server round-trip for Back or Forward.

## Proof

`src/window/sidebar.test.ts` observes rendered `FocusBlocks` and the client walk: Back moves to older written comments newest first; Forward returns toward now.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/window/sidebar.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
