# ticket-heading

## Requirements

### Requirement: The ticket heading is one line

The board and the sidebar SHALL show `#<key>: <title>` on one line. When the ticket has `owner/repo`, `#<key>` SHALL link to `https://github.com/<owner>/<repo>/issues/<key>` and SHALL NOT sit inside the control that opens the drawer. The colon and the title SHALL still open the drawer. Without `owner/repo`, the key and the title SHALL be text.

#### Scenario: The board shows the issue link beside the title

- **WHEN** a cycle has repo `acme/billing`, key `1`, and title `Take me`
- **THEN** the board shows `#1: Take me`, the key links to `https://github.com/acme/billing/issues/1`, and that link is not inside the open button

#### Scenario: A ticket without a repo has no link

- **WHEN** a cycle has no repo
- **THEN** the heading is text `#<key>: <title>` and has no issue link

### Requirement: The sidebar names the one open pull request

When exactly one pull request is open and its id is known, the sidebar SHALL append ` (PR: #<id>)` in muted color. `#<id>` SHALL link to `https://github.com/<owner>/<repo>/pull/<id>`. Zero or several pull requests SHALL omit that parenthesis. The board SHALL NOT show it.

#### Scenario: One pull request is a muted link in the sidebar

- **WHEN** a cycle with repo `acme/billing` has one open pull request `11` and the drawer is open
- **THEN** the sidebar shows `(PR: #11)` in muted color, `#11` links to `https://github.com/acme/billing/pull/11`, and the board row does not show that parenthesis

#### Scenario: Several pull requests omit the parenthesis

- **WHEN** a cycle has repo `acme/billing`, two open pull requests, and a pull id `11`
- **THEN** the open sidebar does not show `(PR:` and does not link to `/pull/11`

### Requirement: The project badge links to the project root

The board and the sidebar SHALL show a separate badge. The name SHALL be the last segment of the service path. An empty service SHALL use the repository name, the segment of `owner/repo` after the slash, and SHALL link to `https://github.com/<owner>/<repo>`. A service path SHALL link to `https://github.com/<owner>/<repo>/tree/HEAD/<service path>`. The badge SHALL be absent when the service is unnamed or the repo is absent.

#### Scenario: A service path badges its last segment

- **WHEN** a cycle has repo `acme/billing` and service `services/billing`
- **THEN** the board and the open sidebar show a badge `billing` linking to `https://github.com/acme/billing/tree/HEAD/services/billing`

#### Scenario: An empty service badges the repository root

- **WHEN** a cycle has repo `acme/billing` and service `''`
- **THEN** the badge is `billing` and links to `https://github.com/acme/billing`

#### Scenario: An unnamed service has no badge

- **WHEN** a cycle has repo `acme/billing` and no service field
- **THEN** the heading has no project badge
