---
status: accepted
---

# The skill declares its mode

Each skill says `mode: mechanical` or `mode: judgment` in its frontmatter. The runtime maps that onto a model: mechanical runs on `composer-2.5-fast`, judgment on `grok-4.7-high-fast`. Mechanical skills walk an instruction that is already written (`sdd-tasks`, `sdd-implement`, `sdd-fix`, `sdd-pr-comments`). The others have to judge.

A skill-name list in the runner was rejected: adding a skill would mean editing the runner. One model for the whole cycle was rejected: the planning cost is wasted if implementation wanders. A "high" Composer tier was rejected: the agent CLI has no such id.
