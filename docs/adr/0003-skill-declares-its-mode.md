---
status: accepted
---

# The step declares its mode

Each step says `mode: mechanical` or `mode: judgment` on its first line. The runtime maps that onto a model: mechanical runs on `composer-2.5-fast`, judgment on `grok-4.7-high-fast`. Mechanical steps walk an instruction that is already written (`tasks`, `implement`, `fix`, `pr-comments`). The others have to judge.

A name list in the runner was rejected: adding a step would mean editing the runner. One model for the whole cycle was rejected: the planning cost is wasted if implementation wanders. A "high" Composer tier was rejected: the agent CLI has no such id.
