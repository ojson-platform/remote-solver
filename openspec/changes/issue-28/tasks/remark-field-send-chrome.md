- A new remark stays in the window until send
- The send control on the remark field posts every unsent remark as its own review thread
- «Принять» stays on the phase row
- The send control does not take its place

sdd-delta: eda70bbe7417d517

## Source

Page memory queue for the open ticket’s drafts in `src/window/client/main.tsx` (`memory.drafts` for line fields and `memory.remark` for Plan, Specify, and Design per `design.md`). The send control stays the send mark inside the remark field (`button.send`, «Записать»); it does not replace «Принять». «Принять» stays `accept-review` on the phase row in `src/window/client/sidebar.tsx`. `FACE.md` stays unchanged unless a face change is required for this slice. Wire sending through `answer` in `src/window/window.ts` so the review port is not asked to open a thread until send. Leave unrelated spine, board, and pool behavior untouched.

Seams (no child issues): in-field send vs phase-row accept; queue field state vs review port; trimmed empty field is not a remark.

## Proof

`src/window/unsent-remark.test.ts` drives the rendered window for the open ticket: a new remark stays visible until send; activating send posts each non-empty unsent remark as its own thread; «Принять» remains on the phase row and the send control does not occupy that place. The test may read the existing window harness and rendered DOM.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/window/unsent-remark.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
