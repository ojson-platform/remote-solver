---
status: accepted
---

# The snapshot holds accept while a thread of this phase is open

`layerAct` returns `held` on the row that would have returned `accept`, when the review the page holds has a thread of this phase. A thread with no marker, or this phase's marker, counts. Any other marker does not, and that thread still opens the gate. An open question still leaves that place empty; the thread does not fill it. The shell has no review, so `shellAct` stays the gate, and the client does not match markers. The machine adds no second withhold: the reading before the phase already skips the ask. Leaving the row on `accept` was rejected: it would offer a gate the machine will not ask. Counting markers in the client, and a second stop beside that reading, were rejected.
