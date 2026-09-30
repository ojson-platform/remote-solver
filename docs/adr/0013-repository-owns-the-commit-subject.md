---
status: accepted
---

# The repository owns the commit subject

The default subject is `#<issue>: <what changed>`. The repository's own rule wins: `CONTRIBUTING`, the agent style guide, or commitlint. The subject follows that rule and says what this commit changed. The issue number then stays in the body as a line `#<issue>`.

The pull request title is always `#<issue>: <what changed>`. That string is the `publish` argument, not the commit subject. There is no `commits:` section in `sandcastle.yaml`: two owners of the format would diverge from release-please.
