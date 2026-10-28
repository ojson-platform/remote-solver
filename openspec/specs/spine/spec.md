# spine

## Purpose

The spine is the document rows of the open cycle.

## Requirements

### Requirement: The spine lists the document rows

The open row SHALL show a spine of rows in focus order: Plan, Specify, Design, Tasks, Code, and Accept. The Change row SHALL NOT be shown. The sidebar block list SHALL NOT copy the change files. The window SHALL NOT write these blocks.

#### Scenario: Change bodies stay out

- **WHEN** the cycle has a `proposal.md`
- **THEN** the sidebar block list does not include that file

#### Scenario: The Change row stays out

- **WHEN** a cycle is open
- **THEN** the sidebar spine does not show a Change row

### Requirement: A document row keeps its focus sentence

Each document row SHALL keep the sentence from the latest `sdd:focus` comment, and when that comment is absent SHALL keep the sentence from the issue body between `sdd:begin` and `sdd:end`. A sentence that is `solid` SHALL NOT be shown. Any other sentence SHALL be shown. On the Plan row, an Outcome line takes that place, as `A document row shows its file` specifies.

#### Scenario: A solid sentence stays off the row

- **WHEN** the latest `sdd:focus` marks Plan and Code `solid` and names a gap on Specify, and the cycle is open
- **THEN** the Plan row and the Code row show no sentence, and the Specify row shows that gap

### Requirement: A row opens only when it has a fold

When a cycle opens, the row of the plaque's layer SHALL be open when that row has a fold. A row with no fold SHALL stay closed, and a click on its head SHALL NOT open it. A fold is present for Plan or Design when a section has text or the review remark is shown, for Specify when a capability or the review remark is shown, for Tasks when a task is listed, for Code when a check line, a diff line, a focus remainder, an open pull request, an unanswered review, or a hook is shown, and for Accept always. A second click on an open row SHALL close it, and every row MAY then be closed. A click on the head of a row that has a fold, outside its gate or acceptance control, SHALL toggle that row, including the space the control opens above and below the name. The open row's head SHALL stick to the top of the sidebar scroll.

#### Scenario: An empty row stays closed

- **WHEN** the cycle is open on `proposing` and `proposal.md` is absent
- **THEN** the Plan row is closed, its head is not a toggle, and a click on that head does not open it

#### Scenario: The row head toggles outside its control

- **WHEN** a cycle is open and a row that has a fold shows a control taller than its name
- **THEN** a click on that head outside the control toggles the row, a click on the control does not, and that head, including the space around the name, uses a pointer

#### Scenario: The open row head sticks

- **WHEN** a cycle is open
- **THEN** the open row's head sticks to the top of the sidebar scroll and spans the sidebar width

#### Scenario: A second click closes the open row

- **WHEN** a cycle is open on its plaque row and the manager clicks that row's head again
- **THEN** no spine row is open

### Requirement: A document row shows its file

Plan SHALL show every `##` section of `proposal.md` that has text, including each later paragraph. A `##` section with no text SHALL NOT be shown. A `###` heading SHALL be a subsection heading. An Open questions section with no question SHALL NOT be shown. While a question is open, that section SHALL say that the plan is accepted only once no question is open. An answer to an open question SHALL be a review comment on the one open pull request, and the question line in `proposal.md` SHALL stay. When the issue branch exists, that file SHALL be the copy on the issue branch. When it does not, that file SHALL be the copy in the checkout. The collapsed Plan row SHALL show the first line of Outcome once, cut with an ellipsis, and SHALL NOT repeat the Plan sentence beside it. The open Plan row SHALL hide that line and SHALL NOT show the Plan sentence. When Outcome has no line, the Plan row SHALL keep its sentence, unless that sentence is `solid`. Specify SHALL show each capability's changed requirements. Design SHALL show every `##` section of `design.md` that has text, including each later paragraph. Tasks SHALL list the scenario names from `tasks.md`, and a scenario name SHALL name the capability that owns it. Code SHALL show the check and whether a diff is present, and, when they exist, the unanswered review and the hook.

#### Scenario: The Plan row shows the outcome

- **WHEN** `proposal.md` has an Outcome section, the cycle is open, and the issue branch does not exist
- **THEN** the sidebar shows that Outcome from the checkout on the Plan row

#### Scenario: The Plan row shows every section

- **WHEN** `proposal.md` has Scope and Out of scope, Scope has two paragraphs, and the cycle is open
- **THEN** the Plan row shows both headings and both paragraphs

#### Scenario: A collapsed Plan row shows one outcome line

- **WHEN** the Plan row is closed and Outcome has two lines
- **THEN** the closed row fills the sidebar width, shows the first line once in an excerpt cut with an ellipsis, does not repeat the Plan sentence, and the open row hides that excerpt and does not show the Plan sentence

#### Scenario: An empty plan section stays out

- **WHEN** `proposal.md` has a section with text and a section with no text, and the cycle is open
- **THEN** the Plan row shows the section with text and does not show the empty heading

#### Scenario: Added and Modified are headings

- **WHEN** Capabilities contains `### Added` and `### Modified`, and the cycle is open
- **THEN** the Plan row shows Added and Modified as headings

#### Scenario: An empty Open questions section stays out

- **WHEN** Open questions has no question and the cycle is open
- **THEN** the Plan row does not show Open questions

#### Scenario: An open question holds the plan

- **WHEN** Open questions has an open item and the cycle is open
- **THEN** the Plan row says the plan is accepted only once no question is open

#### Scenario: The Plan row reads the issue branch

- **WHEN** `proposal.md` on `sdd/<key>` differs from `proposal.md` in the checkout working tree and the cycle is open
- **THEN** the Plan row shows the proposal from the issue branch

#### Scenario: An answer is a review comment

- **WHEN** an open question is a line `- [ ]` and the manager answers it on the one open pull request
- **THEN** the review comment quotes that line and the answer, and `proposal.md` still has the open line. An empty answer is shown between the header and the board and is absent on the next load. A written answer does not show a success line there

#### Scenario: The Design row shows every section

- **WHEN** `design.md` has a verification boundary with two paragraphs, an approach, a notes section, a rejected line, and an open decision, and the cycle is open
- **THEN** the Design row shows both boundary paragraphs, the approach, the notes section, the rejected line, and the open decision

#### Scenario: The Code row shows that a diff is present

- **WHEN** the cycle has a diff and is open
- **THEN** the Code row says a diff is present and does not show the patch
