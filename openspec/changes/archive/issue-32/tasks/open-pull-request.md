An open pull request on tasking is restored
A proposed gate restores after it moves
Checked tasks and an open pull request stay
An open pull request stays on the board when every task is checked

## Source

`src/machine/policy.ts`: an archived change whose pull request is still open is not finished. Through `tasking` the machine still unarchives and starts that step when every task is checked. On `proposed`, `specified`, and `designed` it still moves the phase and then restores. Do not close the issue while a pull request is open.

Leave `src/machine/flow.ts` and the window sources unchanged unless a regression test exposes a defect.

## Proof

`src/machine/policy.test.ts` observes open-pull-request paths on `tasking` and `proposed`, and that checked tasks with an open pull request keep the issue open and the card on the board when the change is archived.

Commands that must exit 0:

```
pnpm test -- src/machine/policy.test.ts
pnpm test
pnpm run test:types
```
