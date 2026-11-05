The OpenSpec CLI parks the change under the dated archive path

## Source

Add `src/openspec/archive-park.test.ts`, reusing the throwaway-checkout harness from the fold slice when it already exists. After a successful `openspec archive issue-<key> --yes`, observe that the change sits under `openspec/changes/archive/<date>-issue-<key>/` and is gone from `openspec/changes/issue-<key>/`. The date is whatever the CLI writes.

Leave machine `archiveDir` at `openspec/changes/archive/issue-<key>/`, accept for #55, and purpose and refusal tests untouched.

## Proof

`src/openspec/archive-park.test.ts` observes the parked directory and the absence of the active change directory after archive.

May read `src/openspec/archive-park.test.ts`, shared harness files under `src/openspec/`, and existing vitest patterns in the repository.

The one-file command is the check on each attempt:

```
pnpm exec vitest --run --reporter=default src/openspec/archive-park.test.ts
```

Once that command exits 0, run the layer command once, then the type check:

```
pnpm test
```

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
