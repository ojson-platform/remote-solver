# spec-archive

## Purpose

The accept step folds a delta into the baseline by editing it, and records that fold in one commit.

## Requirements

### Requirement: The accept step folds a delta with the archive command

The accept step SHALL fold a delta into its baseline with `openspec archive issue-<key> --yes` instead of editing that baseline by hand. The fold order SHALL be the one `archive-fold` requires. A rename SHALL take effect before a modification of that requirement. A removal SHALL drop the named requirement and SHALL NOT copy prose from the removal. A modification SHALL replace that requirement with the delta's block. An addition SHALL append. The scenario meaning SHALL be kept.

#### Scenario: The accept step folds a delta with the archive command instead of editing the baseline by hand

- **WHEN** the accept step already folds a delta with `openspec archive issue-<key> --yes`, and the baseline is already visible, together with editing that baseline by hand as the limit that can replace that command
- **THEN** the accept step folds a delta with `openspec archive issue-<key> --yes` instead of editing the baseline by hand

#### Scenario: The command applies RENAMED, then REMOVED, then MODIFIED, then ADDED

- **WHEN** the command already applies RENAMED, then REMOVED, then MODIFIED, then ADDED, together with another section order as the limit that can replace that order
- **THEN** the command applies RENAMED, then REMOVED, then MODIFIED, then ADDED

#### Scenario: The baseline shows the fold in section order

- **WHEN** the accept step archives a delta that renames one requirement, removes a second, modifies the renamed requirement, and adds a third
- **THEN** the baseline has the renamed requirement as the delta states it, omits the old name and the removed requirement, does not contain prose from the removal, and shows the added requirement after the requirements that stayed

### Requirement: One commit holds the fold

The accept step SHALL record, in one commit, the folded baseline and the move of the change into `openspec/changes/archive/issue-<key>/`.

The command SHALL archive to `openspec/changes/archive/<date>-issue-<key>/`.

Before the commit, the step SHALL move that directory to `openspec/changes/archive/issue-<key>/`.

That commit's body SHALL contain a line `Sdd-Archive: issue-<key>`.

That commit SHALL stay the tip until unarchive.

#### Scenario: The step still makes one commit

The machine, the window, review, and unarchive SHALL keep reading `archive/issue-<key>`.

Unarchive SHALL stay a revert of the archive commit.

The step SHALL NOT merge the pull request.

`openspec validate --all --strict --no-interactive` SHALL still run before the commit.

- **WHEN** the step already makes one commit, together with a second commit as the limit that can replace that one commit
- **THEN** the step makes one commit

#### Scenario: Its body contains a line Sdd-Archive: issue-<key>

- **WHEN** the commit body already contains a line `Sdd-Archive: issue-<key>`, together with a body that omits that line as the limit that can replace it
- **THEN** its body contains a line `Sdd-Archive: issue-<key>`

#### Scenario: That commit stays the tip until unarchive

- **WHEN** that commit is already the tip, together with a later commit before unarchive as the limit that can replace that tip
- **THEN** that commit stays the tip until unarchive

#### Scenario: The command archives to openspec/changes/archive/<date>-issue-<key>/

- **WHEN** the command already archives to `openspec/changes/archive/<date>-issue-<key>/`, together with `openspec/changes/archive/issue-<key>/` as the limit that can replace that dated directory
- **THEN** the command archives to `openspec/changes/archive/<date>-issue-<key>/`

#### Scenario: Before the commit, the step moves that directory to openspec/changes/archive/issue-<key>/

- **WHEN** before the commit the step has already moved `openspec/changes/archive/<date>-issue-<key>/` to `openspec/changes/archive/issue-<key>/`, together with leaving the dated directory as the limit that can replace that move
- **THEN** before the commit, the step moves that directory to `openspec/changes/archive/issue-<key>/`

#### Scenario: The machine, the window, review, and unarchive keep reading archive/issue-<key>

- **WHEN** the machine, the window, review, and unarchive already read `archive/issue-<key>`, together with `openspec/changes/archive/<date>-issue-<key>/` as the limit that can replace that path
- **THEN** the machine, the window, review, and unarchive keep reading `archive/issue-<key>`

#### Scenario: Unarchive stays a revert of the archive commit

