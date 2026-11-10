sdd-absorbed: 6bfb0d887ae27abd

## Verification boundary

`unsent-remark` and the modified `spec-diff`. The `unsent-remark` scenarios are observed on the rendered window of the open ticket and on the review threads that window holds, in `src/window/unsent-remark.test.ts`. The `spec-diff` change is observed in `src/window/spec-diff.test.ts`. A new remark stays in the field, and the review port is not asked to open a thread, until the send control. The send control posts every non-empty unsent remark as its own thread. «Принять» stays on the phase row, and the send mark stays inside the remark field. Immediately after a successful send, the thread is in the sidebar — on its line, or in the phase foot when it has no line — and that same paint clears the draft. A failed send leaves the draft when that thread is not on the pull request. When the pull request has that thread, the draft is gone, including when the window answered `stale`. A refused send from «Записать» returns `комментарий не записан` and does not post a conversation comment. A refused thread that is not a send from «Записать» still quotes the visible line. A retry does not open a second thread with the same text on the same line. The queue is the open ticket's; another ticket's remarks are not in it. A fresh page has no unsent remark. The one-file command passes `--reporter=default` so that file can exit 0. The layer command keeps the coverage reporter. `pnpm test` is the CI run of the package script `vitest --run`.

one-file: `pnpm exec vitest --run --reporter=default <test-file>`
layer: `pnpm test`

fast suite: none
`pnpm run test:types`
trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`
test path: `src/**/*.test.ts` or `src/**/*.test.tsx`

## External contracts

The review host accepts each unsent remark as its own review thread and lists the threads already on the pull request. A line remark is a thread on that path and line. A phase remark is a thread on that phase file with no line. The window asks the review port and does not call the host.

## Technical prerequisites

Depends: #49. The sidebar already places a thread on its line and a thread with no line on the phase. This change does not build that placement.

## Approach

The queue is page memory in `src/window/client/main.tsx`: `memory.drafts` for a line field and `memory.remark` for the Plan, Specify, and Design fields. It is the open ticket's queue. Changing the open ticket already clears it. A reload starts a new page, so the queue is not written to `sessionStorage` and not kept on the server. An empty trimmed field is not a remark.

The send control is the send mark already inside the remark field (`button.send`, «Записать»). One activation posts every non-empty unsent remark of the open ticket, each as its own review thread. «Принять» stays the `accept-review` control on the phase row in `src/window/client/sidebar.tsx`. The send mark does not move there. No new colour, ground, or measure, so `FACE.md` stays as it is.

`answer` in `src/window/window.ts` posts those remarks. A line remark uses the existing `threadPull` place: path, line, and side. A phase remark is one thread on the file that phase already draws, with no line: `proposal.md` for Plan, `design.md` for Design, and for Specify the spec path of the first capability in spine order. The same text on that same path and line (no line for a phase remark) is the same thread. When the pull request already has it, the held review shows it and `answer` does not open another. A send from «Записать» carries `hold=1`. A refused open of that send returns `комментарий не записан` and does not call `commentPull` or `speakPull`; the draft stays unless the pull request already has that thread. A phase remark from the same field is that same send: its refusal returns the same status and does not post a conversation comment. A refused thread that is not a send from «Записать» still calls `speakPull` with the visible line quoted above the text.

`threadPull` in `src/window/live.ts` folds a thread into the held review only after `openThread` resolves, and before the act response is classified. That held review is how the window sees that the pull request has the thread. The snapshot of a successful send already contains that thread. The client clears a draft only inside the paint whose review shows it, so the sidebar and the empty field arrive together. The sidebar blocks stay the ones #49 draws: a line thread under its line, a thread with no line in the phase foot. This change adds no block kind.

A `stale` answer stays 409 and does not paint that response. When the pull request already has the thread, the held review has it, and that write notifies the page. The next snapshot shows the thread, and that paint clears the draft. A `stale` answer that did not leave the thread on the pull request notifies nothing new, and the draft stays. A later host read replaces the held review as it does today, and it keeps a thread this session accepted until the host list shows that same text, path, and line. Until then a retry still sees it and does not open a second thread.

The review port grows a file-level thread with no line. `openThread` sends `subject_type=file` when the line is absent, the same shape `changesPayload` already uses for a note with a path and no line. `ThreadTarget.line` may be absent for that thread. The window still does not call the host.

After merge the queue, the send, and the clear are the window's. No flag and no follow-up step.

Rejected: one thread whose body joins every unsent remark. Rejected: one `flag` review that requests changes. Rejected: a conversation comment when a send from «Записать» is refused. Rejected: the send control in the place of «Принять». Rejected: clearing the draft on HTTP success before the thread is in the painted review. Rejected: clearing the draft on `stale` when the thread is absent. Rejected: a second thread with the same text on the same line. Rejected: the queue on the server or in `sessionStorage`. Rejected: a new placement for threads already on the pull request. Rejected: making «Принять» inactive, editing a posted comment, and resolving a thread from the sidebar.

## Open decisions

none
