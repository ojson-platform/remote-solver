---
status: accepted
---

# A classified thread moves before the review gate

Once review threads carry layer markers, the machine follows the earliest marker, or the action of the current layer, before it repeats the review gate. `sdd:wait-human` still holds a gate that has no classified thread. An unlabeled thread is still classified first. `verifying` still waits for checks before it follows a marker. A later `/sdd-flow` while the chat is waiting runs that poll again. It does not accept the gate.

Before, the gate label was read before the markers. A poll that still saw `sdd:wait-human` repeated the review and never rolled back, even after the threads had been classified.

Leaving the order was rejected: the label and the markers disagreed, and the chat kept waiting for a review the person had already written.
