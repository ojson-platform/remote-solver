## MODIFIED Requirements

### Requirement: A line comment uses a thread when the line has an anchor

A row copied from the delta SHALL carry an anchor: the delta path, the line number in that file, and side `right`.

Choosing that row and sending text SHALL call `openThread` with the person's text only.

A row without an anchor SHALL call `speak` with the visible line quoted above the text.

A refused thread that is not a send from «Записать» SHALL call `speak` with the same quote and SHALL NOT put the host error in the snapshot.

Both calls failing SHALL yield `комментарий не записан`.

#### Scenario: A line copied from the delta opens a thread

- **WHEN** the person comments a line that the delta contributed and one pull request is open
- **THEN** the review thread is opened on the delta path at the delta line with the person's text only

#### Scenario: A baseline line quotes the pull request

- **WHEN** the person comments a line that was not copied from the delta and one pull request is open
- **THEN** the pull request conversation receives the visible line as a quote and the person's text

#### Scenario: A refused thread is quoted

- **WHEN** the thread call fails, the send is not from «Записать», and the conversation call succeeds
- **THEN** the conversation receives the quote and the snapshot does not contain the host error

#### Scenario: A refused send from «Записать» does not post a conversation comment

- **WHEN** a refused send from «Записать» is already visible, together with a conversation comment posted for that send as the limit that can replace this refusal
- **THEN** a refused send from «Записать» does not post a conversation comment

#### Scenario: Both writes failing leave the comment unrecorded

- **WHEN** the thread call fails and the conversation call fails
- **THEN** the snapshot status is `комментарий не записан`

#### Scenario: A plan line opens a thread on proposal.md

- **WHEN** the person comments a body line of the plan and one pull request is open
- **THEN** the review thread is opened on `proposal.md` at that file line

#### Scenario: A design line opens a thread on design.md

- **WHEN** the person comments a body line of the design and one pull request is open
- **THEN** the review thread is opened on `design.md` at that file line

#### Scenario: A plan line opens a thread

- **WHEN** one pull request is open and the manager comments on a plan line
- **THEN** the review thread is opened on `openspec/changes/issue-<key>/proposal.md` at that file line with only the manager's text, and the pull-request conversation receives no quote

#### Scenario: A design line opens a thread

- **WHEN** one pull request is open and the manager comments on a design line
- **THEN** the review thread is opened on `openspec/changes/issue-<key>/design.md` at that file line with only the manager's text, and the pull-request conversation receives no quote

#### Scenario: An open question stays a conversation reply

- **WHEN** the person answers an open question line of the plan
- **THEN** the conversation receives that question as an open checkbox and does not open a thread

#### Scenario: An open design question stays a conversation reply

- **WHEN** the person answers an open question line of the design
- **THEN** the conversation receives that question as an open checkbox and does not open a thread

#### Scenario: A design checkbox outside Open questions opens a thread

- **WHEN** the person comments a `- [ ]` line of the design that is not in Open questions and one pull request is open
- **THEN** the review thread is opened on `design.md` at that file line and the conversation receives no quote

#### Scenario: A repeated design checkbox outside Open questions opens a thread

- **WHEN** the design has the same `- [ ]` line in Open questions and in another section, and the person comments the line outside Open questions while one pull request is open
- **THEN** the review thread is opened on `design.md` at that outside line and the conversation receives no quote
