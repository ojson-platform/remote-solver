## Problem

The gap is a comment GitHub has and the sidebar does not show.

## Outcome

The sidebar shows each review thread of the open pull request on the line it anchors. A remark with no line stands on the phase. One line holds more than one comment. A reply whose marker is `sdd:fixed` is a status on the original comment, with the commit when the reply has one. It is not a second comment.

## Scope

Each review thread of the open pull request on the line it anchors. A remark with no line stands on the phase. One line holds more than one comment. A reply whose marker is `sdd:fixed` is a status on the original comment, with the commit when the reply has one. It is not a second comment. The gap is a comment GitHub has and the sidebar does not show.

## Out of scope

Holding a new remark until send. The send control. Making «Принять» inactive. Editing a comment already on the pull request. Resolving a thread from the sidebar.

## Constraints

A thread that is already on the pull request is visible this way.

Depends: #31

## Capabilities

### Added

### Modified

- `thread-line` each review thread of the open pull request stands on the line it anchors, including a comment GitHub has that the sidebar does not show

## Open questions

none
