The reason block no longer names children or blockers

Open questions, Ask, and the merge stay in that block

## Source

Assume `machine-link-waits` landed. `reasonParts` drops `дети` and `блокеры`. Open questions, Ask, and the merge stay, and so do the other parts that the spec does not remove. The decision reason that names a child or a blocker stays on the settlement and is not copied back into the reason block.

Edit `src/window/` reason assembly on the board page the test already draws.

Leave chip navigation untouched.

## Proof

Test file: `src/window/board.test.ts`

Observes the reason block on that page: no children or blockers lines, while Open questions, Ask, and the merge remain.

May read window reason helpers and sidebar/block builders the test uses.

Commands that must exit 0:

```
pnpm exec vitest --run --reporter=default src/window/board.test.ts
pnpm test
```

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
