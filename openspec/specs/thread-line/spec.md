# thread-line

## Purpose

The sidebar shows each review thread of the open pull request on the line it anchors, including a comment GitHub has that the sidebar does not show. A remark with no line stands on the phase. One line holds more than one comment. A reply whose marker is `sdd:fixed` is a status on the original comment, with the commit when the reply has one. It is not a second comment. A thread that is already on the pull request is visible this way.

## Requirements

### Requirement: Each review thread stands on the line it anchors

The sidebar SHALL show each review thread of the open pull request on the line it anchors, including a comment GitHub has that the sidebar does not show. A remark with no line SHALL stand on the phase. One line SHALL hold more than one comment. A reply whose marker is `sdd:fixed` SHALL be a status on the original comment, with the commit when the reply has one. It SHALL NOT be a second comment. A thread that is already on the pull request SHALL be visible this way.

#### Scenario: The sidebar shows each review thread of the open pull request on the line it anchors

- **WHEN** the sidebar, each review thread of the open pull request, and the line it anchors are already visible, together with a remark with no line as the limit that can replace that line
- **THEN** the sidebar shows each review thread of the open pull request on the line it anchors

#### Scenario: A remark with no line stands on the phase

- **WHEN** a remark with no line and the phase are already visible, together with the line a review thread anchors as the limit that can replace that phase
- **THEN** a remark with no line stands on the phase

#### Scenario: One line holds more than one comment

- **WHEN** one line and more than one comment are already visible, together with a reply whose marker is `sdd:fixed` as the limit that can replace a second comment
- **THEN** one line holds more than one comment

#### Scenario: A reply whose marker is sdd:fixed is a status on the original comment, with the commit when the reply has one

- **WHEN** a reply whose marker is `sdd:fixed`, the status on the original comment, and the commit are already visible, together with a reply that has no commit as the limit that can replace that commit
- **THEN** a reply whose marker is `sdd:fixed` is a status on the original comment, with the commit when the reply has one

#### Scenario: It is not a second comment

- **WHEN** a reply whose marker is `sdd:fixed` is already visible as a status on the original comment, together with a second comment on that line as the limit that can replace that status
- **THEN** it is not a second comment

#### Scenario: A thread that is already on the pull request is visible this way

- **WHEN** a thread that is already on the pull request is already visible this way, together with a new remark held until send as the limit that can replace that thread
- **THEN** a thread that is already on the pull request is visible this way
