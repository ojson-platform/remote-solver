# unsent-remark

## Purpose

A new remark stays in the window until send. The send control posts each as its own review thread, «Принять» stays on the phase row, and the draft disappears when the thread is already on the pull request.

## ADDED Requirements

### Requirement: A new remark stays in the window until send

A new remark SHALL stay in the window until send.

#### Scenario: A new remark stays in the window until send

- **WHEN** a new remark and the window are already visible, together with sending the remark before the send control as the limit that can replace this stay
- **THEN** a new remark stays in the window until send

### Requirement: The send control posts every unsent remark as its own review thread

The send control on the remark field SHALL post every unsent remark as its own review thread.

#### Scenario: The send control on the remark field posts every unsent remark as its own review thread

- **WHEN** the send control, the remark field, and every unsent remark are already visible, together with one review thread for all unsent remarks as the limit that can replace these threads
- **THEN** the send control on the remark field posts every unsent remark as its own review thread

### Requirement: «Принять» stays on the phase row

«Принять» SHALL stay on the phase row. The send control SHALL NOT take its place.

#### Scenario: «Принять» stays on the phase row

- **WHEN** «Принять» and the phase row are already visible, together with the send control in the place of «Принять» as the limit that can replace «Принять» on the phase row
- **THEN** «Принять» stays on the phase row

#### Scenario: The send control does not take its place

- **WHEN** the send control and the place of «Принять» on the phase row are already visible, together with the send control in the place of «Принять» as the limit that can replace this refusal
- **THEN** the send control does not take its place

### Requirement: A successful send shows the thread and clears the draft

Immediately after a successful send, the thread SHALL be visible in the sidebar, and the draft SHALL be cleared together with that. After the GitHub thread has been accepted, the draft SHALL disappear.

#### Scenario: Immediately after a successful send the thread is visible in the sidebar and the draft is cleared together with that

- **WHEN** a successful send, the thread, the sidebar, and the draft are already visible, together with a field that keeps the same text and a thread that is not in the sidebar as the limit that can replace this clearing
- **THEN** immediately after a successful send the thread is visible in the sidebar and the draft is cleared together with that

#### Scenario: After the GitHub thread has been accepted, the draft must disappear

- **WHEN** the GitHub thread that has been accepted and the draft are already visible, together with a draft that keeps the same text after the GitHub thread has been accepted as the limit that can replace this disappearance
- **THEN** after the GitHub thread has been accepted, the draft must disappear

### Requirement: The draft remains only when that thread is not on the pull request

The draft SHALL remain only when that thread is not on the pull request. A failed send SHALL leave the draft only when that thread is not on the pull request. Once GitHub has accepted the thread, the draft SHALL disappear, including when the window reported an error such as stale.

#### Scenario: A failed send leaves the draft

- **WHEN** a failed send and the draft are already visible, and that thread is not on the pull request, together with GitHub having accepted the thread, including when the window reported an error such as stale, as the limit that can replace this remaining draft
- **THEN** a failed send leaves the draft only when that thread is not on the pull request

#### Scenario: Once GitHub has accepted the thread, the draft disappears, including when the window reported an error such as stale

- **WHEN** the thread GitHub has accepted, the draft, and the error the window reported, such as stale, are already visible, together with a failed send that leaves the draft when that thread is not on the pull request as the limit that can replace this disappearance
- **THEN** once GitHub has accepted the thread, the draft disappears, including when the window reported an error such as stale

#### Scenario: The draft remains only when that thread is not on the pull request

- **WHEN** the draft, that thread, and the pull request are already visible, together with a draft that remains when that thread is already on the pull request as the limit that can replace this condition
- **THEN** the draft remains only when that thread is not on the pull request

#### Scenario: The draft remains only when the thread is not on the pull request

- **WHEN** the draft, the thread, and the pull request are already visible, together with a draft that remains after the GitHub thread has been accepted as the limit that can replace this condition
- **THEN** the draft remains only when the thread is not on the pull request

### Requirement: A retry does not post a second thread with the same text on the same line

When the pull request already has that thread, including after the window reported an error, a retry SHALL NOT post a second thread with the same text on the same line. If the window replied with an error after the write, including "stale", a retry SHALL NOT create a second thread with the same text on the same line.

#### Scenario: When the pull request already has that thread, including after the window reported an error, a retry does not post a second thread with the same text on the same line

- **WHEN** the pull request, that thread, the same text, the same line, and the error the window reported are already visible, together with a second thread with the same text on the same line as the limit that can replace this refusal
- **THEN** when the pull request already has that thread, including after the window reported an error, a retry does not post a second thread with the same text on the same line

#### Scenario: If the window replied with an error after the write, including stale, a retry does not create a second thread with the same text on the same line

- **WHEN** the error the window replied with after the write, including "stale", the same text, and the same line are already visible, together with a second thread with the same text on the same line as the limit that can replace this refusal
- **THEN** if the window replied with an error after the write, including "stale", a retry does not create a second thread with the same text on the same line

### Requirement: The window holds the queue for the open ticket

The window SHALL hold the queue for the open ticket. A reload SHALL drop unsent remarks.

#### Scenario: The window holds the queue for the open ticket

- **WHEN** the window, the queue, and the open ticket are already visible, together with another ticket's queue as the limit that can replace this queue
- **THEN** the window holds the queue for the open ticket

#### Scenario: A reload drops unsent remarks

- **WHEN** a reload and the unsent remarks are already visible, together with a queue that persists across reloads as the limit that can replace this drop
- **THEN** a reload drops unsent remarks
