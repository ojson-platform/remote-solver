The home block has its own agent field above the models

The field is empty until an agent is saved

Opening settings does not save the first option

## Source

`src/window/client/settings.tsx`: the block «Дом» gets its own agent select labeled `агент` above `ModeFields`, watch list, and roots; the new-role form under Roles keeps only role name, outcome, text, and submit `Добавить`, with no agent field. Until the home file records an agent, the closed select stays blank: offer `cursor`, `codex`, `claude-code`, and `opencode` in that order with no empty choosable option; a disabled hidden placeholder is allowed so the native control does not paint the first option. Opening settings must not write the home file.

`src/window/window.ts`: expose `settings.agent` as empty when the home file has no agent.

Leave `src/window/page.ts` acts, `src/window/factory.ts` home writes, overlay UI, and board wiring untouched in this slice.

## Proof

`src/window/home-agent.test.ts` observes the settings sheet: agent field above models, watch list and roots still present, new-role form without an agent control, empty closed agent field when nothing is saved, and no home file after open and close settings. Tests may read the window surface and home path helpers used elsewhere in window tests.

- `pnpm test src/window/home-agent.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
