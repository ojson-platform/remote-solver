---
status: accepted
---

# Publish pushes the issue branch

A checkout cut from another branch tracks that branch. `arc push` with no destination updates the tracked branch. Publish names the issue remote, `users/<login>/sdd/<key>` when the host has a login, and sets it as the upstream. A later push updates that branch. The checkout is still checked first: the local branch is `sdd/<key>`.

Updating the tracked base was rejected. The proposal landed on the branch the checkout was cut from, and the pull request for that branch took the commit.
