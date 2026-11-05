The sidebar shows each review thread of the open pull request on the line it anchors

A thread that is already on the pull request is visible this way

## Source

Assume `thread-record` landed. In `src/window/live.ts`, `reviewOf` copies path, line, and comment bodies onto the window review for threads the port returns. In `src/window/client/sidebar.tsx` (and helpers it already uses), show a thread whose path and line match a drawn plan, design, spec, or task line under that line, including a comment GitHub had that the sidebar did not show before the port fix. Leave phase placement without a line, stacking several comments on one line, and `sdd:fixed` status rendering to later slices. Leave the draft field, send control, unanswered block, and link marks from #31 untouched. Record posted-comment face rules on `src/window/FACE.md` when this slice adds the quiet card.

Seam: the review port has the thread; the window places it on drawn lines with `data-path` / `data-at` and spec `anchor.path` / `anchor.line`.

## Proof

Test file: `src/window/thread-line.test.ts`

Observes the rendered sidebar: each review thread of the open pull request on the line it anchors, including the hidden original comment, and a thread already on the pull request stays visible this way.

May read `src/window/thread-line.test.ts`, `src/window/client/sidebar.tsx`, `src/window/live.ts`, and page harness helpers existing window tests use.

Commands that must exit 0:

```
pnpm exec vitest --run --reporter=default src/window/thread-line.test.ts
pnpm test
```

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
