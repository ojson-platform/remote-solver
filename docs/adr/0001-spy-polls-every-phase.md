---
status: accepted
---

# The spy polls every phase

The spy reads every open cycle on each poll and starts whatever that cycle can do now, in any phase. `sdd:accepted` is not a separate watcher. A person moves a gate by changing labels; the next poll notices, the same way it notices a green check or a new review thread.

Parallelism only caps how many cycles run at once (default 2). Each cycle has its own worktree, because two branches cannot share one checkout. A step that records no commit goes idle until the decision changes, so the next poll does not repeat it.

Considered a watcher that woke only for `sdd:accepted`, and a single checkout that switched branches. The first misses every other gate. The second cannot run two cycles at once.
