A sidebar line can be selected and copied

## Source

Set `user-select: text` on `.spine button.line` and `.spine button.diff-row` in `src/window/face.css` so plan, design, spec, and diff lines allow browser selection and copy. Leave `src/window/FACE.md`, `src/window/client/gesture.ts`, and `src/window/client/main.tsx` untouched. The click listener already matches both button kinds; do not cancel `mousedown` in this slice.

Seams: the face stylesheet; plan and design lines are `button.line` in `DocumentLines` (`src/window/client/sidebar.tsx`); spec and diff lines are `button.diff-row` in `DiffRow`; the listener seam in `main.tsx` is unchanged here.

## Proof

`src/window/face.test.ts` observes the inlined face stylesheet: `.spine button.line` and `.spine button.diff-row` allow text selection. The test may read `src/window/face.test.ts`, `src/window/face.ts`, and rendered markup paths existing face tests use.

- `pnpm exec vitest --run --reporter=default src/window/face.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
