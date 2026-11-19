mode: mechanical

# sdd-cover-baseline

Trace the baseline scenarios the Upstream block names. Do not edit product code, a stable spec, or the delta. Reads, edits, and check commands follow `CONTEXT.md` § Once.

## Read only

1. The Upstream block. Each line `spec / requirement / scenario` is one triple. Do not collect the list from the specs.
2. `## Verification boundary` in `openspec/changes/issue-<issue>/design.md`.
3. The stable spec `openspec/specs/<spec>/spec.md` for a triple, only to place a Hand-off on its scenario line.

## Out of this action

- A scenario the Upstream block does not name
- An edit of product code, a stable spec, or a delta spec
- A second run of the layer command

## Steps

1. No test path in `## Verification boundary`: Hand-off to `design` on that section. Write no test.
2. For each named triple, write one test in the file the boundary's test path names for that capability. The names are the triple: the spec id, the requirement name after a rename, and the scenario title. The test observes today's behavior. Run the one-file command from the boundary. A red test is a Hand-off to `spec` on that scenario line in `openspec/specs/<spec>/spec.md`. Do not edit product code. Do not edit the spec. Do not commit.
3. When every named triple is green on the one-file command, run the layer command from the boundary once, and the type check once when the boundary names it. Do not run the layer command a second time. A red layer command on a file or triple outside the list: Hand-off to `code` on that file. The one-file tests that are already green are committed.
4. One commit of the new tests. Publish (`CONTEXT.md`). Do not call focus.

## Check

- Only the triples the Upstream block named gained a test
- A red trace did not change product code or a spec
- The layer command ran once, after the one-file commands exited 0

## Stop

- Publish when the named triples are green.
- Hand-off to `spec` on a red baseline trace, or to `design` when the boundary names no test path, or to `code` on a red layer command outside the list.
