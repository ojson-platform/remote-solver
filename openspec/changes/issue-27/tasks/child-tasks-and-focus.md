sdd-delta: e3b0c44298fc1c14

Design item: `openspec/changes/issue-27/design.md`, **Approach** — `TaskFile` and focus prose (third wave, two children).

## Source

Assume `child-spec-diff-rows` is done and its Specify child key is known.

File two child cycles in the `remote-solver` queue, each with labels `remote-solver` and `sdd:cycle`. One body names the Tasks surface (`TaskFile`): each source line renders markdown, stays a comment target, opens the remark draft on click, no diff row; `###` stays a button because this surface does not use `partsOf`. The other names the focus block: prose renders markdown; the marker line stays the badge and is not a heading; scenario jumps stay `button.jump`; no line comment and no diff row.

For each child run `node scripts/sdd.mjs link <child> parent 27`, then `node scripts/sdd.mjs link <child> blocked-by <specify-child>`. The two children do not block each other. No `Parent:` or blocker body lines. No source edits on this host.

Seams already recorded on the first slice; none new. Platform child remains unfiled.

## Proof

No scenario-driven test on this host. #27 has four parent-linked children total; Tasks and focus children each `blocked-by` only the Specify child, not each other; every child body states its surface rule from design.
