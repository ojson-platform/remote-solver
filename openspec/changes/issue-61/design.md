## Verification boundary

`link-arrow`. Scenarios are observed on the chip under the title. A column card and a pool card are the rendered ticket in `src/window/board.test.ts`. The sidebar chip is the header on that same page. The shaft, the head, the muted left wait, the brass right hold, and the child corner are the mark rules in `src/window/face.css`, read from that test. The play control is `.round.play` and the `play` glyph in `src/window/client/marks.tsx`, observed so the chip mark is not that control. `package.json` runs `vitest --run` as `pnpm test`. CI runs that script as `pnpm test` and the type check as `pnpm run test:types`. The one-file command passes `--reporter=default` so that file can exit 0. The layer command keeps the coverage reporter from `vitest.config.mjs`.

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

The seams are the ones `CONTEXT-MAP.md` already names. The window draws the face. `linkMarks` in `src/window/board.ts` derives the child, the wait, and the hold from the cards on the board. ADR 0033 stays: the tracker port is the only seam for parent, blocks, blocked-by, and depends-on, and this change does not read a body line. `LinkMarks` in `src/window/client/board.tsx` is the chip under the title on a column card and a pool card. The sidebar header uses that same component. The mark's shape is `src/window/face.css`. Colour roles and the control's words stay on `FACE.md` and in the window glossary. The play control is `Glyph` name `play` on `.round.play` and is another control.

`::before` on `.link-mark[data-kind="wait"]` stays the head: a triangle pointing left, `border-right` in `var(--muted)`. `::before` on `.link-mark[data-kind="hold"]` stays the head pointing right, `border-left` in `var(--brass)`. `::after` is the shaft, a bar of the same colour, on the tail side of that head. The mark is that pair. A `::before` of `width: 0` and `height: 0` with no shaft is the naked triangle and is not the mark. The chip does not use the play path.

The child `::before` stays `border-left` and `border-bottom`, light, with no head and no shaft. `linkMarks` still emits `child` only for a parent card.

`FACE.md` records the shaft and the head on the link chip in the session that draws them. The measures stay in `face.css`. The Blocker line in `src/window/CONTEXT.md` names the shaft and the head. Chip order, wrapping, and the key stay the rules `link-mark` already has.

`spec('link-mark')` in `src/window/board.test.ts` keeps matching the head's direction and colour, the child corner, the wrap, and the order. `spec('link-arrow')` in that file observes the shaft, that a naked triangle is not the mark, and that `.round.play` is still the play control, on a column card, a pool card, and the sidebar header.

After merge the drawn arrow is the mark. No flag and no follow-up step.

Rejected: the play glyph as the chip mark. Rejected: a naked border triangle with no shaft. Rejected: a bar with no head. Rejected: a separate shape for the pool card or the sidebar. Rejected: an arrowhead on the child. Rejected: changing `linkMarks`, the chip order, the wrap, or the key.

Deliberately not built: the play control. The child corner. Chip order, wrapping, and the key.

## Open decisions

none
