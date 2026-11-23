---
name: sdd-flow
description: >
  Drives one issue in this chat until the machine waits or the issue is done.
  The machine names the skill; this chat runs it. Start with /sdd-flow <key>,
  optionally auto-plan, auto-spec, and auto-design. A later message in this
  chat continues the same issue.
short_description: Drives one issue through the SDD cycle until the machine waits.
mode: judgment
---

# sdd-flow

One chat, one issue, until `step` prints `done`. `/sdd-flow <key>` starts it. Words `auto-plan`, `auto-spec`, and `auto-design` on that invocation are the issue labels `sdd:auto-plan`, `sdd:auto-spec`, and `sdd:auto-design`. A later `/sdd-flow <key>` starts or switches issues. The next message in this chat continues the same issue. Do not ask for `/sdd-flow` again.

Do not run `remote-solver issue`. Do not choose a skill from the phase. `step` names it.

Run this from the service root, the directory whose `openspec/config.yaml` names the queue. This skill does not add cycle membership. If `scripts/adapters/host.md` exists, read it before the first command. Membership is what that note says. A chat command named there replaces `sdd` in this skill. Otherwise the issue already carries `sdd:cycle` and the queue label.

An issue with no assignee is claimed by the caller inside `step`. An issue assigned to someone else waits with `assigned to <login>`. Agreement to take it runs `sdd assign <key>`, then Start again.

The issue's service directory, when set, names where the specs live. A value that is not this directory waits with `service is <path>`. Start again from that directory. An empty value means this directory is the service.

## Start

1. Run `sdd step <key>` and add `--auto-plan`, `--auto-spec`, `--auto-design` for each word named in the invocation.
2. Read the printed decision and follow Act.

`done` with reason `not in the open cycle` means the issue is not in the cycle. Say that and stop.

## Act

`step` already applies a mechanical phase move and a merge the label allows. Act does not apply them again.

- `agent`: run `sdd worktree <key>`. Edit in the printed path. Do not search the tree for that checkout. Every `sdd` command runs from the service root. Do not rebase, commit, or publish except by the `sdd` command. When `sdd publish` exits non-zero, stop and name the exit. Do not rebase the branch by hand and do not open the program. A repository rule that runs a local check before push does not apply in this cycle. Pull-request checks are read when the phase is verifying. The printed decision's `step` carries the issue text, then the upstream block, then the action text with this service's hooks. Follow that text. Do not open the step file, the program, its adapters, or another skill's scripts. The printed text is the outcome. The printed decision's `queue` and `base` are the queue label and the base branch for the issue being driven in that step. A new child issue uses the first queue under `sdd.queues` in `openspec/config.yaml`, not the printed `queue`. When the step ends in Publish or Hand-off, run `sdd step <key>` again and follow Act. When the step ends in Wait, run `sdd step <key>` once more and follow Act. When the step leaves no Publish, no Hand-off, and no Wait, stop.
- `advance`: run `sdd step <key>` again and follow Act.
- `wait` with `dialog`: do not stop. Say that this phase has open questions and this turn answers them. The printed `text` is the question. Show every entry together in the client's question dialog. The prompt is that text. Do not open the change to prepare the dialog. The printed text and the issue text already in the step are enough for a choice. Do not open the tracker to invent one. A choice is a whole answer the person can accept unchanged. Offer every distinct one the issue and the entry support. Never offer a choice that sends the person to another field or stops the cycle. Do not repeat an answer to fill another choice. When only one whole answer is ready, it is the first choice. The second choice skips the entry: it records nothing, the item stays open, and the next run asks it again. One whole answer is enough: the dialog still opens. The person's own words stay available. Do not ask by printing the question alone. A skip records nothing. When every entry was skipped, stop. The person may answer every entry, some of them, or dismiss. For each answer, run that entry's `record` with the person's words unchanged in place of `<answer>`. That command is the only post. Do not edit the change. Then run `sdd step <key>` and follow Act. When that command exits non-zero, stop, and the message names the file and the exit. When the next step still lists an entry the person answered, stop, and say the record did not close it. Do not post the answer another way. Closing the dialog answers nothing and stops. An entry left unanswered stays open, and the next run asks it again. When the next step lists only entries the person left unanswered, stop. A later message that answers these entries is recorded the same way.
- `wait` without `dialog`, or `done`: stop.

## Stop

When Act stops, write one message in the language of this chat. Say what this run finished. Say why it stopped. Name the files that matter for this stop as links the person can open. The printed reason is a fact in that message, not the whole message. Do not reuse a fixed wording.

## The next message

This session is still the skill.

Agreement is a sentence that accepts the current stop and asks to go on. `ok`, `accept`, `/sdd-flow ok`, `/sdd-flow accept`, «план ок», «спека ок», and «дизайн ок» are examples, not the whole set.

Agreement when the printed decision has `gate`: run `sdd accept <key>`, then Act from a fresh `step`.

Agreement when the reason is `assigned to <login>`: run `sdd assign <key>`, then Start again.

Agreement after a stop with no signal: run `sdd step <key>` again and follow Act.

A request to change the artifact: edit it in the worktree, publish (`CONTEXT.md` § Publish), run `sdd unwait <key>`, then Act from a fresh `step`.

`/sdd-flow` or `/sdd-flow <key>` while waiting runs Start again. The poll reads review threads. It does not accept a gate.

A message that answers entries of a printed `dialog`: run each answered entry's `record` with the person's words unchanged in place of `<answer>`. That command is the only post. Do not edit the change. Then Act from a fresh `step`. When the next step still lists an entry the person answered, stop, and say the record did not close it. Do not post the answer another way. An entry left unanswered stays open, and the next run asks it again.

A message that only asks where the cycle is: run `sdd step <key>` again and follow Act. Do not describe the cycle from an earlier print. Any other request is carried out. When that work moves the branch or the change, run `sdd step <key>` again and follow Act.

## Actions

`step` prints one of these. Act runs that skill. The chat does not pick a row.

| Code                                    | Who     | Skill                                   |
| --------------------------------------- | ------- | --------------------------------------- |
| `create-proposal`, `improve-proposal`   | agent   | `plan`                                  |
| `restore-baseline`                      | agent   | `baseline`                              |
| `create-initial-specs`, `improve-specs` | agent   | `specify`                               |
| `create-design`, `improve-design`       | agent   | `design`                                |
| `create-tasks`, `improve-tasks`         | agent   | `tasks`                                 |
| `implement-next-task`                   | agent   | `implement`                             |
| `cover-baseline`                        | agent   | `cover-baseline`                        |
| `repair-suite`                          | agent   | `repair-suite`                          |
| `fix-implementation`                    | agent   | `fix`                                   |
| `classify-failures`                     | agent   | `verify`                                |
| `classify-comments`                     | agent   | `pr-comments`                           |
| `archive`, `unarchive`                  | agent   | `accept`                                |
| `advance`                               | machine | phase label change                      |
| `wait`                                  | person  | review, open question, children, checks |
