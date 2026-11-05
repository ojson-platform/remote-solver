## Verification boundary

`focus`. Scenarios of when a visit writes a comment, which closed marker it uses, that the same text adds no second comment, that older comments stay, and that a run with no signal or no change file leaves the comment, are observed on the issue comment the focus verb posts: `src/machine/focus.test.ts` and `src/machine/marker.test.ts`. Scenarios of what that prose contains are observed on that same comment body. The words the writer follows live once in `skills/sdd-flow/CONTEXT.md` § Publish; a test of that section observes that each phase's paragraph rule is named there. Scenarios of the sidebar focus block, the prose left unrewritten, a manager comment, a whole-pull-request comment, and the spine's first sentence are observed on the window: `src/window/sidebar.test.ts`, `src/window/spine.test.ts`, and `src/window/window.test.ts`. The one-file command passes `--reporter=default` so that file can exit 0. The layer command keeps the coverage reporter.

one-file: `pnpm exec vitest --run --reporter=default <test-file>`
layer: `pnpm test`
fast suite: none
trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`
test path: `src/**/*.test.ts` or `src/**/*.test.tsx`
`pnpm run test:types`

## External contracts

none

## Technical prerequisites

none

## Approach

The seams are the ones `CONTEXT-MAP.md` already names. A phase skill writes the focus through the `focus` verb. The machine does not append a ledger. The window reads the comment and does not rewrite it. This change fills the prose those seams carry, and adds the archive marker. Recorded as ADR 0034.

The paragraph rules live once in `skills/sdd-flow/CONTEXT.md` § Publish. A step names that section and its marker. It does not restate the paragraphs. The body passed to `node scripts/sdd.mjs focus` is one marker line plus the prose. The closed markers are `sdd:focus:plan` for a published proposal, `sdd:focus:spec` for a published delta spec, `sdd:focus:design` for a published design, `sdd:focus:tasks` for published tasks, `sdd:focus:code` for a code slice or a code change that answers a review thread, `sdd:focus:accept` for the archive commit, and `sdd:focus` for the whole pull request. A pattern `sdd:focus:<phase>` is not a marker.

A visit writes the comment when it leaves something a person will read later. `sdd:auto-plan`, `sdd:auto-spec`, and `sdd:auto-design` do not skip that call. The archive step's Publish uses `sdd:focus:accept` on the archive commit every time, including when `sdd:auto-merge` is set. Unarchive is not that commit and writes no focus. A visit that fixes review threads of its own phase writes that phase's marker even when the diff is small: the new comment is another comment, and the previous comment of that phase stays. Its first paragraph is the updated answer. The next paragraph names the remarks in their own words and what changed because of them, including scenario names when scenarios appeared. A last paragraph appears only when something remains to look at. Verify, labeling threads, a rebase-only commit, and a publish that carries no phase artifact do not call `focus`. A separate review step does not write it. A run with no signal leaves the latest comment. No change directory, no comment.

The prose is Russian, short, and has no headings. It contains no diff and does not choose the next phase. The first paragraph answers that phase's question, because the spine keeps the first sentence. A clean first visit is one paragraph. A further paragraph appears only for a refusal, open questions, a weak check, or a remark. A published proposal says what changes for the reader of the ticket and what was refused; a second paragraph appears only for open questions and gives their place and count, not their text. A published delta spec says which promise is new and which existing promise changed, names the scenario without which the decision cannot be understood, and names a promise the issue asked for that the spec does not make. A published design says where the behavior lives and which alternative was rejected, what is deliberately not built, and where the behavior is observed. Published tasks name the slices in the order a person would notice them, and name a slice that waits on another. A code comment says what became true after this commit, what the slice left untouched, and a check that does not prove it. The archive comment says what the person has now, what was left out on purpose, and how many capabilities and scenarios there are and whether tests cover them. There is no ledger and no fixed heading.

`src/machine/marker.ts` adds `sdd:focus:accept` to `FOCUS_MARKER_LINES`. `focusMirrorName` maps it to `Accept`. `isFocusRecord` follows that closed list, so the archive comment is a focus record and a pattern still is not. A focus marker stays not a layer marker. `postFocusComment` in `src/machine/focus.ts` remains the only write: the tracker port, nothing when the change directory is absent, nothing when the canonical body matches the latest focus comment, and an append so older comments stay. `endStep` stays empty. An auto label is not a skip inside the verb.

The window shows the latest non-manager focus comment. `focusBlockProse` returns the body after the marker for every marker, including `sdd:focus`, and stops dropping lines whose first token is a mirror layer. The sidebar keeps that marker as the badge and that body under it. An ask and a role outcome stay out of the block. A whole-pull-request comment stays off every spine row. Plan, Specify, Design, Tasks, and Code keep `firstFocusSentence` of their own latest phase comment: the prose through the first `.`, `!`, or `?`, or the first line when none appears. `applyPhaseSentences` does not apply `Accept`, and `projectSpine` keeps the Accept row caption as the merge sentence it already writes. Readers that still recognize a whole-pull-request body made only of layer lines (`focusLayers`, `focusNamesPlace`, the ledger half of `focusSpineLines`) stay for that old shape. They do not parse the new prose into layer lines, gaps, or scenario links, and they do not rewrite the sidebar text.

After merge the procedure, the closed marker list, the verb, and the window display are the whole of this. Nothing is left for a person to paste.

Rejected: the machine filling a heading template or generating the prose from the diff. Rejected: `endStep` appending `Plan solid`, `thread N`, or `file:line`. Rejected: the window stripping mirror-layer lines or rebuilding a ledger from the prose. Rejected: editing the latest comment in place when a visit fixes threads. Rejected: skipping the comment because `sdd:auto-plan`, `sdd:auto-spec`, `sdd:auto-design`, or `sdd:auto-merge` is set. Rejected: a pattern in place of the closed markers. Rejected: putting the archive sentence into the Accept row caption. Rejected: posting through `gh` or `thread say`.

Deliberately not built: paging the comments. A live page while a worker runs, while a slot is full, while another issue holds the cycle, or while checks run. Linking a scenario name to its row. The Accept row caption. Screenshots and recordings.

## Open decisions

none
