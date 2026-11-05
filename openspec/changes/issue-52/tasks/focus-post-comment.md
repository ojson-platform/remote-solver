The skill of the phase writes this comment when the artifact is published
The skill writes a focus comment when a visit leaves something a person will read later
A focus comment is prose for one phase or the whole pull request
The layer ledger is not the comment a person reads
Older focus comments remain
Older comments remain
The same text does not add another comment
There is no ledger and no fixed heading
No signal leaves the comment
No change file means no focus comment
A published proposal uses sdd:focus:plan
A published delta spec uses sdd:focus:spec
A published design uses sdd:focus:design
Published tasks use sdd:focus:tasks
A code slice, or a code change that answers a review thread, uses sdd:focus:code
The archive commit uses sdd:focus:accept
The archive writes this comment every time, including when sdd:auto-merge is set
sdd:auto-plan, sdd:auto-spec, and sdd:auto-design do not skip the comment, and the document was published
A visit that fixes review threads of its own phase writes that phase's marker even when the diff is small
Verify, labeling threads, a rebase-only commit, and a publish that carries no phase artifact write no focus comment
A separate review step does not write the focus

## Source

Waits on `focus-closed-markers`.

Seam: the tracker port posts focus prose; phase skills reach it only through `node scripts/sdd.mjs focus` after Publish.

Keep `postFocusComment` in `src/machine/focus.ts` as the only write: skip when the change directory is absent, skip when canonical body matches the latest focus comment, append so older comments stay, never attach the layer ledger. Keep `endStep` from posting ledger comments. Wire archive and phase Publish paths to call `focus` with the closed marker for that artifact, including when `sdd:auto-plan`, `sdd:auto-spec`, or `sdd:auto-design` is set and on every archive commit including `sdd:auto-merge`. Visits that fix review threads of their own phase add another comment with that phase's marker; verify, thread labeling, rebase-only publish, and publish without a phase artifact do not call `focus`. A separate review step does not call `focus`.

Touch `src/sdd.ts`, the machine tracker port, and `src/adapters/github.ts` only as needed for marker-first bodies. Update phase step prompts under `skills/sdd-flow/steps/` to call `focus` from CONTEXT § Publish when this phase's artifact is in the commit.

Leave prose paragraph content rules and window display for later slices.

## Proof

Test file: `src/machine/focus.test.ts`

Observes issue comments after Publish and the `focus` verb: who writes, marker first lines per phase, deduplication, older comments, no post on no signal or no change file, archive and auto flags, thread-fix visits, and steps that must not write focus.

May read `src/machine/focus.test.ts`, `src/machine/focus.ts`, `src/machine/marker.ts`, `src/sdd.ts`, and harness doubles already used in this file.

Commands that must exit 0:

```
pnpm exec vitest --run --reporter=default src/machine/focus.test.ts
pnpm test
```

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
