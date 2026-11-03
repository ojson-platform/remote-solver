---
status: accepted
---

# The session calls the same turn the spy does

A person can drive one issue in a chat. That session and the spy both settle the issue through one turn: mechanical phase moves, and a merge when that is the decision. The session prints the decision and runs the named step in the chat. The spy runs the same step through the package runtime, in a checkout the repository port prepared.

The session and the spy share one checkout of `sdd/<key>`. When the branch is not checked out, that checkout is `.worktrees/sdd-<key>`. A worktree that already has the branch is reused, including one left under `.sandcastle/worktrees/`. A second worktree of the same branch is not added. The person and the agent write in that one tree.

Running `remote-solver issue` from the chat was rejected: that hides the step from the person. A second directory for the spy was rejected: git keeps one branch in one worktree, so the second `worktree add` fails.
