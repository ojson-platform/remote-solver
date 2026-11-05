The focus block pages the written focus comments

The badge is the comment's marker

sdd:focus:accept is one of these pages

A manager comment is not the block

A whole-pull-request comment leaves phase lines out of the prose

A phase comment keeps the prose after the marker

An accept comment keeps the prose after the marker

No focus comment leaves no block

Another ticket shows its own latest focus

## Source

Add `sdd:focus:accept` to `FOCUS_MARKER_LINES` in `src/machine/marker.ts`. Map it to `Accept` in `focusMirrorName` and map `sdd:focus` to none. Keep `parseMarker` null for focus markers. Extend `isFocusRecord` so an accept comment is a focus record: the ask skips it and the latest-focus walk includes it. Mirror the marker list in `src/sdd.ts` where unrecognized first lines are refused. No visit starts writing the comment.

Implement `writtenFocusPages` in `src/window/focus.ts`: walk ticket comments in tracker order, skip manager comments and non-focus records, return the rest newest first. Each page is the marker and the body after it. Keep `focusBlockProse` as today: a `sdd:focus` page drops a line whose first word is Change, Plan, Specify, Design, Tasks, or Code; phase and accept pages keep the body as written.

In `blocksFor`, emit every written page as a `kind: 'focus'` block, newest first. The pager renders one page; it does not stack the other pages.

Leave Back and Forward, client index resets, spine phase sentences, Accept caption, and scenario-name links to later tasks.

## Proof

`src/window/sidebar.test.ts` observes the written focus pages, the badge, the prose, a manager comment, a missing comment, and another ticket's latest focus.

- `pnpm exec vitest --run --reporter=default src/window/sidebar.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
