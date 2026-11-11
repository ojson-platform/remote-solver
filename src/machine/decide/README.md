# Decide

One reading of a cycle produces one decision: start a skill, move the phase, wait, merge, archive, or stop.

Facts that hold for every phase are judged before the phase itself. The phase does not re-decide them. `policy.ts` is the surface other modules import. This module does not write labels, comments, or the checkout.

Behavior is in `openspec/specs/`.
