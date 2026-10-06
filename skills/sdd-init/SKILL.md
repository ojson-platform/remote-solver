---
name: sdd-init
description: >
  Connects a service to SDD from this chat: OpenSpec, a test platform, trace
  and coverage, CI, and a block in AGENTS.md. Not a cycle phase. The machine
  does not call it.
short_description: Connects a service to SDD with OpenSpec, tests, and CI.
mode: judgment
---

# sdd-init

Connects this service to SDD. One chat, the service root, the base branch. A person is in the chat: propose, do, and ask along the way. The person commits. This run does not end in a cycle signal, and it does not start a cycle.

The machine never calls this skill. There is no command for it and no issue branch.

## Environment

Decide where this service lives before the stages. If `../sdd-flow/scripts/adapters/host.md` exists, follow that note for rules, how a required check is written, credentials, and the chat command. Otherwise the remote is GitHub: `.github/workflows`, and a required check is branch protection. Neither the note nor GitHub: ask. Do not guess.

## Stages

The next stage does not start until the current one is done.

1. **OpenSpec.** `openspec/config.yaml`, `openspec/specs/`, and `openspec/changes/` exist, and `openspec validate --all --strict --no-interactive` exits 0. Missing: `openspec init` through the CLI. Do not assemble the tree by hand. A host note that names an agent preset: extend it. Do not restore a baseline. `openspec/specs/` may be empty. It grows by capability inside cycles. Then write the block from stage 8 with `Status: connecting` and an open question for every entity this run has not found yet.
2. **The layer.** A scenario is proven by a test that drives the behavior the scenario names and checks its outcome, at the boundary the spec talks about. Look for that layer in the project. A stack preset may name it. Found: record the command for one file, with `<test-file>`, and the command for the whole layer. Take those commands from the service. Missing: tell the person that the test drives the public behavior and checks the scenario's outcome, and ask which platform does that. Do not choose a platform. Leave the open question.
3. **Trace and coverage.** A test is tied to a scenario in the stack's format. Node with vitest: `@ojson/spec-coverage`, with `spec`, `requirement`, and `scenario` in the test, `globalSetup` and `reporter` in `vitest.config`, and `.spec-coverage/` in `.gitignore`. UI, once the person has chosen it: Playwright, the feature folder is the spec id, and `test.step` is the Flow text. A stack this skill does not name: use the format the service already documents. No format: an open question. The layer run fails when a scenario has no test: that run is the coverage check. It does not: coverage is an open question. Do not invent a counter.
4. **CI.** Two checks are required to merge, and each is explicit so its log can be read.
   - Spec validation: `openspec validate --all --strict --no-interactive`.
   - The layer from stage 2, once its command is known. A common platform that already runs those tests does not replace this check.
   Coverage from stage 3 is a third check only when it is a different command. Do not add a fast suite, a type check, or any other test command. The host note says how a required check is written. With no host note, one workflow on `pull_request` runs the checks this stage names. Branch protection that requires the check is named for the person when this skill cannot set it. A check whose command is still an open question is not written.
5. **Connection spec.** Ensure `openspec/specs/sdd-connection/spec.md`. It is an infrastructure spec of the steady state. A scenario records only what is already true: the layer, once known, and each required check from stage 4 that exists. An open question is not a scenario. The `openspec/` tree is not a scenario. A later run adds a scenario when its question closes. `openspec validate --all --strict --no-interactive` exits 0 after the edit.
6. **The machine.** `openspec/config.yaml` already exists from stage 1. Ask for the queues (each name required, description optional) and which bots comment on pull requests. If no queue name is given, stop this stage. Do not write the file without `queues`. Write the `sdd` key into that file. `queues` is required. `base`, `branch-scope`, and `ignore-comments` are written only when the service differs from `trunk`, `sdd`, and an empty bot list. Leave `schema`, `context`, and `rules` as they are. Do not create `sandcastle.yaml`. Do not write an adapters path. `npm install` this package so `remote-solver` is the spy. The chat is `node scripts/sdd.mjs` from the `sdd-flow` skill, unless the host note names another command. Do not skip this stage when a host note exists.
7. **Commit rule.** `CONTEXT.md` § Publish looks for it in `CONTRIBUTING`, the agent style guide, or commitlint. It is written somewhere: leave it. It is not: ask, and write one line where this repository keeps such rules. That line is the repository's text, not the block.
8. **Block.** Keep it at the end of `AGENTS.md`, between `<!-- sdd:init:begin -->` and `<!-- sdd:init:end -->`. A later run replaces only that block. Leave `<!-- sdd:begin -->` and `OJSON_INFRA_AGENTS` untouched. Update it at the end of each stage.

While any question is open the block starts with `Status: connecting` and contains `Open questions:` with one line per missing entity. A known command is still written. The lines are:

- the layer command, once known;
- how to run one file, with `<test-file>`, once known;
- the fast suite, when the service has one, and what it skips;
- the type check, when the service has one;
- the trace format, once known;
- where the test for a spec lives, as a path rule with `<spec-id>`, once known;
- `Open questions:` and its lines, while any remain.

The command comes from the service, CI, or a hook. Another spelling beside it: one line on how they differ. Do not invent a package-manager command. The block does not contain the queue label, the base branch, the commit subject, or a canon of how to write a test. How to write a test in this repository is a project skill the author writes.

## Stop

`Open questions:` remains: the service is connecting. Say the questions. The cycle waits. There is no further stage.

No open questions: drop `Status: connecting`. The service is connected. The cycle starts with `remote-solver spy` or `/sdd-flow <key>`. With no host note, GitHub creates the `sdd:*` labels on first use. A host note that names the chat command replaces `node scripts/sdd.mjs` for that host.
