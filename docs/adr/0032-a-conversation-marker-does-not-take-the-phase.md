---
status: accepted
---

# A conversation marker does not take the phase

A layer marker on the pull-request conversation records a request. It does not roll the phase back and does not start that layer's action. An open thread still does both. A remark that does not correct the current artifact is `sdd:note`.

A free comment about a later action was classified as `sdd:layer=code`. The marker waited until `implementing`, then replaced the open tasks with `fix-implementation`. That step found no thread, made no commit, and left the same decision idle. The same marker on `accepting` rolled the cycle back before archive.

Keeping the conversation in the earliest-layer rule was rejected: one slot cannot mean both "go fix this layer" and "when you get there, also do this". The thread is the correction. The conversation is the note.
