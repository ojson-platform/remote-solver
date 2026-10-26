# github-read

## Purpose

GitHub reads for the board and the spy stay inside the rate limit.

## Requirements

### Requirement: The cycle field is read for a cycle

`listOpen` SHALL read the organization field `sddHooks` for an open issue that carries `sdd:cycle`. It SHALL NOT read that field for an open issue that does not carry `sdd:cycle`. Reading one issue by key SHALL still read the field.

#### Scenario: An issue without the cycle label skips the field

- **WHEN** the open list has one issue with `sdd:cycle` and one issue without it
- **THEN** the field is read for the cycle issue and not for the other

### Requirement: One pull view carries checks and commits

An open pull request's checks and its head and base commits SHALL come from one `pr view`. A range read after that view SHALL NOT ask GitHub again when the view included both commits. When the view omits the commits, the range SHALL fall back to one REST read of the pull request.

#### Scenario: Checks and the two commits come from one view

- **WHEN** the review reads an open pull request and then its range
- **THEN** one view asks for the checks and both commits, the range does not ask again, and a view that omits the commits is followed by one REST read

### Requirement: Open pull requests are one repository list

A reading of pull requests SHALL request the repository's open pull requests once and SHALL request its merged pull requests once. An issue SHALL receive a pull request when the title starts with `#<key>:` or `#<key> `. The review SHALL NOT search once per issue. A reading after that list is no longer fresh SHALL request the open list again. Creating a pull request SHALL make the next reading request the open list again.

#### Scenario: Two issues share one open list

- **WHEN** the review reads pull requests for two issues
- **THEN** one open list is requested, a search is not, and each issue receives the pull request whose title carries its key

#### Scenario: A merged pull request stays on the issue

- **WHEN** the merged list has a pull request titled for the issue and the open list does not
- **THEN** that pull request is returned with state MERGED

#### Scenario: The open list is read again after it ages

- **WHEN** the review reads pull requests, the list ages, and the review reads again
- **THEN** the open list is requested again

#### Scenario: A created pull request asks for the open list again

- **WHEN** a pull request is created for an issue
- **THEN** the next reading of that issue's pull requests requests the open list again

### Requirement: A repeated REST read sends the previous validator

A repeated `gh api` GET SHALL send the previous `ETag` as `If-None-Match`. A `304` SHALL keep the cached body and SHALL NOT be treated as a failure.

#### Scenario: A repeated REST read sends the previous validator

- **WHEN** the same REST read runs again and GitHub answers 304
- **THEN** the request carries the previous validator and the cached body is kept

### Requirement: A spent rate limit pauses polling

When GitHub answers that the rate limit is spent and the response names `x-ratelimit-reset`, polling SHALL NOT spawn `gh` again until that time. When that answer does not name the reset, one read of the rate-limit resource SHALL supply it. The first such failure MAY be logged once. While the pause holds, the board SHALL NOT read the tracker.

#### Scenario: A spent rate limit waits until the reset

- **WHEN** GitHub answers that the rate limit is spent and names the reset
- **THEN** the board does not read the tracker again until that reset

#### Scenario: A nameless rate limit reads the reset resource

- **WHEN** the failing answer does not name the reset and the rate-limit resource does
- **THEN** the pause uses that reset