- **WHEN** unarchive is already a revert of the archive commit, together with a change to unarchive as the limit that can replace that revert
- **THEN** unarchive stays a revert of the archive commit

#### Scenario: The step does not merge the pull request

- **WHEN** the step has already left the pull request unmerged, together with merging the pull request as the limit that can replace that
- **THEN** the step does not merge the pull request

#### Scenario: openspec validate --all --strict --no-interactive still runs before the commit

- **WHEN** `openspec validate --all --strict --no-interactive` has already run and the commit is not yet made, together with committing without that command as the limit that can replace that run
- **THEN** `openspec validate --all --strict --no-interactive` still runs before the commit

#### Scenario: The archive commit is the tip

- **WHEN** the accept step archives a change
- **THEN** one commit holds the folded baseline and the move into `openspec/changes/archive/issue-<key>/`, its body contains a line `Sdd-Archive: issue-<key>`, and that commit stays the tip until unarchive

### Requirement: A new spec's Purpose is the proposal line

A new spec SHALL NOT keep the Purpose the command writes (`TBD - created by archiving change ...`). In the same commit the step SHALL set Purpose to the one line under that capability in the proposal. An existing spec SHALL keep its Purpose. The command SHALL NOT change that Purpose.

#### Scenario: A new spec does not keep the Purpose the command writes

- **WHEN** a new spec is already visible and does not keep the Purpose `TBD - created by archiving change ...`, together with that Purpose as the limit that can replace the proposal line
- **THEN** a new spec does not keep the Purpose the command writes (`TBD - created by archiving change ...`)

#### Scenario: In the same commit the step sets Purpose to the one line under that capability in the proposal

- **WHEN** in the same commit the step has already set Purpose to the one line under that capability in the proposal, together with `TBD - created by archiving change ...` as the limit that can replace that line
- **THEN** in the same commit the step sets Purpose to the one line under that capability in the proposal

#### Scenario: An existing spec keeps its Purpose

- **WHEN** an existing spec already keeps the Purpose `The accept step folds a delta into the baseline by editing it, and records that fold in one commit.`, together with the one line under that capability in the proposal (`the accept step folds a delta into the baseline by editing it, in one commit`) as the limit that can replace that Purpose
- **THEN** an existing spec keeps the Purpose `The accept step folds a delta into the baseline by editing it, and records that fold in one commit.`

#### Scenario: The command does not change it

- **WHEN** the command has already left the Purpose `The accept step folds a delta into the baseline by editing it, and records that fold in one commit.` unchanged, together with a Purpose that says the step folds with `openspec archive issue-<key> --yes` instead of editing the baseline by hand as the limit that can replace that Purpose
- **THEN** the command does not change the Purpose `The accept step folds a delta into the baseline by editing it, and records that fold in one commit.`

### Requirement: A refusal does not publish

When the command refuses, the step SHALL NOT publish. A refusal because a baseline would have no requirement SHALL be a Wait that names that baseline, and the machine SHALL NOT post `sdd:refused` for that refusal. Any other refusal SHALL be a Wait that names what the command said. The machine SHALL post `sdd:refused` with the phase, the action `archive`, and the reason `archive the change`, and SHALL put what the command said on the following lines. The next poll SHALL NOT run the archive.

#### Scenario: When the command refuses, the step does not publish

- **WHEN** the command has already refused and the step has not published, together with publishing as the limit that can replace that refusal
- **THEN** when the command refuses, the step does not publish

#### Scenario: A refusal because a baseline would have no requirement is a Wait that names that baseline

- **WHEN** the command has already refused because a baseline would have no requirement, and the Wait already names that baseline, together with a Wait that does not name that baseline as the limit that can replace that Wait
- **THEN** a refusal because a baseline would have no requirement is a Wait that names that baseline

#### Scenario: The machine waits and names the baseline instead of refusing

- **WHEN** the fold reports that the rebuilt spec would have no requirement
- **THEN** the machine waits, names `openspec/specs/<capability>/spec.md`, and does not post `sdd:refused`

#### Scenario: A refused validate names the specs and the rule

- **WHEN** validate refuses because `spec/board` has a requirement longer than 500 characters
- **THEN** the machine waits, names `spec/board` and that rule, and does not publish

#### Scenario: The next poll does not archive again

- **WHEN** that refusal is the latest machine comment
- **THEN** the next poll does not run the archive
