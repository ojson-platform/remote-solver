---
status: accepted
---

# A personal branch is not the pull request target

The service base is the branch the issue is cut from and rebased onto. That branch can be a personal branch, because the service configuration is not on trunk yet. Arcanum opens a pull request only into trunk or a release. Publish therefore opens the pull request into trunk when the base is a personal branch. A base of trunk or a release stays the target.

Opening the pull request into the personal branch was rejected. The create call returns 400, and the target must be trunk or a release.
