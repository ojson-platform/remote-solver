A child still on specifying holds tasking

A specified child lets tasking move on

A cancelled child does not count as specified

Tasking still waits until every child is at least specified, then moves to implementing

A cancelled child still holds that wait, and the machine still names that child

A cancelled child still holds the tasking wait, and the machine still names that child

An open task runs before the children are checked

A child that is not accepted holds implementing

An open blocker holds implementing

Finished tasks with no children move to verifying

A finished parent with a child short of accepted and an open blocker waits

Implementing still runs an open task before it looks at links

With no open task, it waits until every child is accepted, then waits while a blocker is open, then moves to verifying

A closed issue does not hold that wait

A spec marker on the parent leaves the child in place

Rolling this issue back does not move the linked issue

No other phase move waits on a link

## Source

Assume `host-issue-links` landed. `children` in `src/machine/policy.ts` stays parent plus `sdd:cycle` on the open list. `blockers` becomes the union of `blockedBy` and `dependsOn` on that same list, each issue once. `blocks` is not a blocker. An issue that is both a child and a blocker is named in the child wait and is not named again in that same decision.

Tasking still waits on a child that is not at least `specified`, including a cancelled child, and the decision reason still names that child. Implementing still runs an open task before it looks at links, then waits until every child is `accepted`, then waits while a blocker is open, then moves to `verifying`. A closed issue is absent from the open list, so it does not hold that wait. No other phase calls `children` or `blockers`. Rollback still advances only this issue; the linked issue is another key and is left as it was.

Edit `decide` paths and settlement reasons in `src/machine/` as needed. Leave the window mark list and adapters untouched except what earlier slices already changed.

## Proof

Test file: `src/machine/dependencies.test.ts`

Observes `decide` for tasking waits, implementing waits, single count across link kinds, finished-parent exception, rollback leaving the linked issue in place, and that no other phase waits on a link.

May read `src/machine/policy.ts`, flow helpers, and dependency fixtures.

Commands that must exit 0:

```
pnpm exec vitest --run --reporter=default src/machine/dependencies.test.ts
pnpm test
```

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
