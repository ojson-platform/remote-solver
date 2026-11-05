# written-focus-page

## Purpose

The focus block is the latest written focus comment on the open ticket. The marker is the badge. The prose sits under it.

## Requirements

### Requirement: The focus block shows the latest written focus

The open sidebar SHALL show one focus block: the last focus comment in the issue's comment list that is not a manager comment. The badge SHALL be that comment's marker. The prose under the badge SHALL be the comment after the marker line. When the marker is `sdd:focus`, a line whose first word is Change, Plan, Specify, Design, Tasks, or Code SHALL stay out of that prose, and the other lines SHALL remain. When the marker is `sdd:focus:plan`, `sdd:focus:spec`, `sdd:focus:design`, `sdd:focus:tasks`, or `sdd:focus:code`, the prose SHALL be the comment after the marker as written. A comment whose first line is `sdd:focus:accept` SHALL NOT be this block. When the issue has no focus comment, the block SHALL be absent. A later focus comment SHALL be the block. Opening a ticket SHALL show that ticket's own latest focus comment.

#### Scenario: The block is the latest phase comment

- **WHEN** an earlier comment begins with `sdd:focus:plan` and a later comment begins with `sdd:focus:spec`, and neither comment is a manager comment
- **THEN** the focus block's badge is `sdd:focus:spec` and the prose is that later comment after the marker

#### Scenario: A manager comment is not the block

- **WHEN** the last comment is a manager comment that begins with `sdd:focus`, and an earlier comment begins with `sdd:focus:code`
- **THEN** the focus block's badge is `sdd:focus:code` and the prose is that earlier comment after the marker

#### Scenario: A whole-pull-request comment leaves phase lines out of the prose

- **WHEN** the latest focus comment begins with `sdd:focus`, the next line begins with Plan, and the line after that names no phase
- **THEN** the badge is `sdd:focus` and the prose is the line that names no phase

#### Scenario: A phase comment keeps the prose after the marker

- **WHEN** the latest focus comment begins with `sdd:focus:plan` and the following lines are two sentences
- **THEN** the badge is `sdd:focus:plan` and the prose is both sentences

#### Scenario: Accept is not a focus page

- **WHEN** the last comment begins with `sdd:focus:accept` and an earlier comment begins with `sdd:focus:plan`
- **THEN** the focus block's badge is `sdd:focus:plan` and the prose is that earlier comment after the marker

#### Scenario: No focus comment leaves no block

- **WHEN** the open ticket has no focus comment
- **THEN** the sidebar has no focus block

#### Scenario: Another ticket shows its own latest focus

- **WHEN** one ticket's latest focus comment begins with `sdd:focus:plan` and another ticket's begins with `sdd:focus:code`, and the sidebar opens the second ticket
- **THEN** the focus block's badge is `sdd:focus:code`

### Requirement: The focus block sits in the scrolling body

The title and the chips SHALL sit in the sidebar header. The focus block SHALL sit in the scrolling body, after the reason and the ask when those blocks are present, and before the spine. The header SHALL stay in place while that body, including the focus block, scrolls.

#### Scenario: The block follows the reason and the ask

- **WHEN** the open ticket has a reason, an ask, and a focus comment
- **THEN** the focus block is below the reason and the ask, and below the header that holds the title and the chips

#### Scenario: The header stays while the block scrolls

- **WHEN** the sidebar body scrolls and the focus block is in that body
- **THEN** the title and the chips stay in the header, and the focus block scrolls with the body
