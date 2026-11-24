mode: judgment

# sdd-design

Writes the technical decision for this change.

## Out of this action

- Code, tests, spec, proposal, tasks
- A rollout plan
- The `sdd:designed` label

## Steps

1. § Upstream says the stamp matches and `threads <pull> --layer design` is empty: go to step 6. An open design thread does not write `design.md` in this step. Otherwise the block names the edit. Do not judge `design.md` already right from the whole spec.
2. When `threads <pull> --layer design` is not empty, go to step 5. Otherwise write `design.md` by `CONTEXT.md` § Artifacts. When the block names an input revision, edit the existing design for those facts and do not replace the rest from a fresh reading of the whole spec. The file does not exist yet: write it from the current specs. Move `sdd-absorbed:` to that revision only when the input is folded. Do not blank a section this file owns. The verification boundary names every capability, where its scenarios are observed, and the commands: a one-file command that contains `<test-file>`, and the layer command. When the trace line names `@ojson/spec-coverage`, the one-file command also contains `<titles>`. A fast suite is included when the init block names one, otherwise `none`. The last line of the section is the type check, once for the change, or `none`.
   The block between `<!-- sdd:init:begin -->` and `<!-- sdd:init:end -->` in `AGENTS.md` contains `Open questions:`: write each question as an unchecked item under `## Open decisions` in `design.md`. Do not publish. Do not search for commands.
   The block is present and has no open questions: copy its one-file command, its layer command, its trace line, and its test path rule into the boundary. A fast suite line is copied when the block has one, otherwise `none`. Do not search again. Do not edit `AGENTS.md`.
   The block is absent: find the one-file command, the layer command, and the type check in CI, a hook, `package.json`, or a Makefile, and write them in `design.md`. The section shape is § Artifacts. Stop when those three commands are known.
   No one-file command, or no layer command: write one unchecked item under `## Open decisions` that names the missing command. Do not publish. The person fills the missing command in the init block.
3. **Write the approach.** `## Approach` says how this change is built: module boundaries, risks, rejected alternatives. `none` when there is nothing to say. Leave the three required sections as step 2 wrote them.
   When the service describes its architecture, record the seams of this change in the service model.
4. No decision yet: an open decision item. Do not Wait for it. The phase paints the count. Leave it open.
5. `improve-design`: Fix thread (`CONTEXT.md`), layer `design`.
6. An approach sentence that names an observation no scenario names is a Hand-off to `spec` on that sentence. When that thread is already open, do not open another. Do not publish and do not move `sdd-absorbed`. Publish (`CONTEXT.md`) only when every such sentence is named by a scenario. When `design.md` is in the commit, focus with marker `sdd:focus:design`. Mirror: `Design`. Open decisions do not delay the push.
7. An open decision remains in `design.md`. Do not Wait for it. The phase paints the count.

## Check

- Every § Artifacts section of `design.md` is present. `## Approach` is filled or `none`
- Every capability names its verification boundary and its commands, and the one-file command contains `<test-file>`
- The text agrees with the proposal and the spec
- Nothing manual remains after merge

## Stop

- Publish. The machine opens the review gate. An open decision stays in the file. This step does not Wait for it. The phase paints the count.
- `Open questions:` in the init block: each question is an unchecked item under `## Open decisions`. Do not publish. The next poll waits on that item.
- No one-file command, or no layer command, in the repository: one unchecked item under `## Open decisions` names the missing command. Do not publish. The person fills the missing command in the init block.
- An approach sentence names an observation no scenario names: Hand-off to `spec` on that sentence and do not publish. The approach contradicts a scenario: Hand-off to `spec` on that scenario and do not move `sdd-absorbed`.
