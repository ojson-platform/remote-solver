Cursor writes its pair and the board turns on

Codex writes its pair and effort

Claude-code writes its pair and effort

OpenCode writes its pair

A catalog does not change the pair

Choosing the saved agent again changes nothing

An empty offer writes nothing

No home file path writes nothing

## Source

`src/window/factory.ts` `openHome.chooseAgent`: write the home file at once with the chosen agent's known pair; effort only for codex and claude-code; no speed key; do not read a live catalog. When the recorded agent is already that id, return before replacing the pair so a cleared model stays empty. When `offered` is empty or the launch names no home path, write nothing.

`src/window/page.ts`: `choose-agent` writes the home agent only; `roleDraft` must ignore `choose-agent`.

`src/window/client/settings.tsx`: the home agent form posts `choose-agent` on change with the agent id only.

`src/window/client/frame.ts`: register `add-role` as a settings act so role submit keeps the sheet (prepare for the next slice; do not wire role submit to `choose-agent`).

Do not change overlay agent handling beyond what earlier slices already left.

## Proof

`src/window/home-agent.test.ts` observes the home file on disk and board rows, lamp (`stepsStart`), and Take refusal after choosing each offered agent, after re-choosing the saved agent with a cleared model, when a live catalog names other models, when no agent is offered, and when the launch names no home file. Tests may use the window surface, checkout files, and home path helpers.

- `pnpm test src/window/home-agent.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
