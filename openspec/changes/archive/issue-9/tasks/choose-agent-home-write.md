Choosing cursor writes the home file

Choosing the saved agent again changes nothing

An empty agent list writes nothing

## Source

`src/window/window.ts` wires `chooseAgent` to the home session; leave board reading the home agent as today.

`src/window/factory.ts` `openHome.chooseAgent`: on first choice from an empty recorded agent, write the home file at once with the chosen agent and its known pair when one exists; when the recorded agent is already that id, return before `commit`; when `offered` is empty, write nothing.

`src/window/page.ts`: `choose-agent` must not add a role through `roleDraft` (same guard as `add-role`). Keep `choose-agent` posting only the agent id.

`src/window/client/settings.tsx`: the home agent form posts only `choose-agent` and `agent` (no role fields).

Do not change overlay agent handling or board rules beyond what already reads the home agent.

## Proof

`src/window/window.test.ts` observes the home file on disk, and `board.rows`, `board.stepsStart`, and `board.takeDisabled` after choosing an agent, re-choosing the saved agent, and when no agent is offered. Tests may use the window surface, checkout files, and home path helpers used elsewhere in that file.

- `pnpm test -- src/window/window.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
