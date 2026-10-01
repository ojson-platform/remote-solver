---
status: accepted
---

# `sdd-init` is a chat outside the cycle

`sdd-init` connects a service to SDD from an ordinary chat at the service root. It is not in the action table, `sdd-flow` does not call it, and it does not run on an issue branch. There is no command and no console agent launch. The person commits.

A test platform is a condition of that connection. Specs are true only when tests prove them. When the platform cannot be set up, the skill stops, writes no block, and says that SDD will not run here. The block in `AGENTS.md` is written only after OpenSpec, the platform, trace, and CI are in place, between `<!-- sdd:init:begin -->` and `<!-- sdd:init:end -->`.

Putting init on the route was rejected: a commit to `AGENTS.md` would land on the issue branch, or Publish would delete it as a file the task did not name. A console agent was rejected: the person is in the chat and answers along the way.
