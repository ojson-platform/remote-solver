---
name: sdd-flow
description: >
  Drives one issue in this chat until the machine waits. The machine names
  the skill; this chat runs it. Start with /sdd-flow <key>, optionally
  auto-plan, auto-spec, and auto-design.
short_description: Drives one issue through the SDD cycle until the machine waits.
mode: judgment
---

# sdd-flow

One chat, one issue. `/sdd-flow <key>` starts it. Words `auto-plan`, `auto-spec`, and `auto-design` on that invocation are the issue labels `sdd:auto-plan`, `sdd:auto-spec`, and `sdd:auto-design`. A later `/sdd-flow <key>` starts or switches issues. The next message in this chat continues the same issue. This skill does not wake itself.

Do not run `remote-solver issue`. Do not choose a skill from the phase. `step` names it.

Run this from the service root, the directory whose `openspec/config.yaml` names the queue. This skill does not add cycle membership. If `scripts/adapters/host.md` exists, membership is what that note says. Otherwise the issue already carries `sdd:cycle` and the queue label.

An issue with no assignee is claimed by the caller inside `step`. An issue assigned to someone else waits with `assigned to <login>`. Agreement to take it runs `node scripts/sdd.mjs assign <key>`, then Start again.

The issue's service directory, when set, names where the specs live. A value that is not this directory waits with `service is <path>`. Start again from that directory. An empty value means this directory is the service.

## Start

1. Run `node scripts/sdd.mjs step <key>` and add `--auto-plan`, `--auto-spec`, `--auto-design` for each word named in the invocation.
2. Read the printed decision and follow Act.

`done` with reason `not in the open cycle` means the issue is not in the cycle. Say that and stop.

## Act

- `agent`: run `node scripts/sdd.mjs worktree <key>`. The printed path is the cwd for every edit and commit in this issue. Open `steps/<name>.md` for the printed action. The printed decision's `queue` and `base` are the queue label and the base branch for the issue being driven in that step. A new child issue uses the first queue under `sdd.queues` in `openspec/config.yaml`, not the printed `queue`. A commit was made: run `node scripts/sdd.mjs step <key>` again and follow Act. No commit: stop and say that the action made no commit.
- `wait` or `done`: stop and say the reason.

## The next message

Agreement (`ok`, `accept`, `/sdd-flow ok`, `/sdd-flow accept`, «план ок», «спека ок», «дизайн ок») when the printed decision has `gate`: run `node scripts/sdd.mjs accept <key>`, then Act from a fresh `step`.

Agreement when the reason is `assigned to <login>`: run `node scripts/sdd.mjs assign <key>`, then Start again.

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
