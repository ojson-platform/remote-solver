---
status: accepted
---

# A finished cycle closes in place

A cycle whose change is archived, whose pull request is merged, and which has no open pull request is finished on every phase before `accepting`. The machine closes the issue and does not move the phase, restore the change, or start a step. The board is filled from the open list, so the card leaves and a reload does not bring it back. `sdd:cancelled` still leaves without this close. `accepting` and `accepted` still close only through the accepted label, after the pull request is merged.

Advancing the cycle to `accepted` so the existing close runs was rejected: a gate would move, and `implementing` would pass through `verifying`. Hiding the card while the issue stays open was rejected: the open list would still have it, and the next reading would restore the change.
