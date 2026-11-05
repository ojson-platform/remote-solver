Chips wrap onto the next line and are not cut off

Within one kind the numbers follow key order

A light corner, down and then right, with no arrowhead, is a child and stands only on the parent

The child has no chip pointing back at the parent

A muted arrow to the left is an issue this one waits on

A brass arrow to the right is an issue this one holds

Children come first, then the issues it waits on, then the issues it holds

## Source

Assume `marks-on-board` landed. The chip row in `.ident` on `Ticket` wraps and the ticket grows with it; it is not a clamped line and it is not clipped.

Style the three kinds on the face stylesheet: the child mark is a corner of the edge, down and then right, with no arrowhead, and stands only on the parent; the wait mark is a muted arrow to the left; the hold mark is a brass arrow to the right. Record that look in `src/window/FACE.md` in the same session. Record `Child`, `Blocker`, and `Chip` in the window module glossary.

Leave sidebar scroll pinning, reason block, and chip open forms to later slices.

## Proof

Test file: `src/window/board.test.ts`

Observes rendered cards: wrap without clipping, key order within each kind, the three mark kinds and their order in the row, and no parent-pointing chip on the child card.

May read `src/window/client/board.tsx`, `src/window/face.css`, `src/window/FACE.md`, and `src/window/board.test.ts` fixtures.

Commands that must exit 0:

```
pnpm exec vitest --run --reporter=default src/window/board.test.ts
pnpm test
```

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
