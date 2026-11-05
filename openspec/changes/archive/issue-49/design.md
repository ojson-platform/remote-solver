## Verification boundary

`thread-line`. Scenarios are observed on the rendered sidebar page in `src/window/thread-line.test.ts`: a plan line, a design line, a spec line, a task line, and the phase fold. The comment the last-reply read drops is observed at `threadRecord` in `src/adapters/github.test.ts`. The one-file command passes `--reporter=default` so that file can exit 0. The layer command keeps the coverage reporter.

one-file: `pnpm exec vitest --run --reporter=default <test-file>`
layer: `pnpm test`
fast suite: none
trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`
test path: `src/**/*.test.ts`, `src/**/*.test.tsx`
`pnpm run test:types`

## External contracts

none

## Technical prerequisites

Depends: #31

## Approach

The review port is the seam that has the thread. The window places it. Marker grammar stays in the machine.

`threadList` in `src/adapters/github.ts` asks for `comments(last:1)`. `threadRecord` keeps that one node as `body` and as the reply handle `comment`. A later reply replaces the original, and a thread whose latest author is ignored is dropped. That original comment is the one GitHub has and the sidebar does not show. The query becomes `comments(first:100)`. The nodes stay in the order the host returns. `body` and `comment` stay the last node, so `threads()`, `readReview`, and `thread reply` still see the latest marker and the latest comment id. The record also keeps every comment body, in that order. A thread is dropped only when it has no comment or every author is ignored. A person's comment with a later ignored `sdd:fixed` reply stays. A memory seed that omits the list is one comment, the body, so existing seeds stay valid. `threads()` still returns `{resolved, body}` from that latest body.

`reviewOf` in `src/window/live.ts` copies the path, the line, and those comments onto the window review. It splits the comments with `parseMarker`. A reply whose marker is `fixed` is not a comment. It is a status on the first comment, and the commit is `marker.commit` when the reply has one. The latest body split into `lines` stays what the unanswered block already reads. The client does not match `sdd:` tokens and does not call the host.

The sidebar already draws the line. A plan line and a design line carry `data-path` and `data-at`. A spec row carries `anchor.path` and `anchor.line`. A task line is drawn and gains the same path and line, and it does not become a field. A thread whose path and line match a drawn line is shown under that line. Several threads, and several comments of one thread, stack there in host order. One line holds more than one comment. The status sits on the first comment of its thread. It shows the commit when the reply has one, and it shows no commit when the reply has none. It is not another comment under the line.

A thread with no line stands on the phase its path names. `proposal.md` is Plan. A `specs/<capability>/spec.md` is Specify. `design.md` is Design. `tasks.md` or `tasks/<id>.md` is Tasks. Any other path is Code. On Plan, Specify, and Design the comment sits in the phase foot, above the draft remark. On Tasks and Code it sits at the top of that fold. A thread whose line is not among the drawn lines stands on that same phase, with its path and line, so the comment is not dropped. A closed spec fold renders the comment when it renders the row. This change does not open the fold and does not draw source lines.

The draft field is untouched. A thread is shown because the port returned it, not because a draft is open. The send control, holding a remark until send, editing a posted comment, resolving a thread, and making «Принять» inactive stay as they are. The unanswered block stays the sidebar rule it already is. Link marks stay where #31 put them.

The posted comment is the quiet card without a field, without a send mark, and without a close circle. No new colour. The implementation records that on `src/window/FACE.md`. No new glossary word: thread, comment, line, phase, and marker already name it.

After merge the next read of the open pull request shows the threads. No flag and no follow-up step.

Rejected: leaving `comments(last:1)`, which keeps hiding the original once a reply exists. Rejected: storing the original in `body`, which would make the machine miss `sdd:fixed` and make `thread reply` target the wrong comment. Rejected: dropping a thread because its latest author is ignored. Rejected: matching `sdd:fixed` in the client. Rejected: drawing the reply as a second comment. Rejected: putting the posted comment into the draft field. Rejected: removing the unanswered block. Rejected: rendering a source diff so a code line exists. Rejected: a conversation comment as a phase remark. A conversation comment is not a review thread.

## Open decisions

none
