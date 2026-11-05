The archive refuses with a non-zero exit and does not commit

## Source

Add `src/openspec/archive-refusal.test.ts`, reusing the throwaway-checkout harness when it already exists. With a fixture whose baseline would have no requirement after the fold, observe that `openspec archive` exits non-zero and that HEAD does not move—no commit from the refusal.

Leave accept for #55 and successful-archive behavior in the other test files untouched.

## Proof

`src/openspec/archive-refusal.test.ts` observes non-zero exit and unmoved HEAD when the fold would empty a baseline.

May read `src/openspec/archive-refusal.test.ts`, shared harness files under `src/openspec/`, and existing vitest patterns in the repository.

The one-file command is the check on each attempt:

```
pnpm exec vitest --run --reporter=default src/openspec/archive-refusal.test.ts
```

Once that command exits 0, run the layer command once, then the type check:

```
pnpm test
```

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
