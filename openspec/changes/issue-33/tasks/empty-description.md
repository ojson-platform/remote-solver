An empty description leaves no block

## Source

Keep the author-text cut and pool gate from `pool-description`. When the stripped author text is empty or whitespace-only, `blocksFor` must not emit a description block (no placeholder row).

Adjust `src/window/sidebar.test.ts` (and `src/window/client/sidebar.tsx` only if the renderer would show an empty node). Leave pool-only gating and marker stripping logic unchanged unless a bug blocks this scenario.

## Proof

Test file: `src/window/sidebar.test.ts`

Observes `window.sidebar()` for a pool cycle whose issue body is empty, whitespace-only, or only a complete sdd marker pair with no author text outside it: no `description` block appears among sidebar blocks.

May read: `src/window/sidebar.ts`, `src/window/window.ts`, `src/window/window.harness.ts`.

Commands that must exit 0:

- `pnpm test -- src/window/sidebar.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.

`pnpm run test:types`
