---
status: accepted
---

# `fix-implementation` runs `sdd-fix`, a skill apart from `sdd-implement`; both are mechanical

`sdd-implement` walks one task card and reads five named things; its whole point is not exploring the repository. `sdd-fix` walks the `code` threads: it reads `threads <pull> --layer code`, the files those threads cite, and the task card for that code. The two actions have different inputs and different read boundaries, so `fix-implementation` routes to its own skill. `policy.ts` already branched on `layer === 'code'`; only the target changed.

Both are `mode: mechanical`. The instruction `sdd-fix` walks is already written: the thread names the file, the line, and the ask, and the marker `sdd:layer=code` was set upstream by `sdd-pr-comments` (itself mechanical) or `sdd-verify`. Deciding whether a remark is a defect or a behavior change is that upstream classification, not this skill's work; the Hand-off to `spec` here is the same guard `sdd-implement` carries. The one `fix-implementation` run on record produced its commit in one pass on the mechanical model, while the action still lived inside `sdd-implement`.

Keeping both actions in one skill was the state before: the fix section was the longest in the catalogue and dragged thread handling into a skill that must not read beyond its task card. Making `sdd-fix` a judgment skill was tried and reverted: it would spend the slower model on a classification already made.
