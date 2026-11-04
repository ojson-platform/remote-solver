A drag that leaves selected text is not a click

The drag does not open the line's comment and does not close one that is already open

The field stays as it was

## Source

Add `dragLeavesSelection` beside `draftsAfterClick` in `src/window/client/gesture.ts`. It reads the document selection at click time: a non-collapsed selection with non-empty text whose endpoint lies inside the clicked line is a drag that left selected text. Re-export it from `src/window/page.ts` with `draftsAfterClick`.

In `src/window/client/main.tsx`, on `button.line` and `button.diff-row` clicks, call `dragLeavesSelection` before `draftsAfterClick`. When it is true, return before `draftsAfterClick` and before `draw` so drafts stay unchanged (closed stays closed, open empty stays open, field with text stays open) and the selection remains.

Leave `draftsAfterClick`, `line-field`, and `src/window/face.css` as landed in the face slice. Do not add a movement threshold, do not treat off-sidebar selection as a drag, and do not replace the button element.

Seams: gesture (`gesture.ts`) vs listener draw (`main.tsx`); `draftsAfterClick` keeps the click rule and is not edited in this slice.

## Proof

`src/window/client/gesture.test.ts` observes `dragLeavesSelection` and, through the page harness the window tests already use, that a drag with selection inside the clicked line does not toggle drafts or draw. Tests may read `src/window/client/gesture.test.ts`, `src/window/page.test.ts`, and helpers those files already import.

- `pnpm exec vitest --run --reporter=default src/window/client/gesture.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
