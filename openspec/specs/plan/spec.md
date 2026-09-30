# plan

## Purpose

`plan` applies mechanical phase moves, then prints one remaining decision. It does not merge.

## Requirements

### Requirement: Plan applies mechanical moves and prints one decision

`plan` SHALL apply every mechanical phase move before it prints. The printed decision SHALL be the first remaining skill action, otherwise the first merge, otherwise one wait that names every remaining issue. `plan` SHALL NOT merge a pull request.

#### Scenario: A phase move is applied and the first skill is printed

- **WHEN** one issue is `proposed` with no proposal, another is `implementing` with an open task, and a third is `accepting` with green checks, an archived change, and `auto-merge`
- **THEN** the first issue moves to `proposing` and the printed decision is that issue's skill
- **AND** the implementing issue stays `implementing`
- **AND** the accepting issue stays `accepting` and its pull request is not merged

#### Scenario: A merge is printed and not performed

- **WHEN** the only remaining decision is a merge
- **THEN** `plan` prints that merge and does not merge the pull request

#### Scenario: Several waits are printed as one

- **WHEN** two issues are `verifying` and neither has an open pull request
- **THEN** `plan` prints one wait that names both issues
