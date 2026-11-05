# focus

## Purpose

Focus is the machine's record on a cycle of which layers are solid and which gaps remain. The window shows that record and does not recompute it. How the machine chooses a gap is not part of this spec.

## Requirements

### Requirement: The skill writes a focus comment when the artifact is published

The skill of the phase SHALL write a focus comment when that phase's artifact is published. The skill SHALL write a focus comment when a visit leaves something a person will read later. A separate review of that artifact SHALL NOT write the focus comment. A separate review step SHALL NOT write the focus. The comment SHALL be prose for one phase, or prose for the whole pull request. The first line SHALL be the marker `sdd:focus:plan`, `sdd:focus:spec`, `sdd:focus:design`, `sdd:focus:tasks`, `sdd:focus:code`, `sdd:focus:accept`, or `sdd:focus` for the whole pull request. A pattern in place of those markers SHALL NOT be that first line. Older focus comments SHALL remain. Older comments SHALL remain. The same text SHALL NOT add another comment. The machine SHALL NOT append the layer ledger (`Plan solid`, `thread N`, `file:line`) as the comment a person reads. There SHALL be no ledger. A run with no signal SHALL leave the latest focus comment unchanged. The skill SHALL NOT write a focus comment when the cycle has no change file. A published proposal SHALL use `sdd:focus:plan`. A published delta spec SHALL use `sdd:focus:spec`. A published design SHALL use `sdd:focus:design`. Published tasks SHALL use `sdd:focus:tasks`. A code slice, or a code change that answers a review thread, SHALL use `sdd:focus:code`. The archive commit SHALL use `sdd:focus:accept`. The archive SHALL write this comment every time, including when `sdd:auto-merge` is set. When the document was published, `sdd:auto-plan`, `sdd:auto-spec`, and `sdd:auto-design` SHALL NOT skip the comment. A visit that fixes review threads of its own phase SHALL write that phase's marker even when the diff is small. Verify, labeling threads, a rebase-only commit, and a publish that carries no phase artifact SHALL NOT write a focus comment.

#### Scenario: The skill of the phase writes this comment when the artifact is published

- **WHEN** the phase's artifact is published and the skill of that phase is already the writer of this focus comment, together with a separate review of that artifact
- **THEN** the skill of the phase writes this focus comment, and the separate review does not

#### Scenario: The skill writes a focus comment when a visit leaves something a person will read later

- **WHEN** a visit that leaves something a person will read later is already visible, together with verify, labeling threads, a rebase-only commit, and a publish that carries no phase artifact as the limit that can replace that visit
- **THEN** the skill writes a focus comment when a visit leaves something a person will read later

#### Scenario: A focus comment is prose for one phase or the whole pull request

- **WHEN** a focus comment that is prose for one phase is already visible, together with a focus comment that is prose for the whole pull request
- **THEN** a focus comment is prose for one phase, or for the whole pull request

#### Scenario: The first line is the marker sdd:focus:plan, sdd:focus:spec, sdd:focus:design, sdd:focus:tasks, sdd:focus:code, sdd:focus:accept, or sdd:focus

- **WHEN** focus comments are already visible whose first lines are the markers `sdd:focus:plan`, `sdd:focus:spec`, `sdd:focus:design`, `sdd:focus:tasks`, `sdd:focus:code`, and `sdd:focus:accept`, together with a pattern `sdd:focus:<phase>` in place of those markers and a whole-pull-request comment whose first line is the marker `sdd:focus`
- **THEN** the first line is the marker `sdd:focus:plan`, `sdd:focus:spec`, `sdd:focus:design`, `sdd:focus:tasks`, `sdd:focus:code`, `sdd:focus:accept`, or `sdd:focus` for the whole pull request, and a pattern in place of those markers is not that first line

#### Scenario: The layer ledger is not the comment a person reads

- **WHEN** the comment a person reads is already visible, together with the layer ledger (`Plan solid`, `thread N`, `file:line`)
- **THEN** the machine does not append the layer ledger (`Plan solid`, `thread N`, `file:line`) as the comment a person reads

#### Scenario: Older focus comments remain

- **WHEN** an older focus comment is already visible, together with a newer focus comment
- **THEN** the older focus comment remains

#### Scenario: Older comments remain

- **WHEN** older comments are already visible, together with a newer focus comment as the limit that can replace those older comments
- **THEN** older comments remain

#### Scenario: The same text does not add another comment

- **WHEN** a focus comment with this text is already visible, together with the same text written again
- **THEN** the same text does not add another comment

#### Scenario: There is no ledger and no fixed heading

- **WHEN** the comment a person reads is already visible, together with the layer ledger (`Plan solid`, `thread N`, `file:line`) and a fixed heading as the limit that can replace that comment
- **THEN** there is no ledger and no fixed heading

