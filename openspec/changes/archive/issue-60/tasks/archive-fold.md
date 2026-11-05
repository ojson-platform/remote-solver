The OpenSpec CLI applies a change delta onto baselines with openspec archive

The archive applies RENAMED, then REMOVED, then MODIFIED, then ADDED

Remote-solver assumes the CLI already behaves this way

## Source

Seams of this change: invoking the OpenSpec CLI binary from `src/openspec/` tests only; the fold is not a seam of this service. Neither seam gets its own child issue. External contracts: the OpenSpec CLI (design § External contracts); parent #55 already filed this cycle as the contract child—verify the CLI here, do not open another child.

Add `src/openspec/archive-fold.test.ts` and any shared throwaway-checkout harness under `src/openspec/` that this slice needs. Tests invoke the `openspec` binary—the same tool as `openspec validate` (ADR 0015)—with `openspec archive issue-<key> --yes` and read the baselines afterwards. One scenario observes that the delta lands on baselines through that command. Another uses a delta whose four sections would differ under any order other than RENAMED, then REMOVED, then MODIFIED, then ADDED. The third observes that the test applicator is that CLI, not a fold reimplemented in this repository.

Leave `src/machine/`, accept for #55, `archiveDir` in `src/machine/naming.ts`, and the park, purpose, and refusal test files to later slices.

## Proof

`src/openspec/archive-fold.test.ts` observes the fold scenarios on a throwaway checkout through the OpenSpec CLI and the baselines after archive.

May read `src/openspec/archive-fold.test.ts`, shared harness files this slice adds under `src/openspec/`, and existing vitest patterns in the repository.

The one-file command is the check on each attempt:

```
pnpm exec vitest --run --reporter=default src/openspec/archive-fold.test.ts
```

Once that command exits 0, run the layer command once, then the type check:

```
pnpm test
```

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
