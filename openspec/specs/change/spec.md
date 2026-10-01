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
