---
status: accepted
---

# A merge settles again in the same turn

`decide` still returns `kind: merge` on `accepting` with an archived change, green checks, and `sdd:auto-merge`. `turn` performs that merge and settles the same issue again. The caller sees `done`: the phase is `accepted` and the issue is closed. `step`, the spy poll, and `driveIssue` all read that outcome. `plan` still prints `kind: merge` and does not merge. A failed rebase throws, and the second settlement does not run. After `merge()`, the next read of that pull request is `MERGED`; if it is still open, `merge` throws.

Printing `merge` and leaving the close to a second `step` was rejected: the chat and the spy each invented a follow-up, and they disagreed. Closing the issue inside `turn` without settling again was rejected: the close already lives in `settle` once the pull request is merged.
