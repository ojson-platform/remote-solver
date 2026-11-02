## Verification boundary

home-agent. Scenarios are observed on the settings sheet, the home file, and the checkout overlay. The home block's agent field sits above the models and is empty until an agent is saved; the new-role form does not have that field. Choosing an agent writes the home file at once with that agent's known pair, and choosing the saved agent again leaves the file unchanged. `агент слоя` stays the override for that checkout, an empty overlay agent means the home agent, the overlay models, effort, and speed follow the merged factory, and the overlay stays out of the repository.

pnpm test -- <test-file>
pnpm test
none
pnpm run test:types

## External contracts

none

## Technical prerequisites

none

## Approach

The home block gains the agent field. The new-role form loses it. The home file write and the checkout overlay stay on the seams they already have.

The face is `src/window/client/settings.tsx`. In the `Дом` group, a `choose-agent` select is the first control, above the models. It has a blank option, so while `settings.agent` is empty the list does not paint `cursor`. Changing it submits at once. The new-role form keeps the name, the outcome, the text, and `Добавить`, posts `add-role`, and does not carry an agent. No colour, ground, or measure changes, so the face file stays as it is.

`src/window/page.ts` already maps `choose-agent` to `chooseAgent` and `add-role` to `addRole`. The home field posts only the agent, so `roleDraft` does not see a role. The role form no longer posts `choose-agent`, so `Добавить` does not write the home file.

`openHome.chooseAgent` in `src/window/factory.ts` still writes through `replaceAgent`: the agent, that agent's known pair, effort only when the pair has it, and no speed key. When the chosen id is already the agent in the home file, it returns before `commit`, so a second choice does not restore the pair over models the manager has edited. A different id still replaces the set. `canWrite` stays in front of that, so a newer file on disk still blocks the write.

`mergeFactory`, `overlayOf`, and `openOverlay` stay. An empty overlay agent already means the home agent, and the overlay group already shows merged models, effort, and speed. `агент слоя` still writes or clears only `checkout/.aifactory/config.yaml`. Choosing a home agent does not write that file and does not put it in the repository. The board still turns on from the home file's agent. A project agent, and a non-cursor overlay agent changing the model the machine launches, stay out (ADR 0029).

The risk is the form that today does both jobs. One `choose-agent` form holds the agent select and the role fields, and `roleDraft` adds a role from that same post. Leaving the agent on that form would keep `Добавить` rewriting the known pair, which this delta no longer observes. The same-id return has to sit before `commit`: `replaceAgent` always rebuilds the pair, so a repeated choice would otherwise change a file the scenario says is unchanged.

Rejected: a second agent select that stays on the new-role form. Writing the home agent into the checkout overlay. Treating a repeated choice as a fresh pair. A project agent that turns the board on while the home file has no agent.

## Open decisions

none
