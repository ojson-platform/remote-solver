---
status: accepted
---

# The machine owns the review gate

On `proposing`, `specifying`, and `designing` the machine decides the review gate. Once the artifact is published with no open question or decision and the issue has no `sdd:auto-plan`, `sdd:auto-spec`, or `sdd:auto-design`, it sets `sdd:wait-human` and posts the ask through the same path as `wait`: ``Review the proposal. To accept it, replace the label `sdd:proposing` with `sdd:proposed` on this issue, or run `remote-solver accept <key>`.`` The tracker words the phase change (ADR-0019). The label keeps later polls waiting, so the ask is posted once. With the tag the machine advances. A skill ends with Publish and Waits only for a blocker. A tag added after the gate opened does not lift it: `sdd:wait-human` holds until a person moves the phase on the issue, runs `remote-solver accept`, or runs `unwait`.

Before, each skill read the auto tag and called `wait` for the review, and the policy decided the same gate again. When the two disagreed, an agent set `sdd:wait-human` although the tag was there, and `autoGateReady` existed only to ignore that label. Two deciders for one gate drifted.

Keeping the gate in the skills was rejected: a prompt cannot be tested like the policy, and the machine would still have to decide the gate to advance on the tag.
