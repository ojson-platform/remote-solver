A click that leaves no selection still opens an empty field, still closes an empty field, and still leaves a field that holds text open

## Source

After the drag slice, prove the click path is unchanged. A collapsed selection, an empty selection, or a selection that does not meet the clicked line still runs `draftsAfterClick` in `src/window/client/gesture.ts` and the listener still draws. Do not edit `draftsAfterClick` or `src/window/client/line-field.ts`. Adjust `src/window/client/main.tsx` only if the drag guard must stay narrow so clicks without a line selection still fall through.

Seams: `draftsAfterClick` owns the click rule; `line-field` stays out of scope; comment clicks on `form.line-note` stay out of scope.

## Proof

`src/window/client/gesture.test.ts` observes `draftsAfterClick` and the listener path for clicks that leave no line selection: empty field opens, empty field closes, field with text stays open. Tests may read `src/window/client/gesture.test.ts`, `src/window/page.test.ts`, and helpers those files already import.

- `pnpm exec vitest --run --reporter=default src/window/client/gesture.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
