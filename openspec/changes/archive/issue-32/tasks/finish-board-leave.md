A finished cycle leaves the board and a reload does not bring it back
A finished cycle on verifying leaves the board and a reload does not bring it back

## Source

`src/window/board.ts` and `src/window/live.ts`: no production edits unless a reload bug appears; the card leaves because the tracker close from `finish-close` drops the issue from `listOpen()`. Do not add board-side hiding.

## Proof

`src/window/board.test.ts` observes the manager board after settlement closes a finished cycle on `tasking` and on `verifying`: the card is absent, a second open-list read still omits it, and the machine does not unarchive or start a step.

Commands that must exit 0:

```
pnpm test -- src/window/board.test.ts
pnpm test
pnpm run test:types
```
