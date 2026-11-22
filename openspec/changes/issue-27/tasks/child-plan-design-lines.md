sdd-delta: e3b0c44298fc1c14

Design item: `openspec/changes/issue-27/design.md`, **Approach** — `PlanDocument` and `DesignDocument` through `PlanLines` (first wave, one child).

## Source

File one child cycle in the `remote-solver` queue. The issue carries labels `remote-solver` and `sdd:cycle`. The body names the Plan and Design surfaces only and states the caller-visible rule from design: every source line the leaf paints renders markdown (headings, lists, emphasis, links, code); the line stays a comment target; a click opens the remark draft on that line; there is no diff row. The child introduces the shared line renderer where later children will call it; this host does not implement that engine.

After the issue exists, run `node scripts/sdd.mjs link <child> parent 27`. Do not write `Parent:` or blocker lines in any body. Leave application source untouched.

Seams (no child of their own): one `PlanLines` leaf shared by Plan and Design versus per-surface diff and task leaves later; a single markdown-engine function versus painting a whole section as one document (rejected — would drop per-line anchors); platform refactor child stays unfiled.

## Proof

No scenario-driven test on this host. When the child exists, the board and sidebar under #27 show one parent-linked cycle with the rule above in its description, and the child has no `blocked-by` link yet.
