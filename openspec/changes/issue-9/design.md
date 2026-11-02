## Verification boundary

`home-agent` is observed on the settings sheet, the home file the launch named, the board, and that checkout's overlay. The sheet shows the home block's agent field above the models, a closed value that stays empty until an agent is saved, the offer `cursor`, `codex`, `claude-code`, `opencode` in that order with no empty choice, and a new-role form that has the role name, outcome, text, and `Добавить` and does not have that agent field. A choose is observed on the home file: the known pair written at once, effort only for codex and claude-code, no speed key, no write when the offer is empty or the launch names no home file, no write from a live catalog, and no change when the saved agent is chosen again. The row `фабрике ещё нужен агент`, the lamp (`шаги стоят` / `шаги идут`), and Take («Взять») are observed from the home agent, including when only `агент слоя` is set. `агент слоя` is observed on `.aifactory/config.yaml` of the chosen checkout: that overlay's agent and pair, an empty choice clearing agent, models, effort, and speed, merged models, effort, and speed while the overlay agent is empty, an overlay agent's own default effort, no write when no checkout is chosen, no write of the home agent, and the overlay staying out of the repository. The machine without the window is observed not to read the overlay.

One file: `pnpm test <test-file>`
Layer: `pnpm test`
Fast suite: none
Type check: `pnpm run test:types`
Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
Test path: `src/**/*.test.ts` or `src/**/*.test.tsx` (the vitest include), with the scenario inside `spec('home-agent')`.

## External contracts

none

## Technical prerequisites

none

## Approach

The change stays on the window. The context map already separates that seam: the window draws the face and writes the home file and the checkout overlay; the machine reads the tracker, the review, the repository, and the runtime through ports and does not read the overlay. Adapters are untouched. ADR 0029 stays as it is: a non-cursor overlay does not change the model the machine launches.

The home block (`Дом` in `src/window/client/settings.tsx`) gains the agent select labeled `агент`, above the model fields. It posts `choose-agent` on change. The new-role form under Roles loses that select. It posts `add-role` and keeps the role name, outcome, text, and `Добавить`. `агент слоя` stays `choose-overlay-agent`, blank included. The look does not change: same select, no new colour role, so `FACE.md` stays.

`choose-agent` in `src/window/page.ts` writes the home agent and does not add a role, even when the post also carries a role name. `add-role` adds a role and does not write the home agent. `roleDraft` today adds a role for any act other than `add-role` when name, outcome, and text are present, which is how the old combined form submitted both. That draft must ignore `choose-agent`. `add-role` joins the settings acts in `src/window/client/frame.ts`, so submitting a role keeps the sheet. Today the role form rides on `choose-agent`, which is already a settings act.

`openHome` in `src/window/factory.ts` keeps the known-pair table and still does not read a catalog. A different agent still replaces the set at once: the pair, effort when that agent has it, and no speed key. The same saved agent returns before `replaceAgent`, so a cleared model stays empty. An empty offer or a missing home path still writes nothing. While nothing is saved, the closed select must not paint `cursor`. A native select with no matching option paints the first option, and choosing that option then does not submit. The choosable options stay the four agents, with no empty choice. A disabled hidden placeholder may exist only so the closed control is blank; it is not an offer and it does not write.

`openOverlay` keeps its contract. `chooseAgent` writes that checkout's `.aifactory/config.yaml` only. An empty choice clears agent, models, effort, and speed. `mergeFactory` still supplies the home agent, and while the overlay agent is empty the overlay models, effort, and speed follow the merged factory. An overlay agent with a missing effort or speed uses that agent's default, not the home file. No chosen checkout writes nothing. Closing settings leaves the overlay write in place. The machine without the window still does not read `.aifactory`.

The overlay stays out of the repository without a tracked edit. When the checkout is a git repository, the overlay write adds `.aifactory/` to that checkout's `.git/info/exclude`. A checkout that is not a repository has no index to enter. The file remains `<checkout>/.aifactory/config.yaml`.

Risks: the blank closed state has to be explicit, or the board never turns on for cursor. Moving the role submit to `add-role` without a settings act drops the sheet. Leaving `roleDraft` as it is would still add a role from a home-agent choose.

Rejected: leaving the agent select on the new-role form. An empty choosable option on the home list. Rewriting the known pair when the same agent is chosen again. Appending `.aifactory/` to the checkout's tracked `.gitignore`, which would itself be a repository change. A second store for the factory agent. A project agent that turns the board on while the home file has no agent.

## Open decisions

none
