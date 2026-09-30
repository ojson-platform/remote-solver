---
status: accepted
---

# Review starts on the label that completed the pair

The reviewer takes an issue only when both `sdd:accepting` and `sdd:auto-review` are set. The job starts on whichever of those two labels arrived second.

Starting only on `sdd:accepting` missed the case where `sdd:auto-review` is added while the phase is already accepting. The queue still waits for `sdd:accepting` and stays quiet next to `sdd:auto-merge`. The `labeled` event is delivered to the service repository, so the same condition lives in its workflow, not in the `review` command.
