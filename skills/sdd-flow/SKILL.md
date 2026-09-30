---
name: sdd-flow
description: >
  Computes the next SDLC action from tracker labels, the pull request, and
  openspec files. Implemented by src/machine/flow.ts. Agents do not choose
  the layer skill themselves.
mode: judgment
---

# sdd-flow

The machine is `src/machine/flow.ts` in this package. It reads the tracker, the review, and the change, then phase policy returns the next action. `main.ts` is a spy: it polls the tracker and runs up to `--parallel` issues (default 2) in this process. Each issue's agent runs in the worktree sandcastle keeps for `sdd/<key>`, until that issue waits. The agent does not execute this skill and does not pick the next skill.

One worker step is one phase action. It ends in one signal (`context.md` § Outcome): Publish, Wait, or Hand-off. A run with none is idle: the machine does not start it again until the decision changes. The next step reads state again. After the change is archived and the checks are green, the machine waits for a person to merge the pull request. `sdd:auto-merge` rebases it without that person. Once the pull request is merged, the machine sets `sdd:accepted` and closes the issue.

## Actions

| Code | Who | Skill |
|---|---|---|
| `create-proposal`, `improve-proposal` | agent | `sdd-plan` |
| `restore-baseline` | agent | `sdd-baseline` |
| `create-initial-specs`, `improve-specs` | agent | `sdd-specify` |
| `create-design`, `improve-design` | agent | `sdd-design` |
| `create-tasks`, `improve-tasks` | agent | `sdd-tasks` |
| `implement-next-task` | agent | `sdd-implement` |
| `fix-implementation` | agent | `sdd-fix` |
| `classify-failures` | agent | `sdd-verify` |
| `classify-comments` | agent | `sdd-pr-comments` |
| `archive`, `unarchive` | agent | `sdd-accept` |
| `merge` | machine, no agent | rebase the pull request |
| `advance` | machine, no agent | phase label change |
| `wait` | person | review, open question, children, checks |

The machine detects a missing artifact itself: no `proposal.md`, no baseline for a `### Modified` id, no delta, no `design.md`, no `tasks.md`, no open task. A skill does not check for those.

Human gate: a person moves the phase on the issue from `proposing`, `specifying`, or `designing` to `proposed`, `specified`, or `designed`; `remote-solver accept <key>` does the same. The machine checks the artifact and open items, then advances or moves the issue back with a comment naming what is left. The machine opens the gate: once the artifact is published with nothing open and the issue has no `sdd:auto-plan`, `sdd:auto-spec`, or `sdd:auto-design`, it sets `sdd:wait-human` and posts the ask. With the tag it advances. Skills Wait only for a blocker. The robot does not set `proposed`, `specified`, or `designed`. On `accepting` a person merges the pull request. A human comment in the pull request conversation is classified first and rolls the issue back to the marker's phase before that wait. `sdd:auto-merge` lets the machine rebase it. The machine sets `accepted` only after that merge.

Signal order inside a phase: archive on an early phase, then unlabeled threads, then a marker for an earlier phase, then a missing baseline on `specifying`, then this phase's threads, then a missing file, otherwise wait or a mechanical advance. On `verifying`, green checks come before a marker, unless the checks are red and a marker is already there.
