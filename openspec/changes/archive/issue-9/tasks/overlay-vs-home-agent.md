An empty overlay agent means the home agent

The overlay agent does not write the home file

Overlay models, effort, and speed follow the merged factory

## Source

`src/window/window.ts` keeps overlay agent on the checkout session and board on the home agent.

Keep `агент слоя` on the checkout overlay only (`src/window/client/settings.tsx` overlay section, `src/window/page.ts` `choose-overlay-agent`, overlay session in `src/window/factory.ts`). Setting overlay agent must not write the home file. With a home agent recorded and an empty overlay agent, the board row, lamp, and Take read the home agent. Overlay models, effort, and speed in settings follow the merged factory; overlay file stays `.aifactory/config.yaml` outside the repository.

Do not add a project agent or change which model a non-cursor overlay agent launches.

## Proof

`src/window/window.test.ts` observes home vs overlay files, board rows including `фабрике ещё нужен агент`, lamp and Take when home has no agent but overlay has one, and overlay model/effort/speed fields when settings open on a checkout. Tests may use window, overlay, and home helpers in that file.

- `pnpm test -- src/window/window.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
