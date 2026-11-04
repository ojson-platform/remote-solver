The machine does not restore that change and does not start another step
Implementing without tasks does not restore a finished cycle
An open task on a finished cycle does not start
Checked tasks on a finished cycle do not wait for an open pull request
A finished cycle on a proposed gate does not restore

## Source

`src/machine/policy.ts`: before gate advance and before the early unarchive on phases before `accepting`, when the change is archived, a pull request is merged, and no pull request is open, `decide` returns `done` with reason `finished cycle` instead of unarchive, agent actions, waits for an open pull request, or advances. `sdd:cancelled` still wins first. `accepting` and `accepted` keep today's paths.

Leave `src/machine/flow.ts` and the window sources to later slices.

## Proof

`src/machine/policy.test.ts` observes `decide` and `settle` for a finished cycle on `tasking`, `implementing`, and `proposed`: no unarchive, no open task, no move to `verifying`, no phase move that restores the change.

Commands that must exit 0:

```
pnpm test -- src/machine/policy.test.ts
pnpm test
pnpm run test:types
```
