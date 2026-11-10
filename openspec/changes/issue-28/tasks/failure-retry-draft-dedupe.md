- A failed send leaves the draft
- Once the pull request has that thread, the draft disappears, including when the window reported an error such as stale
- The draft remains only when that thread is not on the pull request
- The draft remains only when the thread is not on the pull request
- A refused send from «Записать» returns «комментарий не записан» and does not post a conversation comment
- A refused send from «Записать» does not post a conversation comment
- When the pull request already has that thread, including after the window reported an error, a retry does not post a second thread with the same text on the same line
- If the window replied with an error after the write, including stale, a retry does not create a second thread with the same text on the same line

sdd-delta: 6bfb0d887ae27abd

## Source

`answer` in `src/window/window.ts`: same text on the same path and line (no line for a phase remark) identifies one thread; when the held review already has it, do not open another; a send from «Записать» carries `hold=1`; a refused open of that send returns `комментарий не записан` and does not call `commentPull` or `speakPull`; a refused thread that is not a send from «Записать» still calls `speakPull` with the visible line quoted. `threadPull` and act classification in `src/window/live.ts`: treat `stale` (e.g. 409) without painting a success path when the thread is not yet on the pull request; when the pull request already has the thread, the next snapshot clears the draft. Later host read replaces the held review as today; session-accepted thread remains until the host list shows the same text, path, and line. Leave unrelated review host API surface untouched except as needed for file-level threads described in `design.md`.

Seams (no child issues): failed send vs draft retention; stale error vs thread already on the pull request; dedupe key (path, line, text) vs second thread; held review vs host list refresh; refused «Записать» send vs conversation comment.

## Proof

`src/window/unsent-remark.test.ts` covers failed sends leaving the draft only when that thread is not on the pull request; when the pull request has that thread the draft clears including after a stale-style error; refused sends from «Записать» return `комментарий не записан` without a conversation comment; retries do not create a duplicate thread with the same text on the same line when the pull request already has that thread.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/window/unsent-remark.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
