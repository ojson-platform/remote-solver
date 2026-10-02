---
status: accepted
---

# The session calls the same turn the spy does

A person can drive one issue in a chat. That session and the spy both settle the issue through one turn: mechanical phase moves, and a merge when that is the decision. The session prints the decision and runs the named step in the chat. The spy runs the same step through the package runtime, in a checkout the repository port prepared.

The session checkout is `.worktrees/sdd-<key>`. The spy's checkout is `.sandcastle/worktrees/`. The two are not run together. A race between them is left for later.

Running `remote-solver issue` from the chat was rejected: that hides the step from the person. Sharing one checkout directory was rejected: the spy's directory is not the session's, and this session does not need it.
