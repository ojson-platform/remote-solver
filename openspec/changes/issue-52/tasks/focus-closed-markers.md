The first line is the marker sdd:focus:plan, sdd:focus:spec, sdd:focus:design, sdd:focus:tasks, sdd:focus:code, sdd:focus:accept, or sdd:focus

## Source

Seams of this change: skill → tracker through the `focus` verb; window → focus comment display. Neither seam gets its own child issue. External contracts: none.

Add `sdd:focus:accept` to `FOCUS_MARKER_LINES` in `src/machine/marker.ts`. Map it with `focusMirrorName` to `Accept`. Keep `isFocusRecord` on the closed marker list so a pattern `sdd:focus:<phase>` is not a focus record and a focus marker is not a layer marker.

Leave `postFocusComment` in `src/machine/focus.ts`, window modules, and phase skills untouched in this slice.

## Proof

Test file: `src/machine/marker.test.ts`

Observes closed focus markers including `sdd:focus:accept`, mirror naming, and that a pattern in place of those markers is not treated as a focus record.

May read `src/machine/marker.test.ts`, `src/machine/marker.ts`, and existing marker harness patterns.

Commands that must exit 0:

```
pnpm exec vitest --run --reporter=default src/machine/marker.test.ts
pnpm test
```

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
