## Verification boundary

`written-focus-page`. Scenarios are observed on the sidebar the page draws. Opening, the place under the title, the chips in the header, and one full page are the rendered sidebar in `src/window/board.test.ts`. The written pages, the badge, the prose, a manager comment, a missing comment, and another ticket are `src/window/sidebar.test.ts`. Back, Forward, a ticket switch, and a new comment returning to now are the page choice in that same file. Each spine row's first sentence is `src/window/spine.test.ts`. The one-file command passes `--reporter=default` so that file can exit 0. The layer command keeps the coverage reporter.

one-file: `pnpm exec vitest --run --reporter=default <test-file>`
layer: `pnpm test`

`accept-caption`. Scenarios are observed on the Accept row. The caption once the spine is read, including a phase focus that leaves it, is `src/window/spine.test.ts`. The person sentence before the spine is read is `src/window/live-frame.test.ts`. The paragraph under an auto-merge caption is the rendered Accept row in `src/window/spine.test.ts`.

one-file: `pnpm exec vitest --run --reporter=default <test-file>`
layer: `pnpm test`

`scenario-name-link`. Scenarios are observed on the focus prose in the rendered sidebar in `src/window/board.test.ts`. A name that matches a spec row is a jump to that row, including a row inside a fold. A name that matches no row stays text. The row the jump aims at is `scenarioTarget` in `src/window/client/gesture.ts`.

one-file: `pnpm exec vitest --run --reporter=default <test-file>`
layer: `pnpm test`

fast suite: none
`pnpm run test:types`
trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`
test path: `src/**/*.test.ts` or `src/**/*.test.tsx`

## External contracts

none

## Technical prerequisites

none

## Approach

The window already has the seams this change uses. The machine keeps the marker grammar. The window reads the comments and does not recompute the prose. Adapters, the reviewer, and the posting visits stay as they are.

`FOCUS_MARKER_LINES` in `src/machine/marker.ts` gains `sdd:focus:accept`. `focusMirrorName` maps it to `Accept` and maps `sdd:focus` to none. `parseMarker` stays null for a focus marker. `isFocusRecord` then treats the accept comment as a focus record, so the ask skips it and the latest-focus walk includes it. `src/sdd.ts` names the same list when it refuses an unrecognized first line. No visit starts writing the comment.

`writtenFocusPages` in `src/window/focus.ts` walks the ticket comments in tracker order, skips a manager comment and a comment that is not a focus record, and returns the rest newest first. Each page is the marker and the body after it. `focusBlockProse` stays the prose: a `sdd:focus` page drops a line whose first word is Change, Plan, Specify, Design, Tasks, or Code; a phase page and an accept page keep the body as written. `blocksFor` in `src/window/sidebar.ts` emits every page as a `kind: 'focus'` block, newest first. Reason, ask, unanswered review, and hook stay their own blocks.

The pager is the first child of `.side-scroll` in `src/window/client/sidebar.tsx`, directly under the header. The pool description, the reason, and the ask follow it. Role verbs stay between those blocks and the spine. Chips stay `LinkMarks` in the header. The header does not scroll. The pager shows one page: the badge is that comment's marker, and the prose under it is the full prose. It does not stack the other pages.

The open page is client memory in `src/window/client/main.tsx`, beside the open layer. Index 0 is now. `WindowView` passes no index, so the served page and the first paint are now. Back and Forward are hairline pills on the focus block, labeled «назад» and «вперёд», with `data-focus="back"` and `data-focus="forward"`. The click listener adjusts the index and redraws. It does not post. Back is absent on the oldest page. Forward is absent on now. A single page shows no pills. The index returns to 0 when the open ticket changes, and when the newest written comment's body changes. An index past the end clamps to the last page.

`scanFocusComments` keeps writing the first sentence of the latest phase focus onto Plan, Specify, Design, Tasks, and Code. `applyPhaseSentences` still drops a layer that is not one of those. A `sdd:focus` comment stays off every row. The open page does not replace a row's sentence. `FACE.md` records the pager as the first scrolling row, the two hairline pills, and the chips in the header, in the session that draws them. Measures stay in `face.css`.

The Accept caption is chosen in `projectSpine`. The latest non-manager `sdd:focus:accept` comment supplies it: `firstFocusSentence` of that body. The open page does not supply it. Until that comment exists, or the prose has no sentence, the caption stays the auto-merge sentence already chosen from `gateOff`: «На приёмке машина мержит сама.» when the issue carries `sdd:auto-merge`, and «На приёмке мерж ждёт человека.» when it does not. A focus comment whose first line is not `sdd:focus:accept` does not replace it. The shell in `src/window/client/frame.ts` keeps «На приёмке мерж ждёт человека.» before the spine is read. When the Accept row is open and the caption is exactly one of those two sentences, the paragraph stays the one the row shows today. Any other caption leaves that paragraph out.

A scenario name in the prose is the text after `#### Scenario: ` on a spec row of the open ticket, including a row inside a fold. The client links each occurrence in the prose, longest name first, without overlap. The first capability in spine order whose rows contain that name owns the link. The control is `button.jump` with that `data-cap` and the name as its text, so `onJump` opens Specify, the capability, a closed fold, and scrolls the `[data-scenario]` row. A name that matches no row stays text. The badge is not linked.

After merge the pager, the caption, and the links are that sidebar. No flag and no follow-up step.

Rejected: one latest comment and no older page. Rejected: every written comment stacked in the block. Rejected: chips inside the scrolling pager. Rejected: the focus block below the reason and the ask. Rejected: the reason, the ask, the review, or the hook as a page. Rejected: a server round-trip for Back or Forward. Rejected: the open page as the Accept caption. Rejected: a phase focus comment as the Accept caption. Rejected: an accept comment as a Plan, Specify, Design, Tasks, or Code sentence. Rejected: linking a word that is not a scenario row.

## Open decisions

none
