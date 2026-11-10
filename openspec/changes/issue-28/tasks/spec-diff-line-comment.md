- A line copied from the delta opens a thread
- A baseline line quotes the pull request
- A refused thread is quoted
- Both writes failing leave the comment unrecorded
- A plan line opens a thread on proposal.md
- A design line opens a thread on design.md
- A plan line opens a thread
- A design line opens a thread
- An open question stays a conversation reply
- An open design question stays a conversation reply
- A design checkbox outside Open questions opens a thread
- A repeated design checkbox outside Open questions opens a thread

sdd-delta: 6bfb0d887ae27abd

## Source

`answer` in `src/window/window.ts` and the existing line-comment path: delta rows carry an anchor (path, line, side `right`) and call `openThread` with the person's text only; baseline lines call `speak` with the visible line quoted; refused non-«Записать» threads still quote via `speak` without host error in the snapshot; both writes failing yield `комментарий не записан`; plan and design body lines anchor to `proposal.md` and `design.md`; open questions stay conversation replies; design `- [ ]` lines outside Open questions open threads. Leave `applyDelta` and unrelated board diff rendering untouched.

Seams (no child issues): anchor vs speak fallback; plan/design file paths vs delta path; open question vs checkbox thread; hold=`1` refusal handled in the unsent-remark slice.

This slice assumes **`failure-retry-draft-dedupe`** for the refused «Записать» send wording shared with `unsent-remark`.

## Proof

`src/window/spec-diff.test.ts` observes line comments on delta and baseline rows, plan and design anchors, open-question conversation replies, design checkboxes, refused-thread quoting, and both writes failing.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/window/spec-diff.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
