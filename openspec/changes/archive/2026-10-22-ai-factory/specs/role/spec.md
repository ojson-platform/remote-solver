# role

## Purpose

A role is an action from the manager's own collection: a name, one outcome kind, and that outcome's text. The shelf lists that collection. The window runs the outcome itself.

## ADDED Requirements

### Requirement: The shelf lists this manager's roles

The shelf SHALL be the list of this manager's roles, on the right of the window. Another manager SHALL have their own collection. The collection SHALL live with the home config and SHALL NOT belong to the cycle's service. The shelf SHALL show the outcome kind before the manager drags the role. The user block of settings SHALL edit the collection immediately: add, rename, choose the outcome, edit the text and the labels, and remove. There SHALL be no wizard.

#### Scenario: The shelf shows the outcome before the drag

- **WHEN** a role's outcome is `html`
- **THEN** the shelf shows `html` before the manager drags it

#### Scenario: Removing a role writes the home config

- **WHEN** the manager removes a role in the user block
- **THEN** the home config no longer lists that role

### Requirement: A role record is a name, one outcome, and its text

A role record SHALL have `name`, `outcome`, and `text`. The outcome SHALL be one of `ticket-fields`, `pull-comment`, `html`, and `cycle-file`. A `ticket-fields` role SHALL also have `labels`: which of `sdd:auto-plan`, `sdd:auto-spec`, and `sdd:auto-design` it sets.

#### Scenario: Ticket-fields stores the labels

- **WHEN** the manager saves a `ticket-fields` role that names `sdd:auto-plan`
- **THEN** the home record has `outcome` `ticket-fields` and `labels` containing `sdd:auto-plan`

### Requirement: The window runs one drag and does not keep the role

The manager SHALL drag a role onto one ticket or cycle, including from the pool. That SHALL be one run on that cycle. The role SHALL NOT stay on the cycle, and entering a phase SHALL NOT repeat it. `sdd step` and the spy SHALL NOT start a role. The window SHALL run the outcome itself, with no model and no step. An empty factory config, an agent that does not answer, and an empty model SHALL NOT disable the drag. The role SHALL NOT change the phase or the assignee, and SHALL NOT write `openspec/config.yaml`. The reviewer SHALL remain the `accepting` pass on `auto-review`.

#### Scenario: A drag does not move the phase

- **WHEN** the manager drags a role onto a cycle in `implementing`
- **THEN** the phase stays `implementing` and the assignee stays

#### Scenario: An empty model still runs the role

- **WHEN** the merged factory config has an empty model and the manager drags a role
- **THEN** the window runs that outcome

#### Scenario: The spy does not start a role

- **WHEN** the window's spy reads a cycle that once received a role
- **THEN** the spy does not run that role again

### Requirement: Ticket-fields sets the named labels and may replace sddHooks

A `ticket-fields` outcome SHALL set the named labels among `sdd:auto-plan`, `sdd:auto-spec`, and `sdd:auto-design`, and SHALL NOT set `sdd:auto-merge`. It SHALL replace `sddHooks` with the role text only when that text reads as a map of points. Otherwise it SHALL leave the field unchanged. A write that does not fit SHALL leave the previous value. There SHALL be no merge with a manager's edit on the queue: the last drag SHALL write its own text.

#### Scenario: Named labels are set

- **WHEN** the manager drags a `ticket-fields` role whose labels are `sdd:auto-spec`
- **THEN** the issue gains `sdd:auto-spec` and does not gain `sdd:auto-merge`

#### Scenario: A point map replaces sddHooks

- **WHEN** the role text reads as a map of points
- **THEN** `sddHooks` becomes that text

#### Scenario: Prose leaves sddHooks

- **WHEN** the role text does not read as a map of points
- **THEN** `sddHooks` stays as it was, and the named labels are still set

### Requirement: A pull comment needs exactly one open pull request

A `pull-comment` outcome SHALL write the role text on the single open pull request. When several pull requests are open, the outcome SHALL write nothing. When none are open, the outcome SHALL write nothing and SHALL NOT set the icon.

#### Scenario: One pull request receives the text

- **WHEN** the cycle has one open pull request and the manager drags a `pull-comment` role
- **THEN** that pull request gains a comment with the role text

#### Scenario: Zero pull requests set no icon

- **WHEN** the cycle has no open pull request and the manager drags a `pull-comment` role
- **THEN** no comment is written and the card gains no icon from that drag

### Requirement: HTML opens and is not written on the cycle

An `html` outcome SHALL open the role text in a popup and SHALL NOT write it on the cycle.

#### Scenario: HTML stays off the issue

- **WHEN** the manager drags an `html` role
- **THEN** a popup shows the text and the issue gains no comment from that drag

### Requirement: A cycle file opens from the card's checkout

A `cycle-file` outcome SHALL open a popup from the checkout of the card. It SHALL NOT start an agent, and it SHALL NOT open a tab. When the file is absent, the popup SHALL say the file is absent and SHALL save nothing.

#### Scenario: A missing cycle file saves nothing

- **WHEN** the manager drags a `cycle-file` role and the checkout has no such file
- **THEN** the popup says the file is absent and the checkout gains no file
