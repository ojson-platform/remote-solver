---
status: accepted
---

# Specify may drop a requirement without editing the proposal

On `sdd:specifying`, a delta may remove a requirement or a scenario of a capability the proposal already names. A removed requirement is a name under `## REMOVED Requirements`. A removed scenario is absent from the requirement that remains. `proposal.md` stays unchanged.

The step used to stop until the proposal itself dropped the scenario. A `sdd:layer=spec` thread that asks for `REMOVED` then had nowhere to go: this step does not edit the proposal, and the capability list, the problem, and the scope can still be right. Handing back to proposing is only for when those are wrong, not when the requirement set is.
