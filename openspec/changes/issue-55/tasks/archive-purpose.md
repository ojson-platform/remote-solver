A new spec does not keep the Purpose the command writes

In the same commit the step sets Purpose to the one line under that capability in the proposal

An existing spec keeps its Purpose

The command does not change it

## Source

Assume `archive-commit` landed. In `skills/sdd-flow/steps/accept.md` `## archive`, in the same commit as the fold and move, replace `TBD - created by archiving change ...` on a newly created baseline spec with the gist words after the capability id under `## Capabilities` in the change proposal. Do not open or rewrite Purpose on a spec that already existed before archive, including `spec-archive`. Extend `src/machine/archive.test.ts` with fixtures for a new capability and an existing one.

Seams (no child issues): CLI writes placeholder Purpose on create only; the accept step overwrites Purpose once for new specs; existing Purpose is not edited.

## Proof

`src/machine/archive.test.ts` observes Purpose on `openspec/specs/<capability>/spec.md` in the archive commit: no placeholder on new specs, proposal line present, existing Purpose unchanged. Tests may read proposal and spec files in the fixture.

- `pnpm exec vitest --run --reporter=default src/machine/archive.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
