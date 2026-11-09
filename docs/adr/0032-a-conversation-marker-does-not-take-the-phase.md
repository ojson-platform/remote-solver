---
status: accepted
---

# A conversation marker does not take the phase

A layer marker on the pull-request conversation records a request. It does not roll the phase back and does not start that layer's action. An open thread still does both.

An instruction to the current phase is that thread, including when it names no line and no particular action. The cause is the person's words. The same line is posted on the conversation so the comment is answered; that copy does not start the work. Classify runs before any thread, so an unanswered conversation never reaches the thread. A note is a remark that asks the cycle to do nothing, or that only names the work as a later phase's. `verifying` and `accepting` have no layer. An instruction there is a Wait that repeats the cause, not a `code` thread: a `code` thread on `accepting` would roll the cycle back to `implementing`.

A free comment about a later action was classified as `sdd:layer=code` on the conversation. The marker waited until `implementing`, then replaced the open tasks with `fix-implementation`. That step found no thread, made no commit, and left the same decision idle. The same marker on `accepting` rolled the cycle back before archive.

Classifying "no diff line" as a note was the same failure one step later. A comment on `proposing` that asked to rebase and rewrite the plan became `sdd:note`. The conversation was answered, no thread opened, and the proposal gate set `sdd:wait-human` again.

Keeping the conversation in the earliest-layer rule was rejected: one slot cannot mean both "go fix this layer" and "when you get there, also do this". Listing actions in the classifier was rejected for the same reason: the next unnamed action would become a note again. The thread is the instruction. The conversation copy only answers the comment. Rebase onto the pull request base stays a shared git procedure in `CONTEXT.md`, used when the instruction says so or the pull request conflicts. It is not a marker.
