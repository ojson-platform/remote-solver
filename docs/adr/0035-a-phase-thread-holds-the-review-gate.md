---
status: accepted
---

# A phase thread holds the review gate

On proposing, specifying, and designing, an unclosed review thread of that phase keeps «Принять» in the gate's place and inactive, and keeps the machine from setting `sdd:wait-human` or posting the ask. A reply with no marker counts as that phase. A later-phase marker does not. A note does not. An open question still leaves the place empty. The open-item pin still classifies the thread for rollback. It does not turn an unmarked reply into a later phase for this hold. A person can still run `sdd accept`.

Hiding the control was rejected: the issue keeps it in the gate's place. Keying it off `sdd:wait-human` was rejected: the label is off while the thread holds, and the place would lose «Принять». Letting a note or a later-phase marker hold the gate was rejected: those threads are not this phase.
