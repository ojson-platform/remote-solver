An empty layer agent means the home agent

A layer choice writes the overlay only

The home agent leaves overlay models on the merged factory

## Source

`src/window/window.ts` keeps `chooseOverlayAgent` on the checkout session; empty overlay agent resolves to the home agent at `mergeFactory`.

`src/window/client/settings.tsx` overlay section and `src/window/page.ts` `choose-overlay-agent`: a layer choice commits only that checkout's `.aifactory/config.yaml`, leaves the home file unchanged, and keeps the overlay out of the repository.

`src/window/factory.ts` overlay session and merge: overlay models, effort, and speed follow the merged factory when the manager chooses an agent in the home block; a home choice does not rewrite keys the overlay already names.

## Proof

`src/window/window.test.ts` observes home vs overlay files, merged overlay fields in settings on a checkout, and that a home agent choice leaves overlay models, effort, and speed on the merged factory. Tests may use window, overlay, and home helpers in that file.

- `pnpm test src/window/window.test.ts`
- `pnpm test`
- `pnpm run test:types`
