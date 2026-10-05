---
status: accepted
---

# The chat machine travels with the skill; the spy is the package

The chat runs `skills/sdd-flow/scripts/sdd.mjs`, the file that ships inside the `sdd-flow` skill. The spy, one issue, and review are the `remote-solver` bin of `@ojson/remote-solver`. The public package does not import Tracker, Arcanum, or arc. Those adapters are one file beside the script under `ai/artifacts`. The machine finds that file on disk. The service config is the `sdd` key of `openspec/config.yaml`, and that file does not name the adapters.

Putting the adapters in the published package was rejected: the package is public, and those clients are not. A `host` key, or an adapters path in `sandcastle.yaml`, was rejected: the file is placed once, when the skill is laid into `ai/artifacts`. Running the agent through sandcastle's `run` was rejected: that layer calls git on the host and cannot check out an arc branch. Forking sandcastle to hide git was rejected. The package prepares the checkout through the repository port and runs the agent through `AgentProvider`, so a later provider can keep sessions and token usage.
