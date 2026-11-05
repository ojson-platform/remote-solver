# spec-archive

## Purpose

The accept step folds a delta into the baseline by editing it, and records that fold in one commit.

## Requirements

### Requirement: The accept step folds a delta by hand

The accept step SHALL fold a delta into its baseline by editing that baseline. The fold SHALL apply renames, then removals, then modifications, then additions. A rename SHALL take effect before a modification of that requirement. A removal SHALL drop the named requirement and SHALL NOT copy prose from the removal. A modification SHALL replace that requirement with the delta's block. An addition SHALL append. The scenario meaning SHALL be kept. The step SHALL NOT apply the delta with an archive command.

#### Scenario: The baseline shows the fold in section order

- **WHEN** the accept step archives a delta that renames one requirement, removes a second, modifies the renamed requirement, and adds a third
- **THEN** the baseline has the renamed requirement as the delta states it, omits the old name and the removed requirement, does not contain prose from the removal, and shows the added requirement after the requirements that stayed

### Requirement: One commit holds the fold

The accept step SHALL record, in one commit, the folded baseline and the move of the change into the archive named for the issue. That commit's body SHALL contain a line `Sdd-Archive: issue-<key>`. That commit SHALL be the tip when the step finishes.

#### Scenario: The archive commit is the tip

- **WHEN** the accept step archives a change
- **THEN** one commit holds the folded baseline and the move into the archive named for the issue, its body contains a line `Sdd-Archive: issue-<key>`, and that commit is the tip
