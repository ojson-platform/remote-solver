---
status: accepted
---

# Verification commands live in the design boundary

`## Verification boundary` names, for each capability, the narrow command that runs one test file and the fast suite, and once for the change the type check. `sdd-design` finds those commands, or copies them from the `sdd-init` block when that block exists. `sdd-tasks` copies them into the task card and substitutes the test path. `sdd-implement` and `sdd-fix` run the card. They do not search.

Searching on the weak phases was rejected: the model there follows an instruction already written, and a missing command becomes a guess. Leaving the commands only in `AGENTS.md` was rejected: the card is the implementer's whole instruction, and a chat that never opens `AGENTS.md` would search again.
