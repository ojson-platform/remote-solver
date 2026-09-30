# reviewer

## Purpose

`remote-solver review` judges one accepting pull request. The cycle machine does not read `auto-review`.

## Requirements

### Requirement: Only one accepting pull request is reviewed

An issue without `auto-review` SHALL NOT be in the queue. `auto-review` without `accepting` SHALL be skipped. `auto-review` with `auto-merge` SHALL be skipped, because the cycle machine merges. Zero open pull requests, or several, SHALL wait. One open pull request on `accepting` SHALL be reviewed. An empty queue SHALL say that no `auto-review` issue is open.

#### Scenario: Auto-merge skips the reviewer

- **WHEN** an issue has `auto-review`, `accepting`, and `auto-merge`
- **THEN** the reviewer skips it and does not judge

#### Scenario: Auto-review before accepting is skipped

- **WHEN** an issue has `auto-review` and is not on `accepting`
- **THEN** the reviewer skips it until `accepting`

#### Scenario: An issue without auto-review is left out

- **WHEN** an issue is on `accepting` and has no `auto-review`
- **THEN** the reviewer does not list it

#### Scenario: Several open pull requests wait

- **WHEN** an accepting issue has `auto-review` and two open pull requests
- **THEN** the reviewer waits and does not judge

#### Scenario: One open pull request is ready

- **WHEN** an accepting issue has `auto-review` and one open pull request
- **THEN** the reviewer is ready to judge that pull request

#### Scenario: An empty queue says so

- **WHEN** no open issue has `auto-review`
- **THEN** the reviewer says that no `auto-review` issue is open

### Requirement: The reviewer waits until the pull request is quiet

Checks that are not green SHALL wait. An unanswered comment, or an open layer, SHALL wait and SHALL NOT call the judge. A conversation note `sdd:note reviewed <head>` for this head SHALL merge without the judge. An empty head SHALL wait and SHALL NOT match a note written for another head.

#### Scenario: Pending checks wait

- **WHEN** the pull request checks are still pending
- **THEN** the reviewer waits and does not judge

#### Scenario: An unanswered comment waits

- **WHEN** the checks are green and the last conversation comment is a person's and carries no marker
- **THEN** the reviewer waits and does not judge

#### Scenario: An open layer does not call the judge

- **WHEN** the checks are green and the conversation marks a layer
- **THEN** the reviewer waits and does not judge, merge, or post

#### Scenario: A reviewed head merges without the judge

- **WHEN** the checks are green and the conversation already notes this head as reviewed
- **THEN** the reviewer merges and does not call the judge

#### Scenario: An empty head does not match another note

- **WHEN** the head does not resolve and the conversation notes some other head as reviewed
- **THEN** the reviewer waits and does not merge

### Requirement: The verdict posts a note, remarks, or nothing

An empty answer, or an answer that is not `clean` and not a remark, SHALL post nothing, and the review command SHALL fail. `clean` SHALL post `sdd:note reviewed <head>` and then merge. Remarks SHALL be posted as one review, without the robot mark. A blank remark SHALL be dropped. A remark that carries a marker or the robot mark SHALL be dropped. At most five remarks SHALL be kept.

#### Scenario: An empty answer posts nothing and the command fails

- **WHEN** the judge returns an empty answer
- **THEN** the reviewer posts nothing, does not merge, and the command fails

#### Scenario: A clean verdict notes the head and merges

- **WHEN** the judge returns clean
- **THEN** the reviewer posts `sdd:note reviewed` for that head and merges

#### Scenario: Remarks are one comment and carry no robot mark

- **WHEN** the judge returns two remarks and one blank line
- **THEN** the reviewer posts the two remarks once, without the robot mark, and does not merge

#### Scenario: A remark that carries a marker is dropped

- **WHEN** one remark carries a marker and another does not
- **THEN** only the remark without a marker is kept

#### Scenario: At most five remarks are kept

- **WHEN** the judge returns six remarks
- **THEN** the reviewer keeps five

#### Scenario: Clean and an empty answer are read from the text

- **WHEN** the judge's text is exactly `clean`, or the text is empty
- **THEN** `clean` is a clean verdict and the empty text is unjudged

### Requirement: A remark lands on a diff line only when that line is in the diff

A remark whose file and line are in the diff SHALL stay on that line. A line that is not in the diff SHALL keep the file and drop the line. A file that is not in the diff SHALL be left on the conversation.

#### Scenario: A line in the diff stays on that line

- **WHEN** a remark names a file and a line that the diff adds
- **THEN** the remark stays on that file and line

#### Scenario: A line outside the hunk keeps the file

- **WHEN** a remark names a file in the diff and a line the diff does not contain
- **THEN** the remark keeps the file and drops the line

#### Scenario: A file outside the diff is left on the conversation

- **WHEN** a remark names a file the diff does not contain
- **THEN** the remark keeps only its text

### Requirement: A dossier that cannot be assembled waits

No base, a range that does not resolve, an empty diff, or a change with no files SHALL wait, and that wait SHALL NOT be a clean verdict. An archived change that still has a file SHALL fill the dossier.

#### Scenario: No base waits before the diff

- **WHEN** the pull request has no base
- **THEN** the reviewer waits and does not call the judge

#### Scenario: A missing range waits

- **WHEN** the base and the head do not resolve to a diff
- **THEN** the reviewer waits and does not call the judge

#### Scenario: An empty diff waits

- **WHEN** the diff is empty
- **THEN** the reviewer waits and does not treat it as a clean verdict

#### Scenario: A change with no files waits

- **WHEN** the issue has neither an active change nor an archived one
- **THEN** the reviewer waits

#### Scenario: An archived change still fills the dossier

- **WHEN** the active change is gone and the archive still has a proposal
- **THEN** the dossier includes that proposal
