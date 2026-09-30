---
status: accepted
---

# `sdd:accepted` does not merge

A person finishes the robot's review by setting `sdd:accepted` and removing `sdd:accepting`. The accepted label wins even when the previous phase label is still on, so the spy does not keep waiting in that phase. If the change is still open, the spy archives it. The issue closes only after the pull request is merged. The machine merges only while the phase is `accepting` and `sdd:auto-merge` is set.

Closing on the label alone was rejected: the baseline is not in trunk until the pull request is merged.
