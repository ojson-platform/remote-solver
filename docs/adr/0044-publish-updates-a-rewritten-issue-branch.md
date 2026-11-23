---
status: accepted
---

# Publish updates an issue branch a rebase has rewritten

`sdd rebase` does nothing when the printed base is already in the issue branch. The base is fetched in the issue checkout and read as `arcadia/<base>`: that mount's local branch of the same name can lag the remote, and rebasing onto the lagging name replays the commits without taking the new tip. Ancestry is the merge base equalling that tip. `arc merge-base` has no `--is-ancestor`, and a failed flag made every rebase rewrite the branch and every push a force push. When that base has moved, the rebase rewrites commits that are already on the remote. `sdd publish` then force-pushes that issue branch, and only that branch: the checkout is checked first, and a remote tip that is already an ancestor is a plain push. A plain push of the rewritten branch stops the cycle. The chat was opening the program and rebasing back onto the old tip, which dropped the base the rebase had just taken. `thread fix` reads HEAD in the issue checkout. The checkout the command was launched from is another branch, and its HEAD is not the commit the fix names.

Leaving the failed push for the chat to repair was rejected. The repair undoes the rebase.
