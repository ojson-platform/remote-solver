- A line copied from the delta opens a thread
- A baseline line quotes the pull request
- A refused thread is quoted
- A refused send from «Записать» does not post a conversation comment
- Both writes failing leave the comment unrecorded
- A plan line opens a thread on proposal.md
- A design line opens a thread on design.md
- A plan line opens a thread
- A design line opens a thread
- An open question stays a conversation reply
- An open design question stays a conversation reply
- A design checkbox outside Open questions opens a thread
- A repeated design checkbox outside Open questions opens a thread

sdd-delta: eda70bbe7417d517

## Source

`answer` in `src/window/window.ts` and the existing line-comment path: delta rows carry an anchor (path, line, side `right`) and call `openThread` with the person's text only; baseline lines call `speak` with the visible line quoted; refused non-«Записать» threads still quote via `speak` without host error in the snapshot; both writes failing yield `комментарий не записан`; plan and design body lines anchor to `proposal.md` and `design.md`; open questions stay conversation replies; design `- [ ]` lines outside Open questions open threads. Leave `applyDelta` and unrelated board diff rendering untouched.

Seams (no child issues): anchor vs speak fallback; plan/design file paths vs delta path; open question vs checkbox thread; hold=`1` refusal handled in the unsent-remark slice.

Refused «Записать» sends that return `комментарий не записан` are asserted in **`failure-retry-draft-dedupe`**; this slice covers the `spec-diff` promise that no conversation comment is posted.

## Proof

`src/window/spec-diff.test.ts` observes line comments on delta and baseline rows, plan and design anchors, open-question conversation replies, design checkboxes, refused-thread quoting, a refused send from «Записать» without a conversation comment, and both writes failing.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/window/spec-diff.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
