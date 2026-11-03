A cycle is finished when its pull request is merged and its change is archived
The issue closes and the board's open list no longer has it

## Source

`src/machine/flow.ts`: when settlement stops on `done` with reason `finished cycle`, close the issue through the tracker port with comment `SDLC finished: the pull request is merged and the change is archived.` Do not reuse the accepted close path or comment. Leave label writes from `settle` as they are.

Assume `finish-settlement` already returns `finished cycle` from `decide`. Leave `src/window/live.ts` and `src/window/board.ts` to the board slice.

## Proof

`src/machine/flow.test.ts` observes `applySettlement` / `resolveCycle` closing the issue when the decision reason is `finished cycle`, and the tracker open list omitting that key afterward.

Commands that must exit 0:

```
pnpm test -- src/machine/flow.test.ts
pnpm test
pnpm run test:types
```
