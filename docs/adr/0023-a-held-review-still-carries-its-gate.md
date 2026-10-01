---
status: accepted
---

# A held review still carries its gate

`gate` on a wait names the open review. It does not mean the ask is posted again. The first reading on a ready `proposing`, `specifying`, or `designing` sets `sdd:wait-human` and posts the ask once (ADR-0017). A later reading carries the same `gate` while nothing in that artifact is open, including when an auto tag was added after the gate opened. The ask is posted only when the label is absent. An open item, or `sdd:wait-human` on any other phase, leaves `gate` off. The reason is `sdd:wait-human is set on <phase>. Do the ask on the issue.` The chat runs `accept` only when the printed decision has `gate`.

Dropping `gate` on the later reading was rejected: the chat could not tell the review from a skill's blocker, and the reason offered both `accept` and `unwait`. Treating every `sdd:wait-human` on a writing phase as the review was rejected: `sdd-plan` and `sdd-design` wait while a question or a decision is still open.
