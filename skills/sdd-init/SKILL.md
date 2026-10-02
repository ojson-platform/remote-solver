---
name: sdd-init
description: >
  Connects a service to SDD from this chat: OpenSpec, a test platform, trace
  and coverage, CI, and a block in AGENTS.md. Not a cycle phase. The machine
  does not call it.
mode: judgment
---

# sdd-init

Connects this service to SDD. One chat, the service root, the base branch. A person is in the chat: propose, do, and ask along the way. The person commits. This run does not end in a cycle signal, and it does not start a cycle.

The machine never calls this skill. There is no command for it and no issue branch.

## Environment

Decide where this service lives before the stages. Arcadia: `.arc/`, `ya.make`, `a.yaml`, or `arc root`. GitHub: a `.git` remote on GitHub and `.github/workflows`. Neither: ask. Do not guess.

| | GitHub | Arcadia |
|---|---|---|
| VCS | `git` | `arc`. Search only inside this service |
| Agent rules | `AGENTS.md` | `AGENTS.md`, and `aisuite.yaml` extending `lavka/openspec` |
| CI | a job in `.github/workflows` | a test in `ya.make` or a check in `a.yaml` |
| A required check | branch protection | a required Arcanum check |
| The cycle after this skill | runs. The spy is `remote-solver` from the package. The chat is `scripts/sdd.mjs` from the skill | runs. The spy is `remote-solver` from the package. The chat is `scripts/sdd.mjs` from the skill |

## Stages

The next stage does not start until the current one is done.

1. **OpenSpec.** `openspec/config.yaml`, `openspec/specs/`, and `openspec/changes/` exist, and `openspec validate --all --strict --no-interactive` exits 0. Missing: `openspec init` through the CLI. Do not assemble the tree by hand. On Arcadia, `aisuite.yaml` extends `lavka/openspec`. Do not restore a baseline. `openspec/specs/` may be empty. It grows by capability inside cycles.
2. **Test platform.** Specs are true only when tests prove them. This service needs a runner that executes one test file, and a fast suite. Something is missing: set it up, including a type check when the stack has one. It cannot be set up, or the person refuses: stop and say that SDD will not run here, because nothing can confirm that the specs are true. Do not write the block. Stages 3–7 do not run.
3. **Trace and coverage.** A test is tied to a scenario in the stack's format, and a scenario with no test fails the check. Node with vitest: `@ojson/spec-coverage`, with `spec`, `requirement`, and `scenario` in the test, `globalSetup` and `reporter` in `vitest.config`, and `.spec-coverage/` in `.gitignore`. Go on Arcadia: a docstring `<spec-id>:` and the testsuite the service already documents. UI: Playwright, the feature folder is the spec id, and `test.step` is the Flow text. A stack with no coverage check: set up the trace only, and say that coverage stays with review.
4. **CI.** The fast suite, the coverage check, and `openspec validate --all --strict --no-interactive` run on a pull request in this environment's CI. The check is required to merge. What this skill cannot set: branch protection without admin rights, a required Arcanum check. Name the exact setting and wait until the person confirms it is done.
5. **The machine.** `sandcastle.yaml` at the service root has `comments.ignore`: ask which bots comment on pull requests and write their logins. Without the file the machine ignores nobody, and the first bot comment rolls the phase back. Do not write an adapters path into that file. `npm install` this package so `remote-solver` is the spy. On GitHub the chat is `node scripts/sdd.mjs` from the `sdd-flow` skill. On Arcadia do not skip this stage: preset `lavka/sdd` already linked the skills, and the chat is `node ../sdd-flow/scripts/sdd.mjs`. The file `sdd-flow/scripts/adapters/index.mjs` is placed once in `ai/artifacts`.
6. **Commit rule.** `CONTEXT.md` § Publish looks for it in `CONTRIBUTING`, the agent style guide, or commitlint. It is written somewhere: leave it. It is not: ask, and write one line where this repository keeps such rules. That line is the repository's text, not the block.
7. **Block.** Append it at the end of `AGENTS.md`, between `<!-- sdd:init:begin -->` and `<!-- sdd:init:end -->`. A later run replaces only that block. Leave `<!-- sdd:begin -->` and `OJSON_INFRA_AGENTS` untouched.

The block has five lines:

- the fast suite, and what it skips;
- how to run one file when it is outside the fast suite, with the placeholder `<test-file>`;
- the type check, when the service has one;
- the trace format from stage 3, in one line;
- where the test for a source file lives, as a path rule with `<source-file>`.

The command comes from CI or a hook. Another spelling beside it: one line on how they differ. Do not invent a package-manager command. The block is written only after stages 2–4, so it never says that no command exists.

The block does not contain the queue label, the base branch, the commit subject, or a canon of how to write a test. The trace line names the format and the path rule names the place. How to write a test in this repository is a project skill the author writes.

## Stop

On GitHub, after the block: the service is connected. The cycle starts with `remote-solver spy` or `/sdd-flow <key>`. There is no further stage. GitHub creates the `sdd:*` labels on first use.

On Arcadia, after the block: the service is connected. The spy is `remote-solver` from the package. The chat is `node ../sdd-flow/scripts/sdd.mjs`.
