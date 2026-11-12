sdd-delta: ab49d6f2d3c54c6f

## Source

`openspec/changes/issue-50/design.md`, section **Technical prerequisites** (`Depends: #49` and that the open review already carries each thread's marker).

No implementation files in this card: the dependency is tracked on the issue and the neighbor cycle for #49 must expose thread markers on the window's review reading before the scenario slices land.

Seams (no child issues): neighbor cycle marker plumbing vs `layerAct` counting in this change; withhold-in-machine from the unchanged policy rule vs inactive chrome owned by the window.

## Proof

No scenario-driven test in this slice. Unblock the held, unmarked, active, and open-question slices by satisfying **Technical prerequisites** in `design.md` (issue #49 accepted, markers visible on review as described there).
