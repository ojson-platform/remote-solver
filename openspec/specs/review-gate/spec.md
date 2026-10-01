# review-gate

## Purpose

On `proposing`, `specifying`, and `designing` the machine opens the review, and a person closes it.

## Requirements

### Requirement: The machine opens the review once

When the phase's artifact is published, one pull request is open, and nothing in that artifact is open, the machine SHALL set `wait-human` and comment the ask once. A later poll SHALL leave the label and SHALL NOT comment the ask again. While that artifact stays ready, the later poll SHALL carry the same gate. An open item, or `wait-human` on any other phase, SHALL leave the gate off, and the reason SHALL be `sdd:wait-human is set on <phase>. Do the ask on the issue.` The ask SHALL name the artifact, the tracker's way to move the phase, and `sdd accept <key>`.

On GitHub the ask SHALL be: review the artifact, replace `sdd:<phase>` with the gate label on this issue, or run `sdd accept <key>`.

#### Scenario: A published proposal is asked once

- **WHEN** the phase is `proposing`, the proposal is published, one pull request is open, and no question is open
- **THEN** the machine sets `wait-human` and comments the proposal ask once
- **AND** the next poll comments nothing further and its decision carries the proposal gate

#### Scenario: An open question is not the review gate

- **WHEN** `proposing` has `wait-human` and a question is open
- **THEN** the decision has no gate and the reason is `sdd:wait-human is set on proposing. Do the ask on the issue.`

#### Scenario: A wait on implementing points at the ask

- **WHEN** `implementing` has `wait-human`
- **THEN** the decision has no gate and the reason is `sdd:wait-human is set on implementing. Do the ask on the issue.`

### Requirement: An auto tag skips the review

`auto-plan` on `proposing`, `auto-spec` on `specifying`, and `auto-design` on `designing` SHALL advance to the next phase without the ask, once the artifact is ready. A tag added after `wait-human` is set SHALL NOT lift the wait.

#### Scenario: Auto-plan advances a ready proposal

- **WHEN** `proposing` has a published proposal, no open question, one pull request, and `auto-plan`
- **THEN** the machine moves the issue to `specifying` and does not set `wait-human`

#### Scenario: Auto-spec does not lift an open review

- **WHEN** `specifying` already has `wait-human` and `auto-spec` is added
- **THEN** the machine keeps waiting, does not move the phase, and the decision carries the spec gate

#### Scenario: Auto-spec advances a ready delta

- **WHEN** `specifying` has a published proposal, a delta, one pull request, and `auto-spec`
- **THEN** the machine moves the issue to `designing` and does not set `wait-human`

### Requirement: A person closes the gate on the issue

A person MAY leave the writing label on and add `proposed`, `specified`, or `designed`. On a ready artifact the machine SHALL move to the next phase, clear `wait-human`, and comment `sdd:accept <from> → <to>`. On a missing artifact or an open item the machine SHALL move the issue back to the writing phase and comment once what is left. The next poll SHALL NOT repeat that comment. When the item is then closed, the machine SHALL post the review ask.

#### Scenario: Proposed on a ready proposal moves to specifying

- **WHEN** a person adds `proposed` beside `proposing` and the proposal has nothing open
- **THEN** the phase becomes `specifying`, `wait-human` is cleared, and the issue comment is `sdd:accept proposing → specifying`

#### Scenario: Specified over a missing delta goes back once

- **WHEN** a person sets `specified` and the change has no delta
- **THEN** the machine moves the issue back to `specifying` and comments once which file is missing

#### Scenario: Designed over an open decision goes back, then asks

- **WHEN** a person sets `designed` and the design has an open decision
- **THEN** the machine moves the issue back to `designing` and comments the open heading once
- **AND** after that decision is closed, the machine posts the design ask

### Requirement: Accept closes only a writing phase

`accept` SHALL advance `proposing`, `specifying`, or `designing` when the artifact is ready. It SHALL wait, and SHALL NOT move the label, when the artifact is missing, an item is open, the phase is any other phase, or the issue has no cycle label.

#### Scenario: Accept advances a ready proposal

- **WHEN** `accept` runs on a cycle in `proposing` whose proposal has nothing open
- **THEN** the machine moves the issue to `specifying`

#### Scenario: Accept waits on an open question

- **WHEN** `accept` runs on `proposing` and a question is still open
- **THEN** the phase stays `proposing` and the result names the open heading

#### Scenario: Accept refuses accepting

- **WHEN** `accept` runs on `accepting`
- **THEN** the phase stays `accepting`

#### Scenario: Accept refuses an issue with no cycle label

- **WHEN** `accept` runs on `proposing` and the issue has no cycle label
- **THEN** the machine waits and does not move the phase
