## Problem

The skill writes a focus comment when a visit leaves something a person will read later. The spine row keeps the first sentence, so that paragraph has to answer the phase's question. The prose is Russian, short, and has no headings. It contains no diff and does not choose the next phase.

## Outcome

A published proposal uses `sdd:focus:plan`. The paragraph says what changes for the reader of the ticket and what was refused. A second paragraph appears only for open questions, and it gives their place and count, not their text.

A published delta spec uses `sdd:focus:spec`. It says which promise is new and which existing promise changed, names the scenario without which the decision cannot be understood, and names a promise the issue asked for that the spec does not make.

A published design uses `sdd:focus:design`. It says where the behavior lives and which alternative was rejected, what is deliberately not built, and where the behavior is observed.

Published tasks use `sdd:focus:tasks`. The slices are in the order a person would notice them. A slice that waits on another is named.

A code slice, or a code change that answers a review thread, uses `sdd:focus:code`. It says what became true after this commit, what the slice left untouched, and a check that does not prove it.

The archive commit uses `sdd:focus:accept`. It says what the person has now, what was left out on purpose, and how many capabilities and scenarios there are and whether tests cover them. The archive writes this comment every time, including when `sdd:auto-merge` is set.

`sdd:auto-plan`, `sdd:auto-spec`, and `sdd:auto-design` do not skip the comment. The document was published.

A visit that fixes review threads of its own phase writes that phase's marker even when the diff is small. The first paragraph is the updated answer to the phase question. The next paragraph names the remarks in their own words and what changed because of them, including scenario names when scenarios appeared. A last paragraph appears only when something remains to look at, and it says what to look at. The previous comment of that phase stays.

A clean first visit is one paragraph. A further paragraph appears only for a refusal, open questions, a weak check, or a remark.

Verify, labeling threads, a rebase-only commit, and a publish that carries no phase artifact write no focus comment. The same text does not add another comment. Older comments remain. There is no ledger and no fixed heading. A separate review step does not write the focus. The window does not rewrite the prose.

## Scope

The focus comment a person reads when a visit leaves something to read later: a published proposal, delta spec, design, and tasks; a code slice or a code change that answers a review thread; a visit that fixes review threads of its own phase; and the archive commit. The comment is written when `sdd:auto-plan`, `sdd:auto-spec`, or `sdd:auto-design` is set, and the archive writes it every time, including when `sdd:auto-merge` is set.

## Out of scope

Paging the comments. A live page while a worker runs, while a slot is full, while another issue holds the cycle, or while checks run. Linking a scenario name to its row. The Accept row caption. Screenshots and recordings.

## Constraints

The prose is Russian, short, and has no headings. It contains no diff and does not choose the next phase. The first paragraph answers that phase's question, because the spine row keeps the first sentence.

A clean first visit is one paragraph. A further paragraph appears only for a refusal, open questions, a weak check, or a remark. On a published proposal the second paragraph appears only for open questions, and it gives their place and count, not their text.

A visit that fixes review threads of its own phase keeps the previous comment of that phase. The next paragraph names the remarks in their own words and what changed because of them, including scenario names when scenarios appeared. A last paragraph appears only when something remains to look at, and it says what to look at.

The same text does not add another comment. Older comments remain. There is no ledger and no fixed heading. A separate review step does not write the focus. The window does not rewrite the prose.

Verify, labeling threads, a rebase-only commit, and a publish that carries no phase artifact write no focus comment.

## Capabilities

### Added

### Modified

- `focus` the prose a person reads answers that phase's question in the first paragraph, and a visit writes it only when it leaves something to read

## Open questions

none
