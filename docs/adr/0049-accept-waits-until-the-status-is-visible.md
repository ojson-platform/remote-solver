---
status: accepted
---

# Accept waits until the status is visible

Tracker’s execute answer lists the transitions of the new status and does not name that status. `sdd accept` prints the phase move only after an issue read shows the target status. The read is immediate. When it is still the old status, the same read runs after 1s, 2s, 4s, and 8s. Fifteen seconds without the target status fails the command, and the transition line is not printed. The next step reads that same issue, so a move that only the execute call has seen is not a move.

The open list is not that read: it can still show the previous status after the issue read has moved. A label this command wrote is the phase for the rest of the command.

Trusting the execute body was rejected: it names where the issue can go next, not where it is. Waiting without a deadline was rejected: a status that never moves would hold the command.
