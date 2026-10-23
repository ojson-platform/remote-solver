## RENAMED Requirements

- FROM: `### Requirement: The shelf lists this manager's roles`
- TO: `### Requirement: Verbs list this manager's roles`
- FROM: `### Requirement: The window runs one drag and does not keep the role`
- TO: `### Requirement: The window runs one press and does not keep the role`

## MODIFIED Requirements

### Requirement: Verbs list this manager's roles

The verbs SHALL be this manager's roles, in the sidebar of the open ticket. A closed row SHALL have no verbs. Another manager SHALL have their own collection. The collection SHALL live with the home config and SHALL NOT belong to the cycle's service. A verb SHALL show the role name and the outcome kind before the manager runs it. The user block of settings SHALL edit the collection immediately: add, rename, choose the outcome, edit the text and the labels, and remove. There SHALL be no wizard.

#### Scenario: The shelf shows the outcome before the drag

- **WHEN** a role's outcome is `html` and the row is open
- **THEN** the verb shows the role name and `html` before the manager runs it

#### Scenario: Removing a role writes the home config

- **WHEN** the manager removes a role in the user block
- **THEN** the home config no longer lists that role

#### Scenario: A closed row has no verbs

- **WHEN** the row is closed
- **THEN** the row shows no verb

### Requirement: A role record is a name, one outcome, and its text

A role record SHALL have `name`, `outcome`, and `text`. The outcome SHALL be one of `ticket-fields`, `pull-comment`, `html`, and `cycle-file`. A `ticket-fields` role SHALL also have `labels`: which of `sdd:auto-plan`, `sdd:auto-spec`, and `sdd:auto-design` it sets.

#### Scenario: Ticket-fields stores the labels

- **WHEN** the manager saves a `ticket-fields` role that names `sdd:auto-plan`
- **THEN** the home record has `outcome` `ticket-fields` and `labels` containing `sdd:auto-plan`

### Requirement: The window runs one press and does not keep the role

The manager SHALL run a verb on one ticket or cycle, including from the pool. That SHALL be one run on that cycle. The role SHALL NOT stay on the cycle, and entering a phase SHALL NOT repeat it. `sdd step` and the spy SHALL NOT start a role. The window SHALL run the outcome itself, with no model and no step. An empty factory config, an agent that does not answer, and an empty model SHALL NOT disable the verb. The role SHALL NOT change the phase or the assignee, and SHALL NOT write `openspec/config.yaml`. The reviewer SHALL remain the `accepting` pass on `auto-review`.

#### Scenario: A drag does not move the phase

- **WHEN** the manager runs a verb on a cycle in `implementing`
- **THEN** the phase stays `implementing` and the assignee stays

#### Scenario: An empty model still runs the role

- **WHEN** the merged factory config has an empty model and the manager runs a verb
- **THEN** the window runs that outcome

#### Scenario: The spy does not start a role

- **WHEN** the window's spy reads a cycle that once received a role
- **THEN** the spy does not run that role again

### Requirement: Ticket-fields sets the named labels and may replace sddHooks

A `ticket-fields` outcome SHALL set the named labels among `sdd:auto-plan`, `sdd:auto-spec`, and `sdd:auto-design`, and SHALL NOT set `sdd:auto-merge`. It SHALL NOT remove a label. It SHALL replace `sddHooks` with the role text only when that text reads as a map of points. Otherwise it SHALL leave the field unchanged. A write that does not fit SHALL leave the previous value. There SHALL be no merge with a manager's edit on the queue: the last run SHALL write its own text.

#### Scenario: Named labels are set

- **WHEN** the manager runs a `ticket-fields` verb whose labels are `sdd:auto-spec`
- **THEN** the issue gains `sdd:auto-spec` and does not gain `sdd:auto-merge`

#### Scenario: A point map replaces sddHooks

- **WHEN** the role text reads as a map of points
- **THEN** `sddHooks` becomes that text

#### Scenario: Prose leaves sddHooks

- **WHEN** the role text does not read as a map of points
- **THEN** `sddHooks` stays as it was, and the named labels are still set

### Requirement: A pull comment needs exactly one open pull request

A `pull-comment` outcome SHALL write the role text on the single open pull request. When several pull requests are open, or none are open, the outcome SHALL write nothing and the verb SHALL show `комментарий не записан`. When none are open, the outcome SHALL NOT set the icon.

#### Scenario: One pull request receives the text

- **WHEN** the cycle has one open pull request and the manager runs a `pull-comment` verb
- **THEN** that pull request gains a comment with the role text

#### Scenario: Zero pull requests set no icon

- **WHEN** the cycle has no open pull request and the manager runs a `pull-comment` verb
- **THEN** no comment is written, the card gains no icon from that run, and the verb shows `комментарий не записан`

### Requirement: HTML opens and is not written on the cycle

An `html` outcome SHALL open the role text in a popup and SHALL NOT write it on the cycle.

#### Scenario: HTML stays off the issue

- **WHEN** the manager runs an `html` verb
- **THEN** a popup shows the text and the issue gains no comment from that run

### Requirement: A cycle file opens from the card's checkout

A `cycle-file` outcome SHALL open a popup from the checkout of the card. It SHALL NOT start an agent, and it SHALL NOT open a tab. When the file is absent, the popup SHALL say the file is absent and SHALL save nothing.

#### Scenario: A missing cycle file saves nothing

- **WHEN** the manager runs a `cycle-file` verb and the checkout has no such file
- **THEN** the popup says the file is absent and the checkout gains no file
