---
status: accepted
---

# A person moves the gate on the issue

A person closes a review gate where they work: on the issue, by moving `proposing`, `specifying`, or `designing` to `proposed`, `specified`, or `designed`. The gate phase wins over the phase it closes, so a person who adds the gate label and leaves the old one is not stuck. On the next poll the machine runs the same check as `sdd accept`: the artifact is published and nothing is open under `## Open questions` or `## Open decisions`. It passes: the machine advances and comments `sdd:accept <from> → <to>`; the tracker's history shows who moved it. It fails: the machine moves the issue back to the closed phase and comments which file or heading is left. The robot still never sets a gate phase. The ask names this path first; the tracker words it (`Tracker.phaseHint`), because on another tracker the phase may be a status and not a label. `sdd accept` stays as an alternative.

Before, ADR-0001 promised that a person moves a gate by changing labels, but `phaseOf` kept the earliest phase label, and the checks lived only in the CLI: a clean label swap advanced with no check and no record. The ask named only `sdd accept`.

Keeping `sdd accept` as the only path was rejected: the person works in the issue, and the issue may live in Tracker, where no one runs the CLI.