#### Scenario: No signal leaves the comment

- **WHEN** a step run ends with no signal and a focus comment is already visible
- **THEN** that focus comment stays unchanged

#### Scenario: No change file means no focus comment

- **WHEN** the cycle has no change file and a step run ends with Publish
- **THEN** the issue gains no focus comment

#### Scenario: A published proposal uses sdd:focus:plan

- **WHEN** a published proposal is already visible, together with the marker `sdd:focus:spec` as the limit that can replace `sdd:focus:plan`
- **THEN** a published proposal uses `sdd:focus:plan`

#### Scenario: A published delta spec uses sdd:focus:spec

- **WHEN** a published delta spec is already visible, together with the marker `sdd:focus:plan` as the limit that can replace `sdd:focus:spec`
- **THEN** a published delta spec uses `sdd:focus:spec`

#### Scenario: A published design uses sdd:focus:design

- **WHEN** a published design is already visible, together with the marker `sdd:focus:spec` as the limit that can replace `sdd:focus:design`
- **THEN** a published design uses `sdd:focus:design`

#### Scenario: Published tasks use sdd:focus:tasks

- **WHEN** published tasks are already visible, together with the marker `sdd:focus:design` as the limit that can replace `sdd:focus:tasks`
- **THEN** published tasks use `sdd:focus:tasks`

#### Scenario: A code slice, or a code change that answers a review thread, uses sdd:focus:code

- **WHEN** a code slice is already visible, together with a code change that answers a review thread as the limit that can replace that code slice
- **THEN** a code slice, or a code change that answers a review thread, uses `sdd:focus:code`

#### Scenario: The archive commit uses sdd:focus:accept

- **WHEN** the archive commit is already visible, together with the marker `sdd:focus:code` as the limit that can replace `sdd:focus:accept`
- **THEN** the archive commit uses `sdd:focus:accept`

#### Scenario: The archive writes this comment every time, including when sdd:auto-merge is set

- **WHEN** the archive commit and this comment are already visible, together with `sdd:auto-merge` set as the limit that can replace writing this comment
- **THEN** the archive writes this comment every time, including when `sdd:auto-merge` is set

#### Scenario: sdd:auto-plan, sdd:auto-spec, and sdd:auto-design do not skip the comment, and the document was published

- **WHEN** `sdd:auto-plan`, `sdd:auto-spec`, and `sdd:auto-design` are already set, and the document was published, together with a skipped focus comment as the limit that can replace that published document
- **THEN** `sdd:auto-plan`, `sdd:auto-spec`, and `sdd:auto-design` do not skip the comment, and the document was published

#### Scenario: A visit that fixes review threads of its own phase writes that phase's marker even when the diff is small

- **WHEN** a visit that fixes review threads of its own phase is already visible and the diff is small, together with a large diff as the limit that can replace that small diff
- **THEN** a visit that fixes review threads of its own phase writes that phase's marker even when the diff is small

#### Scenario: Verify, labeling threads, a rebase-only commit, and a publish that carries no phase artifact write no focus comment

- **WHEN** verify, labeling threads, a rebase-only commit, and a publish that carries no phase artifact are already visible, together with a publish that carries a phase artifact as the limit that can replace them
- **THEN** verify, labeling threads, a rebase-only commit, and a publish that carries no phase artifact write no focus comment

#### Scenario: A separate review step does not write the focus

- **WHEN** a separate review step is already visible, together with the skill of the phase writing this focus comment as the limit that can replace that review step
- **THEN** a separate review step does not write the focus

### Requirement: The sidebar focus block shows the latest focus prose

The sidebar focus block SHALL show the latest focus comment, with that marker as a badge and the prose under it. The window SHALL NOT recompute the prose. The window SHALL NOT rewrite the prose. The spine row of that phase SHALL keep the first sentence of its own latest phase comment. A whole-pull-request comment SHALL belong to the focus block and to no single row. An ask, a role outcome, and a manager's comment SHALL NOT become the focus block.

#### Scenario: The sidebar focus block shows the latest marker as a badge and the prose under it

- **WHEN** the sidebar focus block, the latest focus comment, that marker, that badge, and the prose under it are already visible, together with an older focus comment
- **THEN** the sidebar focus block shows the latest of these, with that marker as a badge, and the prose under it

#### Scenario: The window does not rewrite the prose

- **WHEN** the prose is already visible, together with a rewrite of that prose as the limit that can replace it
- **THEN** the window does not rewrite the prose

#### Scenario: The spine row of that phase keeps the first sentence of its own latest phase comment

- **WHEN** the spine row of that phase is already visible and the first sentence of its own latest phase comment is already visible, together with a whole-pull-request comment
- **THEN** the spine row of that phase keeps the first sentence of its own latest phase comment

