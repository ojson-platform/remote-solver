---
status: accepted
---

# Every skill run ends in a signal

A run ends in exactly one of Publish, Wait, or Hand-off (a thread or conversation comment carrying a layer marker). "Stop" in a skill means emit the signal that fits, then end. The machine reads only those three. A run with no commit, no wait, and no marker leaves the decision unchanged. The spy records that step idle and does not start it again until the decision changes, so the cycle sits still.

Before this, `sdd-specify`, `sdd-implement`, and `sdd-tasks` allowed "stop, keep the files" when the work belonged to another layer. On `spec-coverage#1` that produced four runs of `improve-specs` on one thread, two of them silent. Hand-off reuses the marker grammar `sdd-verify` and `sdd-pr-comments` already spoke, so the phase moves on the next poll instead of the run being repeated.

A skill that decides the next phase itself was rejected: routing stays in the machine (`policy.ts`, `route.ts`), and the skill only says which layer the work belongs to. A new "blocked" label was rejected: a marker on the line that shows the problem tells the next skill where to look, a label does not.
