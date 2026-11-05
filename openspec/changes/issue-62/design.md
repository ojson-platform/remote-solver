## Verification boundary

`focus-pager`. Scenarios are observed on the focus block the sidebar draws. The control in the form `< 11/12 >`, the count from the oldest page, a chevron that stays and goes quiet, a single written focus with the control left out, the row then being the badge and the prose, Back, Forward, and the badge and the prose staying as they are are the rendered `FocusBlocks` in `src/window/sidebar.test.ts`. Opening on the latest page, the control in the right part of the focus row inside `.side-scroll`, and the header and the drawer rim without that control are the rendered sidebar in `src/window/board.test.ts`. The one-file command passes `--reporter=default` so that file can exit 0. The layer command keeps the coverage reporter.

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

The window already has the seams this change uses. Which comment is a page stays `writtenFocusPages` in `src/window/focus.ts`: tracker order, then reversed, so index 0 is the latest page. The badge and the prose stay `FocusBlocks` as they are, and `focusBlockProse` still does not rewrite the comment. Adapters, the machine, the spine, and the scenario links stay as they are.

The drawn control is the seam in `FocusBlocks` in `src/window/client/sidebar.tsx`. When more than one written page is open, the focus row is one line inside `.focus-block`: the badge on the left, `.focus-pager` on the right. The prose stays under that line. The visible text of the control is the form `< 11/12 >`: a back chevron `<`, the current page, `/`, the count, and a forward chevron `>`. The current page is `pageCount - index` and the count is `pageCount`, so the latest page reads `12/12` and the oldest reads `1/12`. Both chevrons stay in the control. A chevron that cannot move is `disabled` and quiet. On the latest page that is Forward. On the oldest page that is Back. On a middle page both move. The buttons keep `data-focus="back"` and `data-focus="forward"`.

A single written page renders no `.focus-pager`. The block is then the badge and the prose.

The walk stays client memory in `src/window/client/main.tsx`. Back still increments the index. Forward still decrements it. Opening still passes no index, so the first paint is the latest page. A quiet chevron does not fire the click. The listener's existing bounds stay the backstop. The click does not post.

`.focus-block` stays the first child of `.side-scroll`, so the row scrolls with the block. The sidebar header does not hold the control. The drawer rim does not hold it.

`FACE.md` records this look in the session that draws it: one control on the badge's row, at the right, chevrons and the count, a quiet chevron muted and not an action, the words «назад» and «вперёд» gone. Measures stay in `face.css`. No new colour.

After merge the control is that row. No flag and no follow-up step.

Rejected: the words «назад» and «вперёд», and hiding the word that cannot be used. Rejected: a count from the newest page, so the latest page would read `1/12`. Rejected: removing a chevron that cannot move, which lets the number jump. Rejected: the control on a single written page. Rejected: pinning the control in the header. Rejected: a solid on the right rim. The throwaway comparison is `src/window/focus-pager.prototype.html`; the row is the chosen placement. Rejected: a server round-trip for Back or Forward. Rejected: replacing the badge or the prose with the control. Rejected: changing which comment is a page.

## Open decisions

none
