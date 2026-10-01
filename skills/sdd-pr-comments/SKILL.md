---
name: sdd-pr-comments
description: >
  Labels unanswered pull request threads and the pull request conversation
  with sdd:layer. Does not edit files and does not set the phase. The machine
  moves to the earliest marker.
  Trigger: classify-comments.
mode: mechanical
---

# sdd-pr-comments

Labels unanswered PR threads and one conversation comment. Leaves change files untouched and does not resolve threads. The result is a reply, not a commit. Layers and their phases are `context.md` § Layers.

## Out of this action

- Edits to code, spec, design, tasks, or proposal
- A thread whose latest reply already carries a marker

## Steps

1. `threads <pull> --unmarked`: every open thread whose latest reply has no marker.
2. On each, reply with one line: `sdd:layer=<layer> → <phase>`, or `sdd:layer=out — #<new issue>`. The layer is the change file the remark is about. A rebase or a merge conflict is `code`.
3. `conversation.unanswered` is true: `conversation.last` is one request. `thread say <pull> 'sdd:layer=<layer> → <phase>'`.
4. Leave every thread open. The skill of that layer closes it with `thread fix`. `out`: open the issue, then `thread resolve` yourself.
5. `npx sdd unwait <issue>`. Do not set the phase label.

## Check

- `threads <pull> --unmarked` is empty
- The conversation request has a following comment with `sdd:layer=`
- Every `out` thread points at an issue and is resolved
- Change files are untouched

## Stop

- Every unanswered thread carries a marker: that is the Hand-off. Then unwait. The machine moves to the earliest marker on the next poll. A round of only `out` only unwaits.
