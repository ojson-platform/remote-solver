- Immediately after a successful send the thread is visible in the sidebar and the draft is cleared together with that
- When the pull request has that thread, the draft disappears

sdd-delta: 6bfb0d887ae27abd

## Source

`answer` in `src/window/window.ts` posts remarks; `threadPull` in `src/window/live.ts` folds a thread into the held review only after `openThread` resolves, before the act response is classified, so a successful send’s snapshot already includes the thread. Clear drafts only in the paint whose review shows that thread so the sidebar and empty field update together. Assume sidebar placement from #49 (line thread under its line, phase thread in the phase foot). No new sidebar block kinds. Leave unrelated transport and spine logic untouched.

Seams (no child issues): snapshot paint vs draft clear; HTTP response vs held review already showing the thread; dependency on #49 sidebar vs this slice’s clear timing.

This slice waits on **`depends-49-sidebar`** (Technical prerequisites).

## Proof

`src/window/unsent-remark.test.ts` observes immediately after a successful send: the thread appears in the sidebar (on its line or phase foot per #49) and the draft clears in the same paint; when the pull request has that thread, the draft disappears.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/window/unsent-remark.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
