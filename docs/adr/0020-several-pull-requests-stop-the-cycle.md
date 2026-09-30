---
status: accepted
---

# Several open pull requests stop the cycle before any step

A cycle has one pull request: threads, checks, and merge each name one. Two open pull requests whose titles belong to the issue are two branches, and the machine does not choose between them. It waits, and it does not enter a phase, close a gate, archive, or push, until a person leaves one.

Using the pull request whose head is `sdd/<key>` and ignoring the rest was rejected: the other pull request is still titled as this issue, so a person can be reviewing a branch the machine will not merge.
