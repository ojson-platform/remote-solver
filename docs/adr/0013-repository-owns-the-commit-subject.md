---
status: accepted
---

# The repository owns the commit subject

The default subject is `#<issue>: <what changed>`. The repository's own rule wins: `CONTRIBUTING`, the agent style guide, or commitlint. Those files sit directly in the directory `sdd worktree` prints. A listed file that does not state a subject leaves the default. The subject follows that rule and says what this commit changed. `sdd commit` writes the body line `#<issue>`.

The pull request title is always `#<issue>: <what changed>`. That string is the `publish` argument, not the commit subject. There is no `commits:` section in `sandcastle.yaml`: two owners of the format would diverge from release-please.
