A shown card clears the fade by the board's computed padding-top

That lead stays tied to the padding when the padding changes

There is no second offset

## Source

Keep the card reveal lead on the board's computed `padding-top` only. Edit `src/window/client/main.tsx` only if needed to preserve that single lead; do not add a second offset. Extend `src/window/board.test.ts` under `phase-header` so these scenarios are observed on the rendered window page that serves the client show path: a shown card clears the fade using `getComputedStyle(board).paddingTop` and no other offset.

Seams: the show path in `src/window/client/main.tsx`; the board scrollport padding from `src/window/face.css` (`padding-top: 28px` after `board-fade-padding`).

Leave `src/window/face.css`, `src/window/FACE.md`, `openspec/specs/phase-header/spec.md`, and `src/window/client/board.tsx` untouched unless a test harness gap requires a read-only import.

## Proof

Test file: `src/window/board.test.ts`

Observes the rendered window page and the client show path the page serves: scroll reveal for a shown card uses the board's computed `padding-top` and no second offset.

May read: `src/window/board.test.ts`, the page harness helpers it already imports, rendered HTML and the inlined client script from the same paths existing board page tests use, and `src/window/client/main.tsx` as served on the page.

Commands that must exit 0:

- `pnpm exec vitest --run --reporter=default src/window/board.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.

`pnpm run test:types`