#### Scenario: A whole-pull-request comment belongs to the focus block and to no single row

- **WHEN** a whole-pull-request comment and the focus block are already visible, together with a single spine row
- **THEN** the whole-pull-request comment belongs to the focus block and to no single row

#### Scenario: A manager comment is not the focus block

- **WHEN** the latest issue comment is the manager's and an older comment is a focus comment
- **THEN** the focus block is that older comment, with its marker as a badge and its prose under the badge

### Requirement: A marker lands on the mirror name

The focus names SHALL be the mirror names. A `proposal` marker SHALL land on Plan, `spec` on Specify, `design` on Design, `tasks` on Tasks, and `code` on Code. Change SHALL be the change directory and SHALL NOT take a thread. Phase movement SHALL stay on `sdd:layer=` threads.

#### Scenario: Phase movement stays on sdd:layer= threads

- **WHEN** phase movement is already visible on a thread whose marker is `sdd:layer=spec`, together with a focus comment
- **THEN** phase movement stays on `sdd:layer=` threads, and the `spec` marker lands on Specify

#### Scenario: Change takes no thread

- **WHEN** the change directory exists
- **THEN** no thread is planted on Change

### Requirement: The prose says what the phase produced

The prose SHALL say what this phase produced. When something is weak or must be looked at, the prose SHALL say that too. When the artifact still has open questions, the prose SHALL point at them by place and count and SHALL NOT restate them. A clean phase SHALL omit the weak-spot sentence. A phase with no open questions SHALL omit the pointer. There SHALL be no fixed heading the writer fills in. The prose SHALL be Russian, short, and have no headings. The prose SHALL contain no diff and SHALL NOT choose the next phase. The first paragraph SHALL answer that phase's question, because the spine row keeps the first sentence. A clean first visit SHALL be one paragraph. A further paragraph SHALL appear only for a refusal, open questions, a weak check, or a remark. There SHALL be no ledger and no fixed heading. The paragraph of a published proposal SHALL say what changes for the reader of the ticket and what was refused. On a published proposal the second paragraph SHALL appear only for open questions, and it SHALL give their place and count, not their text. A published delta spec SHALL say which promise is new and which existing promise changed, SHALL name the scenario without which the decision cannot be understood, and SHALL name a promise the issue asked for that the spec does not make. A published design SHALL say where the behavior lives and which alternative was rejected, what is deliberately not built, and where the behavior is observed. The slices of published tasks SHALL be in the order a person would notice them. A slice that waits on another SHALL be named. A code slice, or a code change that answers a review thread, SHALL say what became true after this commit, what the slice left untouched, and a check that does not prove it. The archive comment SHALL say what the person has now, what was left out on purpose, and how many capabilities and scenarios there are and whether tests cover them. A visit that fixes review threads of its own phase SHALL keep the previous comment of that phase. The first paragraph SHALL be the updated answer to the phase question. The next paragraph SHALL name the remarks in their own words and what changed because of them, including scenario names when scenarios appeared. A last paragraph SHALL appear only when something remains to look at, and it SHALL say what to look at.

#### Scenario: The prose says what this phase produced

- **WHEN** what this phase produced is already visible, together with a fixed heading
- **THEN** the prose says what this phase produced

#### Scenario: Something weak or that must be looked at is said too

- **WHEN** something weak or that must be looked at is already visible, together with a clean phase
- **THEN** the prose says that too

#### Scenario: Open questions are pointed at by place and count

- **WHEN** the artifact still has open questions and their place and count are already visible, together with the text of those questions
- **THEN** the prose points at them by place and count and does not restate them

#### Scenario: A clean phase omits the weak-spot sentence

- **WHEN** a clean phase is already visible, together with a weak-spot sentence
- **THEN** a clean phase omits the weak-spot sentence

#### Scenario: A phase with no open questions omits the pointer

- **WHEN** a phase with no open questions is already visible, together with a pointer by place and count
- **THEN** a phase with no open questions omits the pointer

#### Scenario: There is no fixed heading the writer fills in

- **WHEN** the focus prose is already visible, together with a fixed heading the writer fills in
- **THEN** there is no fixed heading the writer fills in

#### Scenario: The prose is Russian, short, and has no headings

- **WHEN** the prose is already Russian, short, and without headings, together with a heading as the limit that can replace that prose
- **THEN** the prose is Russian, short, and has no headings

#### Scenario: The prose contains no diff and does not choose the next phase

- **WHEN** the prose already contains no diff and does not choose the next phase, together with a diff and a choice of the next phase as the limit that can replace that prose
- **THEN** the prose contains no diff and does not choose the next phase

#### Scenario: The first paragraph answers that phase's question, because the spine row keeps the first sentence

