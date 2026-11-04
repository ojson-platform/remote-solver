mode: mechanical

# sdd-pr-comments

Labels unanswered PR threads and one conversation comment. Leaves change files untouched and does not resolve threads. The result is a reply, not a commit. Layers and their phases are `CONTEXT.md` § Layers.

## Out of this action

- Edits to code, spec, design, tasks, or proposal
- A thread whose latest reply already carries a marker

## Steps

1. `threads <pull> --unmarked`: every open thread whose latest reply has no marker.
2. On each, reply with one line: `sdd:layer=<layer> → <phase>`, or `sdd:layer=out — #<new issue>`. The layer is the change file the remark is about. A thread on an unchecked item under Open decisions is `design`. A thread on an unchecked item under Open questions is `proposal`. A rebase or a merge conflict is `code`.
3. `conversation.unanswered` is true: `conversation.last` is one request. A request that corrects a change file of this cycle is `thread open` on the line that shows it, with `sdd:layer=<layer> → <phase> <cause>`. A request that names a later action, or a side reminder, and does not correct the current artifact, is `thread say <pull> 'sdd:note <cause>'`. A correction with no line to stand on is the same note.
4. Leave every thread open. The skill of that layer closes it with `thread fix`. `out`: open the issue, then `thread resolve` yourself.
5. `unwait <issue>`. Do not set the phase label.

## Check

- `threads <pull> --unmarked` is empty
- The conversation request has a following comment with `sdd:layer=` or `sdd:note`
- Every `out` thread points at an issue and is resolved
- Change files are untouched

## Stop

- Every unanswered thread carries a marker: that is the Hand-off. Then unwait. The machine moves to the earliest open thread marker on the next poll. A conversation note moves nothing. A round of only `out` only unwaits.
