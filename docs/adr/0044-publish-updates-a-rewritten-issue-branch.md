---
status: accepted
---

# Publish updates an issue branch a rebase has rewritten

`sdd rebase` does nothing when the printed base is already in the issue branch. When that base has moved, the rebase rewrites commits that are already on the remote. `sdd publish` then force-pushes that issue branch, and only that branch: the checkout is checked first, and a remote tip that is already an ancestor is a plain push. A plain push of the rewritten branch stops the cycle. The chat was opening the program and rebasing back onto the old tip, which dropped the base the rebase had just taken.

Leaving the failed push for the chat to repair was rejected. The repair undoes the rebase.
