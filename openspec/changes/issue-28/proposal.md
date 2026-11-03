## Problem

Hold review comments until send. The sidebar shows the pull request's review threads on the line they anchor, and a document-level remark on the phase. One line holds more than one comment. A reply whose marker is `sdd:fixed` is a status on the original comment, with the commit when the reply has one. It is not a second comment.

## Outcome

A new remark stays in the window until send. The send control posts every unsent remark, each as its own review thread, then clears them. While any remark is unsent, that control stands where «Принять» stood. «Принять» returns when the queue is empty. A failed send leaves the queue and keeps the send control. The window holds the queue for the open ticket. A reload drops unsent remarks.

The queue is the unsent remarks held for the open ticket. It is empty when no remark is unsent, and «Принять» returns in that place then. Showing «Принять» when the phase has no open question and every review thread for the phase is fixed does not name this queue.

Immediately after a successful send, the thread is visible on its line and the draft is cleared together. A cleared field with no thread on that line is indistinguishable from a failure, and the person sends the same text again.

## Scope

A new remark stays in the window until send. The send control posts every unsent remark, each as its own review thread, then clears them. Immediately after a successful send, the thread is visible on its line and the draft is cleared together. A cleared field with no thread on that line is indistinguishable from a failure, and the person sends the same text again. While any remark is unsent, that control stands where «Принять» stood. «Принять» returns when the queue is empty. A failed send leaves the queue and keeps the send control. The window holds the queue for the open ticket. A reload drops unsent remarks.

The sidebar shows the pull request's review threads on the line they anchor, and a document-level remark on the phase. One line holds more than one comment. A reply whose marker is `sdd:fixed` is a status on the original comment, with the commit when the reply has one. It is not a second comment.

## Out of scope

Editing a comment already on the pull request. Resolving a thread from the sidebar. Persisting the queue across a reload. Showing «Принять» when the phase has no open question and every review thread for the phase is fixed.

## Constraints

One line holds more than one comment. A reply whose marker is `sdd:fixed` is a status on the original comment, with the commit when the reply has one. It is not a second comment. While any remark is unsent, the send control stands where «Принять» stood. «Принять» returns when the queue is empty. A failed send leaves the queue and keeps the send control. The window holds the queue for the open ticket. A reload drops unsent remarks. The queue is empty when no remark is unsent. A phase with no open question, and every review thread for the phase fixed, is not that queue. Immediately after a successful send, the thread is visible on its line and the draft is cleared together. A cleared field with no thread on that line is not that send.

## Capabilities

### Added

- `unsent-remark` a new remark stays in the window until a successful send posts every unsent remark as its own review thread, shows that thread on its line, and clears the draft, together; the queue is those remarks, and «Принять» returns when none are unsent

### Modified

- `anchored-thread` the sidebar shows each review thread on the line it anchors, including immediately after a successful send, a document-level remark on the phase, and a reply whose marker is sdd:fixed as a status on the original comment, not a second comment

## Open questions
