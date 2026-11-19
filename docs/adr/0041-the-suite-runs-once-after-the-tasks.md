---
status: accepted
---

# The suite runs once after the tasks

`implementing` covers an untraced baseline before the next task, then one task at a time, then `repair-suite`. A slice runs the one-file command from the card. `repair-suite` runs the layer command, the fast suite, and the type check. A clean `repair-suite` with no commit moves the issue to `verifying` and does not set `sdd:refused`.

A stamp file was rejected: the refusal signature has no revision, so a green run with no commit would stay idle. Running the layer command inside every slice was the previous state: the suite repeated for each task, and a restored baseline had no stage that traced it.
