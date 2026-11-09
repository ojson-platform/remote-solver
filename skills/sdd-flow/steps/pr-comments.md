mode: mechanical

# sdd-pr-comments

Labels unanswered PR threads and one conversation comment. Leaves change files untouched and does not resolve threads. The result is a reply, not a commit. Layers and their phases are `CONTEXT.md` § Layers.

## Out of this action

- Edits to code, spec, design, tasks, or proposal
- A thread whose latest reply already carries a marker

## Steps

1. `threads <pull> --unmarked`: every open thread whose latest reply has no marker.
2. On each, reply with one line: `sdd:layer=<layer> → <phase>`, or `sdd:layer=out — #<new issue>`. The layer is the change file the remark is about. A thread on an unchecked item under Open decisions is `design`. A thread on an unchecked item under Open questions is `proposal`.
3. `conversation.unanswered` is true: `conversation.last` may hold several asks. They are one request, and the cause is the person's words. This step does not sort the request by which action it names.
   - This phase has a row in `CONTEXT.md` § Layers, and the request asks it to do something now: `thread open` on the line the request names. The body is `sdd:layer=<layer> → <phase> <cause>`. After that thread is open, `thread say <pull>` that same line. The conversation line answers the comment. The open thread is the instruction. A conversation line alone does not start the work, and an unanswered conversation is classified again before the thread runs. When the request names no line, the line is the first diff line of that row's change file that is not an unchecked item under Open questions or Open decisions. When that file is not in the diff, use the first such diff line of the pull request. For `spec`, the file is the spec the request names, or the first spec file of the change when it names none. For `code`, the file is the one the request names, or `tasks.md` when it names none.
   - This phase has no row (`verifying`, `accepting`), and the request asks it to do something now: do not open a `code` thread. `thread say <pull> '<cause>'` with no marker, then Wait (`CONTEXT.md`) with the cause.
   - The request asks the cycle to do nothing, or only names the work as a later phase's: `thread say <pull> 'sdd:note <cause>'`.
4. Leave every thread open. The skill of that layer closes it with `thread fix`. `out`: open the issue, then `thread resolve` yourself.
5. Step 3 Waited: leave `sdd:wait-human` set. Otherwise `unwait <issue>`. Do not set the phase label.

## Check

- `threads <pull> --unmarked` is empty
- The conversation request has a following comment. A phase with a row carries `sdd:layer=` there and on an open thread. A request that asks nothing, or names a later phase, is `sdd:note`. `verifying` and `accepting` carry the cause with no marker, and this step Waited
- Every `out` thread points at an issue and is resolved
- Change files are untouched

## Stop

- Every unanswered thread carries a marker: that is the Hand-off. Then unwait, unless step 3 Waited. The machine moves to the earliest open thread marker on the next poll. An open thread of this phase carries the instruction, and the skill of that layer runs it. A conversation note moves nothing. A round of only `out` only unwaits.
