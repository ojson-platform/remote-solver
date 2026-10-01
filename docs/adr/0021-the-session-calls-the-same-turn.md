---
status: accepted
---

# The session calls the same turn the spy does

A person can drive one issue in a chat. That session and the spy both settle the issue through one turn: mechanical phase moves, and a merge when that is the decision. The session prints the decision and runs the named skill in the chat. The spy runs the skill through sandcastle.

The session checkout is `.worktrees/sdd-<key>`. The spy's checkout stays the one sandcastle creates under `.sandcastle/worktrees/`. The two are not run together. A race between them is left for later.

Running `remote-solver issue` from the chat was rejected: that hides the skill in sandcastle. Sharing one checkout directory was rejected: sandcastle's path is fixed, and this session does not need the spy's directory.
