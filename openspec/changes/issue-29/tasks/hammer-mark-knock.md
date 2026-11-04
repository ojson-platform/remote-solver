The hammer is the chosen mark

The filled path is M2 4 H8 V8 H22 L26 12 L22 16 H8 V20 H2 Z M12 12 H16 V30 H12 Z

The hammer knocks about 45 degrees and repeats while the issue stays in the running set

## Source

On the impl task summary, draw one filled hammer: a single `<path>` with `d="M2 4 H8 V8 H22 L26 12 L22 16 H8 V20 H2 Z M12 12 H16 V30 H12 Z"`, filled with `currentColor`, on an `svg` with `viewBox="0 0 32 32"`. Put `transform-origin: 43.75% 93.75%` on that `svg` (handle bottom). Default fill rule; no second path, stroke, or `evenodd`. Swing the `svg` about 45° around that origin and repeat; do not spin. Duration lives in `src/window/face.css`. Record the mark, origin, and knock in `src/window/FACE.md` in the same session.

Assume the running-set task already mounts the hammer only while the issue stays in the running set. Leave running-set wiring, spine, plaque, and pool tile untouched.

## Proof

`src/window/face.test.ts` reads the rendered task summary (with the hammer mounted) and `src/window/face.css`: one filled path with the required `d`, blunt poll and wedge with handle through the middle, `transform-origin: 43.75% 93.75%` on the hammer `svg`, and a repeating swing of about 45° (not a full turn).

- `pnpm exec vitest --run --reporter=default src/window/face.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
