The mark stays one filled path while the worker stays

The hammer is the chosen mark

The filled path is M2 4 H8 V8 H22 L26 12 L22 16 H8 V20 H2 Z M12 12 H16 V30 H12 Z

The hammer knocks about 45 degrees and repeats while the worker stays

## Source

Keep `HammerMark` in `src/window/client/marks.tsx` the chosen mark: one filled path, `d` `M2 4 H8 V8 H22 L26 12 L22 16 H8 V20 H2 Z M12 12 H16 V30 H12 Z`, `viewBox="0 0 32 32"`, ink `currentColor`, `transform-origin: 43.75% 93.75%` on the svg. Move the knock rule with the mark onto the plaque in `src/window/face.css`: about 45° around that origin, repeating (`hammer-knock`), not a spin. The duration stays a measure there. Today the rule is `.spine svg.hammer.mark`, and `.spine .mark` is a brass chip the hammer resets. The plaque is not inside `.spine`, so the knock rule follows the mark and keeps `background: none`. Record the mark on the plaque in `src/window/FACE.md` in the same session. Update the window glossary in `src/window/CONTEXT.md`: the hammer is that mark on the plaque, and it leaves when the worker leaves while the `impl` badge stays.

Assume `hammer-plaque` and `tasks-row-no-hammer` already landed. Leave running-set wiring, sidebar summary, and pool tile untouched.

## Proof

`src/window/face.test.ts` reads the rendered plaque markup (with the hammer mounted) and `src/window/face.css`: one filled path with the required `d`, blunt poll and wedge with handle through the middle, `transform-origin: 43.75% 93.75%` on the hammer `svg`, and a repeating swing of about 45° on the plaque selector (not a full turn).

- `pnpm exec vitest --run --reporter=default src/window/face.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
