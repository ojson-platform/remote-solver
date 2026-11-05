The mark for an issue this one waits on, and the mark for an issue this one holds, are arrows with a shaft and a head

A naked triangle is not the mark, so neither reads as the play control

The wait stays a muted arrow to the left

The hold stays a brass arrow to the right

The child stays a light corner, down and then right, with no arrowhead, and it still stands only on the parent

Both stand on the chip under the title, on a column card, a pool card, and in the sidebar

## Source

Draw the wait and hold as a head (`::before`) plus a shaft (`::after`) on `.link-mark[data-kind="wait"]` and `.link-mark[data-kind="hold"]` in `src/window/face.css`. A `::before` with `width: 0`, `height: 0`, and no shaft is the naked triangle and is not the mark. The child `::before` stays a light corner with no head and no shaft.

Update `src/window/FACE.md` in the same session to record the shaft and the head on the link chip. Update the Blocker line in `src/window/CONTEXT.md` to name the shaft and the head.

Extend `src/window/board.test.ts`: keep `spec('link-mark')` matching head direction, colour, child corner, wrap, and order; add or extend `spec('link-arrow')` for the shaft, that a naked triangle is not the mark, that `.round.play` remains the play control, and observations on a column card, a pool card, and the sidebar header chip.

Leave untouched: `linkMarks` in `src/window/board.ts`, chip order, wrapping, and the key in `src/window/client/board.tsx`, the play control (`Glyph` `play` on `.round.play` in `src/window/client/marks.tsx`), and the tracker port seam.

The implementer may edit:

- `src/window/face.css`
- `src/window/FACE.md`
- `src/window/CONTEXT.md`
- `src/window/board.test.ts`

## Proof

Test file: `src/window/board.test.ts`

The test observes link marks on the chip under the title in the rendered board fixture: shaft and head on wait and hold, muted left wait and brass right hold, child corner on the parent only, separation from the play control, and the same chip on a column card, a pool card, and the sidebar header. It may read only files the suite already loads for those observations.

Commands:

- On each attempt while the scenario tests are red, and again after each edit to this task’s source or test: `pnpm exec vitest --run --reporter=default src/window/board.test.ts`
- Once that one-file command exits 0 for every scenario in this task, run once: `pnpm test`, then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`
