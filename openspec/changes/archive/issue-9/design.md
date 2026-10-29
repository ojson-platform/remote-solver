## Verification boundary

The `settings` scenarios are observed in the window tests. The sheet — the home block's agent field above the models, the empty field before a save, and the new-role form without an agent field — is observed in `src/window/page.test.ts`. The home file, the unchanged file when the saved agent is chosen again, the row, the lamp (`board.stepsStart`), and Take (`board.takeDisabled`) are observed in `src/window/window.test.ts`. An empty `агент слоя` still leaves that row, lamp, and Take on the home agent, and the overlay models, effort, and speed stay on the merged factory, in the same window tests.

- settings one-file: `pnpm test -- <test-file>`
- settings layer: `pnpm test`
- fast suite: none

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
Test path: a `src/**/*.test.ts` file beside the source it drives.
`pnpm run test:types`

## External contracts

none

## Technical prerequisites

none

## Approach

The window draws the home block. Its agent field is its own form, above the models, and posts `choose-agent`. `openHome` writes the home file at once with that agent's known pair. The new-role form posts `add-role` and has no agent field. `агент слоя` stays the checkout overlay: an empty overlay agent leaves the board on the home agent, and the overlay models, effort, and speed keep following `mergeFactory`. The overlay file stays `.aifactory/config.yaml` in the checkout, outside the repository.

The home select includes an empty option and its value is the recorded agent, so the field is empty until a save and choosing `cursor` is a change that submits. `choose-agent` carries only the agent. `roleDraft` does not add a role on that act. `openHome.chooseAgent` returns before `commit` when the recorded agent is already that id, so a second choice does not rewrite the file or replace a later model edit with the known pair. The first choice, from an empty agent, still writes the pair. An empty offered list still writes nothing. Leaving a model, including an empty one, stays on the existing home write.

The board already reads this home agent for the row, the lamp, and Take. This change does not add a project agent, and it does not change which model a non-cursor overlay agent launches (ADR 0029). The overlay view keeps showing the merged factory: after the overlay agent is cleared, `overlay().agent` remains the home agent, and the overlay models, effort, and speed remain the merged ones.

Risk: one form that posts both the agent and the role fields still adds a role through `roleDraft`. The home field must not post `name`, `outcome`, or `text`. Risk: a same-agent guard that compares the serialized file can still rewrite it. The guard is the recorded id, before `commit`.

Отклонено: teaching `агент слоя` to write the home file. That select is the override for one checkout.
Отклонено: leaving the agent select on the new-role form as well as above the models. The new-role form has no agent field.
Отклонено: a project agent that turns the board on while the home file has no agent.
Отклонено: a non-cursor overlay agent changing the model the machine launches.

## Open decisions

none
