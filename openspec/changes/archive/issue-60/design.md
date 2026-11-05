## Verification boundary

The one-file command passes `--reporter=default` so that file can exit 0. The layer command keeps the coverage reporter. `pnpm test` is the CI run of the package script `vitest --run`.

`archive-fold`. The scenarios are observed by running the OpenSpec CLI on a throwaway checkout, in `src/openspec/archive-fold.test.ts`. Applying a change delta onto baselines is that CLI's `openspec archive issue-<key> --yes` and the baselines afterwards. RENAMED, then REMOVED, then MODIFIED, then ADDED is a delta those four sections would leave differently in any other order, and the baseline that order produces. Remote-solver assumes that same CLI: the test's applicator is the `openspec` binary, the tool of `openspec validate` (ADR 0015).

one-file: `pnpm exec vitest --run --reporter=default <test-file>`
layer: `pnpm test`

`archive-park`. The scenario is observed on the change directory after a successful archive, in `src/openspec/archive-park.test.ts`. The change sits under `openspec/changes/archive/<date>-issue-<key>/` and is gone from `openspec/changes/issue-<key>/`.

one-file: `pnpm exec vitest --run --reporter=default <test-file>`
layer: `pnpm test`

`archive-purpose`. The scenarios are observed on Purpose in the baselines after a successful archive, in `src/openspec/archive-purpose.test.ts`. A spec that did not exist gets placeholder Purpose (`TBD - created by archiving change ...`). An existing spec keeps the Purpose it already had.

one-file: `pnpm exec vitest --run --reporter=default <test-file>`
layer: `pnpm test`

`archive-refusal`. The scenario is observed on the CLI's exit and on the fixture's HEAD, in `src/openspec/archive-refusal.test.ts`. A baseline that would have no requirement after the fold makes `openspec archive` exit non-zero, and that exit does not commit.

one-file: `pnpm exec vitest --run --reporter=default <test-file>`
layer: `pnpm test`

fast suite: none
`pnpm run test:types`
trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`
test path: `src/**/*.test.ts` or `src/**/*.test.tsx`

## External contracts

The OpenSpec CLI, the same tool as `openspec validate` (ADR 0015), applies a change delta onto baselines, parks the change, writes placeholder Purpose only for a spec that did not exist, leaves an existing Purpose unchanged, and refuses without a commit when a baseline would have no requirement.

## Technical prerequisites

none

## Approach

The fold is not a seam of this service. The machine keeps Archive as the change that has left the active directory, and `archiveDir` in `src/machine/naming.ts` stays `openspec/changes/archive/issue-<key>/`. Adapters stay the tracker, the review, the repository, and the runtime. The reviewer and the window do not learn the fold. The accept step is the rest of #55 and is not edited. `src/openspec/` is only where the tests run the CLI. It is not a port and not a fold, so the context map does not gain a module.

The tests build a throwaway checkout, invoke that `openspec` binary, and read the baselines, the parked directory, Purpose, and the refusal. They do not fold RENAMED, REMOVED, MODIFIED, or ADDED in this repository. The date in the parked path is the one the CLI writes. The refusal test asserts a non-zero exit and an unmoved HEAD. A successful archive's commit, where this repository names its change directory, how `openspec validate` checks a delta, and when a pull request merges stay out of this change.

After merge the contract is the CLI's behavior, and CI runs these tests with the layer command. No flag and no step a person performs by hand.

Rejected: a fold reimplemented apart from that CLI. Rejected: a tool other than `openspec`. Rejected: pointing `archiveDir` at `openspec/changes/archive/<date>-issue-<key>/`. Rejected: a pnpm script for the archive call. ADR 0015 calls the CLI directly.

## Open decisions

none
