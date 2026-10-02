---
name: sdd-flow
description: >
  Drives one issue in this chat until the machine waits. The machine names
  the skill; this chat runs it. Start with /sdd-flow <key>, optionally
  auto-plan, auto-spec, and auto-design.
mode: judgment
---

# sdd-flow

One chat, one issue. `/sdd-flow <key>` starts it. Words `auto-plan`, `auto-spec`, and `auto-design` on that invocation are the issue labels `sdd:auto-plan`, `sdd:auto-spec`, and `sdd:auto-design`. A later `/sdd-flow <key>` starts or switches issues. The next message in this chat continues the same issue. This skill does not wake itself.

Do not run `remote-solver issue`. Do not choose a skill from the phase. `step` names it.

The issue is already in the cycle: the queue label and `sdd:cycle` are set before this session. This skill does not add them.

## Start

1. Run `node scripts/sdd.mjs step <key>` and add `--auto-plan`, `--auto-spec`, `--auto-design` for each word named in the invocation.
2. Read the printed decision and follow Act.

`done` with reason `not in the open cycle` means the issue is not in the cycle. Say that and stop.

## Act

- `agent`: run `node scripts/sdd.mjs worktree <key>`. The printed path is the cwd for every edit and commit in this issue. Open `steps/<name>.md` for the printed action. The printed decision's `queue` and `base` are the queue label and the base branch for that step. A commit was made: run `node scripts/sdd.mjs step <key>` again and follow Act. No commit: stop and say that the action made no commit.
- `wait` or `done`: stop and say the reason.

## The next message

Agreement (`ok`, `accept`, `/sdd-flow ok`, `/sdd-flow accept`, «план ок», «спека ок», «дизайн ок») when the printed decision has `gate`: run `node scripts/sdd.mjs accept <key>`, then Act from a fresh `step`.

Any other wait: say the reason. Leave it in place.

A request to change the artifact: edit it in the worktree, publish (`CONTEXT.md` § Publish), run `node scripts/sdd.mjs unwait <key>`, then Act from a fresh `step`.

Any other message while waiting: say what is still waited for.

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
| `fix-implementation`                    | agent   | `fix`                                   |
| `classify-failures`                     | agent   | `verify`                                |
| `classify-comments`                     | agent   | `pr-comments`                           |
| `archive`, `unarchive`                  | agent   | `accept`                                |
| `advance`                               | machine | phase label change                      |
| `wait`                                  | person  | review, open question, children, checks |
