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

Labels unanswered PR threads and one conversation comment. Leaves change files untouched and does not resolve threads. The result is a reply, not a commit.

## Out of this action

- Edits to code, spec, design, tasks, or proposal
- A thread whose latest reply already carries `sdd:layer=` or `sdd:note`

## Layers

| Marker | Phase the machine opens |
|---|---|
| `proposal` | `proposing` |
| `spec` | `specifying` |
| `design` | `designing` |
| `tasks` | `tasking` |
| `code` | `implementing` |
| `out` | leave the phase; open a new issue when one is needed |

Earliest to latest: proposal, spec, design, tasks, code.

## Steps

1. Read each open review thread whose latest reply has no `sdd:layer=` and no `sdd:note`.
2. The last conversation comment with no spy mark and no `sdd:note`, `sdd:layer=`, or `sdd:begin` is one request. Reply with `npx remote-solver thread say <pull> 'sdd:layer=<layer> → <phase>'`. A rebase or a merge conflict is `sdd:layer=code → implementing`.
3. On a review thread, reply with one line: `sdd:layer=<layer> → <phase>` or `sdd:layer=out — #<new issue>`.
4. Leave the thread open. The layer skill resolves it after `sdd:fixed`. `out`: open the issue, then resolve the thread yourself.
5. `npx remote-solver unwait <issue>`. Do not set the phase label. The machine moves to the earliest marker on the next poll. A round of only `out` only unwaits.
6. Keep later files.

## Check

- Every unanswered thread has a reply with `sdd:layer=`
- The conversation request has a following comment with `sdd:layer=`
- Every `out` thread points at an issue and is resolved
- Change files are untouched

## Stop

- The round is labeled. The phase skill edits on the next run.
