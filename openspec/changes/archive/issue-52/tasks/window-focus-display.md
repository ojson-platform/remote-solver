The sidebar focus block shows the latest marker as a badge and the prose under it
The window does not rewrite the prose
The spine row of that phase keeps the first sentence of its own latest phase comment
A whole-pull-request comment belongs to the focus block and to no single row
A manager comment is not the focus block

## Source

Waits on `focus-post-comment`.

Seam: the window reads issue comments only; it does not recompute or rewrite focus prose.

Update `src/window/focus.ts`, `src/window/sidebar.ts`, and `src/window/spine.ts` so `focusBlockProse` returns body after the marker for every closed marker including `sdd:focus` and `sdd:focus:accept`, without dropping mirror-layer lines from prose. Sidebar shows the latest non-manager focus comment with marker badge and prose under it; asks and role outcomes stay out. Spine rows use `firstFocusSentence` from each phase's latest comment; whole-pull-request `sdd:focus` stays off spine rows; `applyPhaseSentences` does not apply Accept (Accept row caption unchanged). Keep legacy ledger-shaped bodies working where the delta still requires them. Touch `src/window/types.ts`, `src/window/client/frame.ts`, and `src/window/FACE.md` when badge or block layout changes.

Leave `postFocusComment`, `endStep`, and phase posting logic untouched in this slice.

## Proof

Test file: `src/window/sidebar.test.ts`

Observes sidebar focus block and related window behavior: latest marker and prose, no prose rewrite, manager skip, spine first sentence, whole-pull-request comment not on a single row.

May read `src/window/sidebar.test.ts`, `src/window/spine.test.ts`, `src/window/window.test.ts`, `src/window/focus.ts`, `src/window/sidebar.ts`, and `src/window/spine.ts`.

Commands that must exit 0:

```
pnpm exec vitest --run --reporter=default src/window/sidebar.test.ts
pnpm test
```

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
