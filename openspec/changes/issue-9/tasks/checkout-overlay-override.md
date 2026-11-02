агент слоя remains the override for that one checkout

Empty means the home agent

The overlay models, effort, and speed follow the merged factory

The checkout overlay stays out of the repository

## Source

After a home agent is saved, checkout overlay behavior must match the delta: `агент слоя` stays the per-checkout override and is not replaced by a home save; empty overlay agent means the home agent; overlay model, effort, and speed fields still reflect the merged factory; overlay files stay under the checkout and out of git. Prefer tests over production changes — `mergeFactory`, `overlayOf`, and `openOverlay` already implement most of this.

Seams: checkout overlay file (`.aifactory/config.yaml` under the open checkout), merge of home and overlay for display. Seams not crossed: writing home agent into overlay, changing machine launch model from overlay non-cursor agent.

May edit:

- `src/window/settings.test.ts`
- `src/window/factory-config.test.ts`
- `src/window/window.test.ts`

Leave untouched unless a test proves a regression:

- `src/window/factory.ts` overlay APIs
- `src/window/client/settings.tsx` overlay group

## Proof

`src/window/settings.test.ts`

Observes overlay agent, merged overlay models/effort/speed, and overlay file location relative to the checkout when the manager saves a home agent with `агент слоя` set, empty, or with an existing overlay; confirms overlay paths are not repository-tracked.

May read: `src/window/settings.test.ts`, `src/window/factory-config.test.ts`, `src/window/window.test.ts`, `src/window/window.harness.ts`, `src/window/factory.ts`.

Commands (exit 0):

```
pnpm test -- src/window/settings.test.ts
pnpm test
pnpm run test:types
```
