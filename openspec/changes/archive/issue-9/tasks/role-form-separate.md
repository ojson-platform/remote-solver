A named role is added without the home agent

An empty role name adds no role

Choosing the home agent adds no role

## Source

`src/window/client/settings.tsx`: the new-role form posts `add-role` with role fields only; the home agent form posts `choose-agent` separately.

`src/window/page.ts`: `add-role` adds a role and does not write the home agent; `choose-agent` does not add a role; `roleDraft` ignores both acts.

`src/window/client/frame.ts`: `add-role` is a settings act so submitting a role keeps the sheet open.

Leave `openHome.chooseAgent` and overlay acts untouched except as needed for the split above.

## Proof

`src/window/home-agent.test.ts` observes the home file roles list and home agent after submitting the new-role form with a name, with an empty name, and after choosing an agent in the home block. Tests may use the window surface and home file reads.

- `pnpm test src/window/home-agent.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
