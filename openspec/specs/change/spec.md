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
