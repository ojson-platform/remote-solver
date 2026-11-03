## Verification boundary

### finished-cycle

The scenarios are observed at the machine settlement and at the board's open-list reading. The settlement is `decide` and `settle` in `src/machine/policy.ts`, and the tracker close in `src/machine/flow.ts`. The board is filled from `tracker.listOpen()` in `src/window/live.ts` and placed by `src/window/board.ts`. A reload is that open-list reading again.

One file: `pnpm test -- <test-file>`
Layer: `pnpm test`
Fast suite: none

`pnpm test` is the CI run of the package script `vitest --run`. The one-file command passes `<test-file>` through to that script.

`pnpm run test:types`

## External contracts

none

## Technical prerequisites

none

## Approach

A cycle is finished when its change is archived, a pull request is merged, and no pull request is open. On every phase before `accepting`, `decide` returns `done` with reason `finished cycle` before a gate advance and before the early unarchive. It does not return an agent action, a wait for an open pull request, or an advance. `settle` stops on that `done` and leaves the phase labels as they are.

`applySettlement` already closes the issue only when a transition target is `accepted`. A finish has no such transition, so the same function closes through the tracker port when the decision reason is `finished cycle`. The comment is `SDLC finished: the pull request is merged and the change is archived.` It does not reuse the accepted comment. `sdd:cancelled` still returns `done` with reason `cancelled` first, and that decision does not close the issue. `accepting` and `accepted` keep the close they have now: archive if needed, then the accepted label, and only then the accepted comment.

The board grows no new hide. `refresh` reads the tracker's open list. After the close that list omits the issue, so the card is gone and a later reload does not bring it back. The next spy poll does not restore the change or start a step, because the issue is not in that list and the finish decision is not `unarchive`. A closed issue on `tasking` that a reading places directly still stands; this delta does not change that placement.

An archived change whose pull request is still open is not finished. Through `tasking` the machine still unarchives it and starts that step, including when every task is checked. On `proposed`, `specified`, and `designed` it still moves the phase and then restores. On `implementing` and `verifying` an open pull request keeps today's path, so the issue stays open and the card stays. A cycle with no pull request is not finished: the early unarchive stays, because this delta does not observe that case.

The seams are the machine settlement (`src/machine/policy.ts`, `src/machine/flow.ts`) and the window's open-list reading (`src/window/live.ts`, `src/window/board.ts`). The tracker port already closes an issue and lists open issues. Recorded as ADR 0031.

Rejected: advancing a finished cycle to `accepted` so the existing close runs. A gate would move, and `implementing` would pass through `verifying`, which the spec forbids. Rejected: hiding the card in the window while the issue stays open. The open list would still have it, and the next reading would restore the change. Rejected: closing when every task is checked but the pull request is open. That cycle stays.

## Open decisions

none
