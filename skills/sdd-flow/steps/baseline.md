mode: judgment

# sdd-baseline

Writes the current behavior of a capability that has no baseline. One commit, before the delta.

## Out of this action

- The delta of this change
- The desired behavior
- A baseline of the whole repository

## Steps

1. Read Scope and `## Capabilities` in the proposal. Cut ids by `CONTEXT.md` § Capability.
2. The cut is wrong when several ids name one rule, an id is a directory or a helper, a rule this checkout shows sits under `### Added`, or a rule this checkout does not show sits under `### Modified`. Move a shown rule under `### Modified`. Move an unshown rule under `### Added`. Rewrite the Capabilities lines so one rule is one id. Scope stays: names and the number of ids change, the change's contents do not. In that same commit, list every capability id under `## Shelf`, one `- <id>` line. That section is the published look. Do not use an HTML comment.
3. Write `openspec/specs/<id>/spec.md` for each `### Modified` id that has no file yet.
4. The spec holds today's behavior of that rule, from code and tests, including disagreements between helpers. Requirement and Scenario. Leave a disputed point as the code behaves.
5. `## Out of scope` is another id. It stays out of this spec even when the code sits in the same file.
6. The baseline states what this checkout does today. A gist that names behavior the checkout does not show stays out of that spec. Do not Wait for a person to choose the shelf, and do not Wait for that behavior to be put into the checkout.
7. Publish (`CONTEXT.md`): the baseline spec and the id edit in the proposal, one commit naming the capability. No mirror line.
8. After the push, `thread open` an `sdd:note` on each disputed line of the pushed commit.

## Check

- The baseline states nothing the code does not do
- A rule this checkout does not show sits under `### Added`, and this step wrote no baseline for it
- No paths and no function names
- Every `### Modified` id has `openspec/specs/<id>/spec.md`
- Every Requirement is needed to see the proposal's outcome; the rest is another id
- Scope is unchanged after the id edit

## Stop

- Publish. The next run writes the delta.
