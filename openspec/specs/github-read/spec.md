# github-read

## Purpose

GitHub reads for the board and the spy stay inside the rate limit. A gateway or network failure is tried again, and the log names that failure.

## Requirements

### Requirement: The cycle field is read for a cycle

`listOpen` SHALL read the organization field `sddHooks` for an open issue that carries `sdd:cycle`. It SHALL NOT read that field for an open issue that does not carry `sdd:cycle`. Reading one issue by key SHALL still read the field.

#### Scenario: An issue without the cycle label skips the field

- **WHEN** the open list has one issue with `sdd:cycle` and one issue without it
- **THEN** the field is read for the cycle issue and not for the other

### Requirement: One pull view carries checks and commits

An open pull request's checks, conflict, and head and base commits SHALL come from one `pr view`. A later range SHALL NOT ask again when both commits were present. When they were omitted, the range SHALL use one REST read. When the client rejects the base field, one view without it SHALL still be read and the base SHALL come from one REST read. The same pull request SHALL NOT be viewed again while the repository list is fresh.

#### Scenario: Checks and the two commits come from one view

A view whose mergeability is `CONFLICTING` SHALL mark the pull request as conflicting.

Any other mergeability, including a view that omits it, SHALL NOT.

- **WHEN** the review reads an open pull request and then its range
- **THEN** one view asks for the checks and both commits, the range does not ask again, and a view that omits the commits is followed by one REST read

#### Scenario: A conflicting pull request is named from that view

- **WHEN** the one view reports mergeability `CONFLICTING`
- **THEN** the open pull request is conflicting and no second view is requested

#### Scenario: A client without the base field still reads the pull request

- **WHEN** the view that asks for the base commit is rejected as an unknown field
- **THEN** the open pull request is still returned and one REST read supplies the base commit

#### Scenario: A fresh view is not requested again

- **WHEN** the review reads the same open pull request twice while the list is fresh
- **THEN** one view is requested

### Requirement: Open pull requests are one repository list

A reading of pull requests SHALL request the repository's open pull requests once and SHALL request its merged pull requests once. An issue SHALL receive a pull request when the title starts with `#<key>:` or `#<key> `. The review SHALL NOT search once per issue. The list SHALL stay fresh for one minute. A reading after that list is no longer fresh SHALL request the open list again. Creating a pull request SHALL make the next reading request the open list again.

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

When GitHub answers that the rate limit is spent and the response names `x-ratelimit-reset`, polling SHALL NOT spawn `gh` again until that time.

When that answer does not name the reset, one read of the rate-limit resource SHALL supply it.

While the pause holds, the board SHALL NOT read the tracker.

When GitHub answers that the GraphQL rate limit is already exceeded, polling SHALL wait for that resource's graphql reset and SHALL NOT end the process.

#### Scenario: A spent rate limit waits until the reset

The first such failure MAY be logged once.

When GitHub answers that a secondary rate limit is spent, polling SHALL NOT spawn `gh` again until the wait GitHub names, or for one minute when it names none.

That pause SHALL NOT use the primary `x-ratelimit-reset`.

The log SHALL name the secondary limit once.

A 403 that is not a rate limit SHALL NOT pause polling.

- **WHEN** GitHub answers that the rate limit is spent and names the reset
- **THEN** the board does not read the tracker again until that reset

#### Scenario: A GraphQL rate limit waits until the graphql reset

- **WHEN** GitHub answers that the GraphQL rate limit is already exceeded and the rate-limit resource names the graphql reset
- **THEN** polling does not spawn `gh` again until that reset and the board stays up

#### Scenario: A nameless rate limit reads the reset resource

- **WHEN** the failing answer does not name the reset and the rate-limit resource does
- **THEN** the pause uses that reset

#### Scenario: A secondary rate limit waits a minute

- **WHEN** GitHub answers that a secondary rate limit is spent and names no wait
- **THEN** polling does not spawn `gh` again for one minute and the log names that limit once

#### Scenario: A secondary rate limit uses the named wait

- **WHEN** GitHub answers that a secondary rate limit is spent and names a wait
- **THEN** polling does not spawn `gh` again until that wait

#### Scenario: A forbidden answer that is not a rate limit does not pause

- **WHEN** GitHub answers 403 and the body is not a rate limit
- **THEN** polling is not paused

### Requirement: A gateway answer is tried again

When `gh` fails on HTML, plain text, HTTP 502, HTTP 503, HTTP 504, or an unreachable network, the call SHALL be tried once more. The retry log SHALL name that answer and SHALL NOT include `invalid character`. After that try the call SHALL fail with the same reason. When this burst has already spent the unreachable retry, a later unreachable call SHALL NOT be tried again. An unknown field SHALL NOT be tried again.

#### Scenario: Plain text is tried again

Any other failure SHALL be logged as the text `gh` wrote, and that line SHALL NOT be only `gh exited 1` when `gh` wrote a line.

- **WHEN** the first answer is plain text a JSON decoder cannot read
- **THEN** the call is made again and the log names that text

#### Scenario: A repeated gateway answer fails with the reason

- **WHEN** every try answers with that plain text
- **THEN** the call fails with that reason and the log does not include `invalid character`

#### Scenario: An unknown field is not tried again

- **WHEN** gh rejects an unknown field
- **THEN** the call is made once and the log names that field

#### Scenario: HTTP 503 is tried again

- **WHEN** the answer is HTTP 503
- **THEN** the call is made again and the log names HTTP 503

#### Scenario: An unreachable network is tried again

- **WHEN** the call fails because the network cannot be reached
- **THEN** the call is made again and the log names that the network cannot be reached

#### Scenario: A later unreachable call is not tried again

- **WHEN** one unreachable call has already used its retry and the next call cannot reach the network
- **THEN** that later call is made once

### Requirement: Open issue links are one query

`listOpen` SHALL read parent, blocked-by, and blocks for the open issues in one GraphQL query. It SHALL NOT send one query per issue.

#### Scenario: Two open issues share one link query

- **WHEN** the open list has two issues
- **THEN** one GraphQL query reads the links

### Requirement: Threads are read with the first and last comment

A thread read SHALL request the first comment and the last comment on each thread. It SHALL NOT request every comment. When the repository pull list is still fresh, the threads of its open pull requests SHALL be read in one query.

#### Scenario: A thread read asks for the first and the last comment

- **WHEN** the review reads threads for one pull request
- **THEN** the query asks for the first comment and the last comment and does not ask for the first 100 comments

#### Scenario: Two open pull requests share one thread query

- **WHEN** the pull list is fresh and the review reads threads for two of its open pull requests
- **THEN** one query reads both
