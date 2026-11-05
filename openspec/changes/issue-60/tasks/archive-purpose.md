On a spec that did not exist, the archive writes placeholder Purpose

The archive leaves an existing spec's Purpose unchanged

## Source

Add `src/openspec/archive-purpose.test.ts`, reusing the throwaway-checkout harness when it already exists. After a successful archive, read Purpose in the baselines: a spec that did not exist gets placeholder Purpose (`TBD - created by archiving change ...`); an existing spec keeps the Purpose it already had.

Leave accept for #55, machine archive naming, and the refusal test untouched.

## Proof

`src/openspec/archive-purpose.test.ts` observes Purpose in baselines after a successful archive for both a new spec and an existing spec.

May read `src/openspec/archive-purpose.test.ts`, shared harness files under `src/openspec/`, and existing vitest patterns in the repository.

The one-file command is the check on each attempt:

```
pnpm exec vitest --run --reporter=default src/openspec/archive-purpose.test.ts
```

Once that command exits 0, run the layer command once, then the type check:

```
pnpm test
```

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
