Choosing cursor writes the known pair

Choosing another agent writes that pair

Choosing the saved agent again changes nothing

## Source

`src/window/factory.ts` `openHome.chooseAgent`: from an empty recorded agent, write the home file at once with the chosen agent and its known pair; when the recorded agent is already that id, return before `commit`; do not open the overlay file on a home commit.

`src/window/page.ts`: `choose-agent` carries only the agent id and must not add a role through `roleDraft`.

`src/window/client/settings.tsx`: the home agent form posts only `choose-agent` and `agent` (no role fields). While the home file names no agent, the select offers `cursor` and choosing `cursor` submits.

Do not change overlay agent handling or board rules beyond what already reads the home agent.

## Proof

`src/window/factory-config.test.ts` observes the home file on disk after choosing `cursor`, choosing a different agent, and re-choosing the saved agent. Tests may use the window surface and home path helpers used elsewhere in that file.

- `pnpm test src/window/factory-config.test.ts`
- `pnpm test`
- `pnpm run test:types`
