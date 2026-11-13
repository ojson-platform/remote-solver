sdd-delta: e3b0c44298fc1c14

Design item: `openspec/changes/issue-27/design.md`, **Approach** — Specify surface and `SpecRows` / `DiffRow` (second wave).

## Source

Assume `child-plan-design-lines` is done and its child key is known.

File one child cycle in the `remote-solver` queue with labels `remote-solver` and `sdd:cycle`. The body names the Specify / spec-diff surface and states the rule from design: row text renders the same markdown; the row keeps add/delete coloring and its comment control; a click opens the remark draft; coloring stays `diff-row` with `add` / `del` / `ctx` and `span.bit`; the control stays the row button, not `button.line`; anchors and fold behavior stay as design describes.

Run `node scripts/sdd.mjs link <child> parent 27`, then `node scripts/sdd.mjs link <child> blocked-by <plan-design-child>`. Do not write link lines in the body. No source edits on this host.

## Proof

No scenario-driven test on this host. The new cycle is parent-linked to #27, carries the Specify rule in its body, and is `blocked-by` the Plan and Design child only.
