## Verification boundary

`focus`. Scenarios of the comment are observed on the issue comment after that phase's artifact is published. Scenarios of the sidebar focus block and of the spine row are observed in the window.

`pnpm test -- <test-file>`
`pnpm test`
none
`pnpm run test:types`

## External contracts

none

## Technical prerequisites

none

## Approach

The skill of the phase writes one focus comment when Publish commits that phase's artifact. The first line is the marker. The rest is prose. `proposal.md` uses `sdd:focus:plan`, a spec uses `sdd:focus:spec`, `design.md` uses `sdd:focus:design`, the task files use `sdd:focus:tasks`, and code uses `sdd:focus:code`. Those names land on the mirror: Plan, Specify, Design, Tasks, Code. A comment about the whole pull request uses `sdd:focus` and belongs to the focus block only. Change takes no focus marker and no thread. A publish that commits none of those artifacts writes no comment. Wait, Hand-off, and a run with no signal leave the latest comment as it is. No change directory, no comment.

The prose says what this phase produced. Something weak, or something that must be looked at, is said in the same prose; a clean phase omits that sentence. Open questions still unchecked are named by place and count, not restated; a phase with none omits the pointer. There is no fixed heading, no coverage count, no diff text, and the prose does not choose the next phase. The same canonical text as the latest focus comment does not add another comment. Older focus comments stay.

The write is a verb, `node scripts/sdd.mjs focus <issue> '<body>'`, called from § Publish after the push. The body is the marker line plus the prose. The verb posts through the tracker port. A focus comment is one whose first line, without the spy mark, is one of those six markers, so the adapter leaves that line as written. The verb posts nothing when the change directory is absent, and nothing when the canonical body equals the latest focus comment. `endStep` still observes the signal and no longer renders `Plan solid`, `thread N`, or `file:line` into an issue comment. Phase movement stays on `sdd:layer=` threads. A focus marker is not a layer marker.

The window takes the latest of those comments and skips a manager comment, an ask, and a role outcome. The sidebar focus block shows that marker as a badge and the prose under it, unchanged. The drawer draws this block. Each spine row shows the first sentence of the latest comment with that phase's marker: the prose through the first `.`, `!`, or `?`, or the first line when none of those appears. A row with no phase comment keeps the sentence from the issue mirror. A `sdd:focus` comment is not applied to a row. A body is a ledger only when the marker is `sdd:focus` and every remaining line names a mirror layer; only that shape still feeds the board's gap line, so a new prose comment does not become one. The window does not rebuild a ledger from prose or from files.

After merge the verb, the Publish section, the marker check, `endStep`, and the window are the whole of this. Nothing is left for a person to paste.

Rejected: `endStep` appending the ledger beside the prose, because the person would still read the ledger. A heading template the machine fills, because there is no fixed heading. Parsing the prose back into layer lines, because the window does not recompute it and a whole-pull-request comment belongs to no row. Editing the latest comment in place, because older comments stay. Posting through `gh` or `thread say`, because the comment is on the issue and a skill reaches the tracker only through an sdd verb.

## Open decisions

none
