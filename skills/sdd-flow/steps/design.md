mode: judgment

# sdd-design

Writes the technical decision for this change.

## Out of this action

- Code, tests, spec, proposal, tasks
- A rollout plan
- The `sdd:designed` label

## Steps

1. `design.md` is already right and `threads <pull> --layer design` is empty: go to step 6.
2. Otherwise write `design.md` by `CONTEXT.md` § Artifacts. The verification boundary names every capability, where its scenarios are observed, and the commands: a one-file command that contains `<test-file>`, and the layer command. A fast suite is included when the init block names one, otherwise `none`. The last line of the section is the type check, once for the change, or `none`.
   The block between `<!-- sdd:init:begin -->` and `<!-- sdd:init:end -->` in `AGENTS.md` contains `Open questions:`: Wait. Name those questions. Do not search for commands. Do not publish.
   The block is present and has no open questions: copy its one-file command, its layer command, its trace line, and its test path rule into the boundary. A fast suite line is copied when the block has one, otherwise `none`. Do not search again. Do not edit `AGENTS.md`.
   The block is absent: find the commands in CI, a hook, `package.json`, or a Makefile, and write them in `design.md`.
   Neither a one-file command nor a layer command is found: Wait. The service is not connected to SDD. The person runs `/sdd-init`.
3. **Write the approach.** `## Approach` says how this change is built: module boundaries, risks, rejected alternatives. `none` when there is nothing to say. Leave the three required sections as step 2 wrote them.
4. No decision yet: an open decision item. Leave it open.
5. `improve-design`: Fix thread (`CONTEXT.md`), layer `design`.
6. Publish (`CONTEXT.md`). Mirror: `Design`. Open decisions do not delay the push.
7. An open decision remains: Wait (`CONTEXT.md`) with the open decision.

## Check

- Every § Artifacts section of `design.md` is present. `## Approach` is filled or `none`
- Every capability names its verification boundary and its commands, and the one-file command contains `<test-file>`
- The text agrees with the proposal and the spec
- Nothing manual remains after merge

## Stop

- Publish. The machine opens the review gate.
- An open decision: Publish, then Wait with the open decision.
- `Open questions:` in the init block: Wait with those questions.
- No one-file command and no layer command in the repository: Wait. The person runs `/sdd-init`.
- The spec does not give a capability enough behavior to name its boundary: Hand-off to `spec` on that requirement.
