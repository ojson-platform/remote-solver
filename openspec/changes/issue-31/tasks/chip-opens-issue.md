Clicking a chip opens that issue the way clicking its card does

Hovering the chip shows that issue's title

The click does not open the card the chip stands on

## Source

Assume `marks-on-board` landed. Each chip is its own `open` form. The hidden key is the issue the chip names. The form is not inside the form that opens the card it stands on. Hovering sets that issue's title.

Apply the same chip markup on `Ticket` and `Sidebar`.

## Proof

Test file: `src/window/board.test.ts`

Observes chip click opens the named issue like its card, hover shows that issue's title, and the click does not open the card the chip stands on.

May read `src/window/client/board.tsx`, `src/window/client/sidebar.tsx`, and the board test harness.

Commands that must exit 0:

```
pnpm exec vitest --run --reporter=default src/window/board.test.ts
pnpm test
```

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
