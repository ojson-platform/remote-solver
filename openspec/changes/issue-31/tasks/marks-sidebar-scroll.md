In the sidebar the chips sit under the title and stay in place while the body scrolls

## Source

Assume `marks-on-board` landed. `Sidebar` draws the mark list in `<header>`, under the title and outside `.side-scroll`, so the chips stay while the body scrolls.

Leave reason block and chip navigation to later slices.

## Proof

Test file: `src/window/board.test.ts`

Observes the open sidebar layout: chips under the title remain visible while the reason and body scroll.

May read `src/window/client/sidebar.tsx` and the board test harness.

Commands that must exit 0:

```
pnpm exec vitest --run --reporter=default src/window/board.test.ts
pnpm test
```

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
