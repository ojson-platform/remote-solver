# change

## Purpose

The change for an issue lives under a directory the issue key can name, on the issue branch.

## Requirements

### Requirement: The change directory is issue-<key>

The change SHALL be `openspec/changes/issue-<key>/`. The archive SHALL be `openspec/changes/archive/issue-<key>/`. A directory named only the key SHALL NOT be the change. The issue branch SHALL be `sdd/<key>`.

#### Scenario: A numeric directory is not the change

- **WHEN** a proposal sits at `openspec/changes/<key>/` and not at `openspec/changes/issue-<key>/`
- **THEN** the machine reads no proposal for that issue

#### Scenario: The change is read from the issue branch

- **WHEN** the proposal is committed on `sdd/<key>` and the checkout is another branch
- **THEN** the machine still reads that proposal

#### Scenario: A file only in the checkout is not the change

- **WHEN** a proposal sits in the checkout and `sdd/<key>` has no such file
- **THEN** the machine reads no proposal

#### Scenario: The issue branch wins over the checkout

- **WHEN** `sdd/<key>` has a proposal and the checkout has a different proposal at the same path
- **THEN** the machine reads the proposal from the issue branch

### Requirement: The active change wins over the archive

When both the active directory and the archive contain the change, the machine SHALL read the active directory. When only the archive contains it, the machine SHALL read the archive.

#### Scenario: Both copies present, the active text is read

- **WHEN** the active change and the archive both contain a proposal
- **THEN** the machine reads the active proposal

#### Scenario: Only the archive is present, the archive text is read

- **WHEN** the active directory has no change documents and the archive has a proposal
- **THEN** the machine reads the archived proposal and reports no active proposal

### Requirement: The archive commit leaves the documents on its parent

When the tip commit of the issue branch contains a line `Sdd-Archive: issue-<key>`, the plaque and the spine SHALL read the change documents and the baselines from the parent of that commit.

`readChange` SHALL read the tip, report the change archived, and report no active proposal.

A path shown for those documents SHALL be the archive path.

The fingerprint of that reading SHALL differ from a reading of the same documents at their active paths.

#### Scenario: A marked tip is read from its parent

A tip whose message does not contain that line SHALL be read as itself, including when an ancestor contains the line.

When that parent cannot be resolved, a lenient read SHALL use the tip and a strict read SHALL fail.

- **WHEN** the tip commit contains `Sdd-Archive: issue-<key>` and the parent still has the proposal
- **THEN** the spine shows that proposal, the change reports archived and no active proposal, the proposal path is the archive path, and its fingerprint differs from a reading of the parent as itself

#### Scenario: A trailer below the tip does not rewind

- **WHEN** an ancestor contains `Sdd-Archive: issue-<key>` and the tip does not
- **THEN** the spine shows the proposal on the tip

#### Scenario: A marked tip with no parent is read as itself

- **WHEN** the tip commit contains `Sdd-Archive: issue-<key>` and that commit has no parent
- **THEN** the lenient read shows the proposal on that tip

#### Scenario: A strict read of a marked tip with no parent fails

- **WHEN** the tip commit contains `Sdd-Archive: issue-<key>` and that commit has no parent
- **THEN** the strict read fails

### Requirement: A failed file read is not an empty change

A failed read of the issue branch SHALL NOT be treated as a change with no proposal and no tasks. The machine SHALL wait and SHALL NOT move the phase because a file is missing.

#### Scenario: A failed read does not move implementing back to tasking

- **WHEN** the phase is `implementing`, the issue branch has `tasks.md`, and the file read fails
- **THEN** the machine does not move to `tasking` and does not start `create-proposal`

### Requirement: A failed tip read is not a missing archive line

A thrown read of the tip message SHALL NOT be stored as an empty message. An empty message is a tip that was read and has no `Sdd-Archive` line.

#### Scenario: A thrown tip read does not load an empty tip

- **WHEN** reading the tip message throws
- **THEN** the cycle is not loaded as a tip without an archive line

### Requirement: A kept baseline scenario with no spec-coverage trace is untraced

The machine SHALL list a baseline scenario the delta kept when the design trace line names `@ojson/spec-coverage` and no recorded call matches that triple. A scenario the delta added, modified, or removed SHALL NOT be in that list. The same scenario title on another requirement SHALL stay. A rename SHALL keep the new requirement name. `scenario.skip` SHALL NOT count as a record. When the trace line is absent or names another format, the list SHALL be empty.

#### Scenario: A removed requirement is not untraced

- **WHEN** the delta removes one requirement and adds another, and no test records the two that remain
- **THEN** the list is those two scenarios and not the removed one

#### Scenario: The same title on another requirement stays

- **WHEN** two requirements share a scenario title and the delta modifies only one
- **THEN** the unmodified requirement stays in the list

#### Scenario: A rename keeps the new requirement name

- **WHEN** the delta renames a requirement and does not replace its scenario
- **THEN** the list names the new requirement

#### Scenario: A skipped call does not record the scenario

- **WHEN** the only call for that scenario is `scenario.skip`
- **THEN** the scenario stays untraced, and a normal call removes it

#### Scenario: Another trace format leaves the list empty

- **WHEN** the trace line is absent or names a format other than `@ojson/spec-coverage`
- **THEN** the list is empty

#### Scenario: An added scenario is not untraced

- **WHEN** the delta adds a scenario
- **THEN** that scenario is not in the list

#### Scenario: The change read lists those triples

- **WHEN** the change names a modified capability, the design traces spec-coverage, and the stable spec keeps two scenarios
- **THEN** the change read lists those two triples
