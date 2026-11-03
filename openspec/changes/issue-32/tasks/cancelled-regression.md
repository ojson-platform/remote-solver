A cancelled cycle still leaves as it does now

## Source

Leave `src/machine/policy.ts` and `src/machine/flow.ts` behaviour for `sdd:cancelled` unchanged. This slice only guards the cancelled path against the new finished-cycle branch.

## Proof

`src/machine/policy.test.ts` observes a cycle with `sdd:cancelled`, an earlier phase label, an open pull request, and every task checked: `decide` still returns `done` with reason `cancelled`, the issue is not closed as a finished cycle, and the card stays off the board as today.

Commands that must exit 0:

```
pnpm test -- src/machine/policy.test.ts
pnpm test
pnpm run test:types
```
