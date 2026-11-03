## Problem

Hold review comments until send. The sidebar shows the pull request's review threads on the line they anchor, and a document-level remark on the phase. One line holds more than one comment. A reply whose marker is `sdd:fixed` is a status on the original comment, with the commit when the reply has one. It is not a second comment.

## Outcome

A new remark stays in the window until send. The send control posts every unsent remark, each as its own review thread, then clears them. While any remark is unsent, that control stands where «Принять» stood. «Принять» returns when the queue is empty. A failed send leaves the queue and keeps the send control. The window holds the queue for the open ticket. A reload drops unsent remarks.

## Scope

A new remark stays in the window until send. The send control posts every unsent remark, each as its own review thread, then clears them. While any remark is unsent, that control stands where «Принять» stood. «Принять» returns when the queue is empty. A failed send leaves the queue and keeps the send control. The window holds the queue for the open ticket. A reload drops unsent remarks.

The sidebar shows the pull request's review threads on the line they anchor, and a document-level remark on the phase. One line holds more than one comment. A reply whose marker is `sdd:fixed` is a status on the original comment, with the commit when the reply has one. It is not a second comment.

## Out of scope

Editing a comment already on the pull request. Resolving a thread from the sidebar. Persisting the queue across a reload.

## Constraints

One line holds more than one comment. A reply whose marker is `sdd:fixed` is a status on the original comment, with the commit when the reply has one. It is not a second comment. While any remark is unsent, the send control stands where «Принять» stood. «Принять» returns when the queue is empty. A failed send leaves the queue and keeps the send control. The window holds the queue for the open ticket. A reload drops unsent remarks.

## Capabilities

### Added

- `unsent-remark` a new remark stays in the window until the send control posts every unsent remark as its own review thread, then clears them

### Modified

- `anchored-thread` the sidebar shows each review thread on the line it anchors, a document-level remark on the phase, and a reply whose marker is sdd:fixed as a status on the original comment, not a second comment

## Open questions
