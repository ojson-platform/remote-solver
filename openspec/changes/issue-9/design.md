## Verification boundary

### home-agent

Scenarios are observed on the settings sheet the window serves and on the home file that sheet writes. Field order, the empty choice, and the saved agent are the sheet. The pair, an unchanged file, and a role stored without an agent are the home file. The layer-agent scenarios that stay in the baseline are observed on the checkout overlay and the board row, in the same layer run.

- one file: `pnpm exec vitest --run <test-file>`
- layer: `pnpm test`
- fast suite: none

`pnpm test <test-file>` is the same `vitest --run` script with the path appended. The layer command is that script with no path, which is what CI runs.

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`. The `scenario` name is the scenario title.

Test path: `src/window/<spec-id>.test.ts`

`pnpm run test:types`

## External contracts

none

## Technical prerequisites

none

## Approach

The window already stores one home agent in the home file and one checkout override in the overlay. This change moves the control that writes the home agent onto the home block, and it stops a second choice of that same agent from replacing a pair the manager has edited.

The face draws the settings sheet in `src/window/client/settings.tsx`. The home block (`Дом`) gains a select labeled `агент` above the models, then the models, then effort and speed when that agent has them, then the watch list, then the roots. The select offers a blank choice and shows no agent until the home file has one. Choosing an offered agent submits `choose-agent` at once. The blank is not an offered agent: posting it writes nothing and does not clear a saved agent. After a save the field shows that agent, so choosing it again is not a new value. The new-role form under Roles keeps the name, the outcome, and the text, drops the agent select, and submits `add-role`. A colour, the ground, or a measure is unchanged, so `FACE.md` stays.

`src/window/page.ts` keeps the two writes apart. `choose-agent` calls `chooseAgent` only when the posted id is non-empty, and `roleDraft` does not store a role from that post. `add-role` already stores a filled name and stores nothing when the name is empty, and it does not call `chooseAgent`. `add-role` joins the settings acts in `src/window/client/frame.ts`, with the other role edits, so the sheet counts the gesture.

The home write stays in `openHome` in `src/window/factory.ts`. A new offered id still goes through `replaceAgent`, which writes that agent's known pair and does not read a catalog. `cursor` from an empty file writes `composer-2.5-fast` and `grok-4.7-high-fast`. `codex` writes `gpt-6-luna` and `gpt-6.1-sol`. When the stored agent is already that id, `chooseAgent` returns after the disk check and does not commit, so a model the manager changed stays. A real change of agent still replaces the whole set.

The overlay and the board stay on their current seams. `агент слоя` still posts `choose-overlay-agent` and writes only `.aifactory/config.yaml`, which stays out of the repository. An empty overlay agent still means the home agent, through `mergeFactory`. Overlay models, effort, and speed stay on that merged factory. The row `фабрике ещё нужен агент`, the lamp, and Take still read the home agent (`recorded`), not the overlay agent. ADR 0029 stays: only a cursor merged agent replaces the pair the board launches.

The risk is the form that does both jobs today. `roleDraft` stores a role from any post that carries a name, an outcome, and text, and the new-role form posts `choose-agent`, so one submit writes an agent and can store a role. Splitting the posts, and ignoring role fields on `choose-agent`, is what keeps a role submit from writing the home agent. The other risk is `chooseAgent` always calling `replaceAgent`. The skip applies only when the home id already matches. The overlay's `chooseAgent` is a separate function and stays as it is.

Leaving the select on the new-role form was rejected: the home block is the control, and a role submit must not write the agent. Writing the pair only when the role form is saved was rejected: choosing an agent writes at once, with no role name. Rewriting the known pair when the saved agent is chosen again was rejected: that is the baseline this change removes. A second store, or a live model catalog, was rejected: the home file and the known-pair table already decide the write. An overlay agent or a project agent that turns the board on while the home file has no agent is out of scope. The board keeps reading the home agent.

## Open decisions

none
