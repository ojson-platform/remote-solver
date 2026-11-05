## ADDED Requirements

### Requirement: A scenario name in the prose links to its row

A scenario name in the prose SHALL be a link to that scenario's row lower in the sidebar. A name that is not a row SHALL stay text.

#### Scenario: A scenario name in the prose is a link to that scenario's row lower in the sidebar

- **WHEN** a scenario name, the prose, that scenario's row, and the sidebar are already visible, and the name is already a link to that row lower in the sidebar, together with that name staying text as the limit that can replace that link
- **THEN** a scenario name in the prose is a link to that scenario's row lower in the sidebar

#### Scenario: A name that is not a row stays text

- **WHEN** a name that is not a row, and that text, are already visible, and the name already stays text, together with a link to a row as the limit that can replace that text
- **THEN** a name that is not a row stays text