- **WHEN** the first paragraph, that phase's question, the spine row, and the first sentence are already visible, together with a later sentence that answers the phase's question as the limit that can replace that first paragraph
- **THEN** the first paragraph answers that phase's question, because the spine row keeps the first sentence

#### Scenario: A clean first visit is one paragraph

- **WHEN** a clean first visit is already one paragraph, together with a further paragraph as the limit that can replace that one paragraph
- **THEN** a clean first visit is one paragraph

#### Scenario: A further paragraph appears only for a refusal, open questions, a weak check, or a remark

- **WHEN** a refusal, open questions, a weak check, and a remark are already visible, together with a clean first visit as the limit that can replace that further paragraph
- **THEN** a further paragraph appears only for a refusal, open questions, a weak check, or a remark

#### Scenario: The paragraph says what changes for the reader of the ticket and what was refused

- **WHEN** what changes for the reader of the ticket and what was refused are already visible, together with a diff as the limit that can replace that paragraph
- **THEN** the paragraph says what changes for the reader of the ticket and what was refused

#### Scenario: On a published proposal the second paragraph appears only for open questions, and it gives their place and count, not their text

- **WHEN** a published proposal, its open questions, their place, and their count are already visible, together with the text of those questions as the limit that can replace that place and count
- **THEN** on a published proposal the second paragraph appears only for open questions, and it gives their place and count, not their text

#### Scenario: A published delta spec says which promise is new and which existing promise changed, names the scenario without which the decision cannot be understood, and names a promise the issue asked for that the spec does not make

- **WHEN** a new promise, an existing promise that changed, the scenario without which the decision cannot be understood, and a promise the issue asked for that the spec does not make are already visible, together with a promise the spec does make as the limit that can replace that promise the spec does not make
- **THEN** a published delta spec says which promise is new and which existing promise changed, names the scenario without which the decision cannot be understood, and names a promise the issue asked for that the spec does not make

#### Scenario: A published design says where the behavior lives and which alternative was rejected, what is deliberately not built, and where the behavior is observed

- **WHEN** where the behavior lives, the rejected alternative, what is deliberately not built, and where the behavior is observed are already visible, together with the rejected alternative standing in for where the behavior lives as the limit that can replace that place
- **THEN** a published design says where the behavior lives and which alternative was rejected, what is deliberately not built, and where the behavior is observed

#### Scenario: The slices are in the order a person would notice them

- **WHEN** the slices are already in the order a person would notice them, together with another order as the limit that can replace that order
- **THEN** the slices are in the order a person would notice them

#### Scenario: A slice that waits on another is named

- **WHEN** a slice that waits on another is already visible, together with a slice that does not wait as the limit that can replace that waiting slice
- **THEN** a slice that waits on another is named

#### Scenario: A code slice or a code change that answers a review thread says what became true after this commit, what the slice left untouched, and a check that does not prove it

- **WHEN** what became true after this commit, what the slice left untouched, and a check that does not prove it are already visible, together with a check that proves it as the limit that can replace that check
- **THEN** the comment says what became true after this commit, what the slice left untouched, and a check that does not prove it

#### Scenario: The archive comment says what the person has now, what was left out on purpose, and how many capabilities and scenarios there are and whether tests cover them

- **WHEN** what the person has now, what was left out on purpose, how many capabilities and scenarios there are, and whether tests cover them are already visible, together with a capability left unnamed as the limit that can replace that count
- **THEN** the archive comment says what the person has now, what was left out on purpose, and how many capabilities and scenarios there are and whether tests cover them

#### Scenario: A visit that fixes review threads of its own phase keeps the previous comment of that phase

- **WHEN** a visit that fixes review threads of its own phase and the previous comment of that phase are already visible, together with a new focus comment of that phase as the limit that can replace the previous comment
- **THEN** the visit keeps the previous comment of that phase, and the previous comment of that phase stays

#### Scenario: The first paragraph is the updated answer to the phase question

- **WHEN** the first paragraph and the updated answer to the phase question are already visible, together with the previous answer as the limit that can replace that updated answer
- **THEN** the first paragraph is the updated answer to the phase question

#### Scenario: The next paragraph names the remarks in their own words and what changed because of them, including scenario names when scenarios appeared

- **WHEN** the remarks in their own words, what changed because of them, and the scenario names are already visible, together with a remark restated in other words as the limit that can replace those remarks
- **THEN** the next paragraph names the remarks in their own words and what changed because of them, including scenario names when scenarios appeared

#### Scenario: A last paragraph appears only when something remains to look at, and it says what to look at

- **WHEN** something that remains to look at and what to look at are already visible, together with a visit where nothing remains to look at as the limit that can replace that last paragraph
- **THEN** a last paragraph appears only when something remains to look at, and it says what to look at
