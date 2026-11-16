# Decide

One reading of a cycle produces one decision: start a skill, move the phase, wait, merge, archive, or stop.

Facts that hold for every phase are judged before the phase itself. The phase does not re-decide them. `policy.ts` is the surface other modules import. This module does not write labels, comments, or the checkout.

[POLL.md](./POLL.md) is the order of one poll, what a run leaves, and the seam to the next poll. Update it in the same session as the decision or the scenario it names.

Behavior is in `openspec/specs/`.
