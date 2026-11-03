## Problem

The machine appends the layer ledger (`Plan solid`, `thread N`, `file:line`) as the comment a person reads.

## Outcome

A focus comment is prose for one phase, or for the whole pull request. The first line is the marker: `sdd:focus:plan`, `sdd:focus:spec`, `sdd:focus:design`, `sdd:focus:tasks`, `sdd:focus:code`, or `sdd:focus` for the whole pull request. The sidebar focus block shows the latest of these, with that marker as a badge, and the prose under it.

The prose says what this phase produced. When something is weak or must be looked at, it says that too. When the artifact still has open questions, the prose points at them by place and count and does not restate them. A clean phase omits the weak-spot sentence. A phase with no open questions omits the pointer. There is no fixed heading the writer fills in.

The skill of the phase writes this comment when the phase's artifact is published. The machine no longer appends the layer ledger (`Plan solid`, `thread N`, `file:line`) as the comment a person reads. Phase movement stays on `sdd:layer=` threads. Older focus comments remain. The same text does not add another comment.

The spine row of that phase keeps the first sentence of its own latest phase comment. A whole-pull-request comment belongs to the focus block and to no single row.

## Scope

A focus comment for one phase, or for the whole pull request. The sidebar focus block shows the latest of these, with that marker as a badge, and the prose under it. The spine row of that phase keeps the first sentence of its own latest phase comment. The skill of the phase writes this comment when the phase's artifact is published.

## Out of scope

Pasting open questions into the comment. A coverage count. Diff text. Choosing the next phase from this prose.

## Constraints

There is no fixed heading the writer fills in. Phase movement stays on `sdd:layer=` threads. Older focus comments remain. The same text does not add another comment. When the artifact still has open questions, the prose points at them by place and count and does not restate them.

## Capabilities

### Added

### Modified

- `focus` prose for one phase, or for the whole pull request

## Open questions
