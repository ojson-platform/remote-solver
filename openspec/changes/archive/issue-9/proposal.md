## Problem

The board turns on from the agent in the home file. The row `фабрике ещё нужен агент`, the lamp, and Take all read that agent. In settings the home block shows the models, the watch list, and the roots. The select that writes the home agent is the first field of the new-role form, under Roles, and its label is `агент`. While nothing is saved the list already shows `cursor`, and choosing `cursor` does not submit.

The select a manager finds is `агент слоя`. It writes the checkout overlay, and the board still says the factory needs an agent.

## Outcome

The home block has its own agent field, above the models, and the new-role form does not. The field is empty until an agent is saved. Choosing an agent writes the home file at once, with that agent's known pair. After that, choosing the saved agent again changes nothing. The row, the lamp, and Take read that home agent.

`агент слоя` remains the override for that one checkout. Empty means the home agent.

## Scope

The home block's agent field: its place above the models, the empty state before a save, the write of the home file when an agent is chosen, and the unchanged file when the saved agent is chosen again. That field leaves the new-role form.

## Out of scope

- A project agent that turns the board on while the home file has no agent.
- A non-cursor overlay agent changing the model the machine launches.

## Constraints

- `агент слоя` remains the override for that one checkout. An empty overlay agent means the home agent.
- The overlay models, effort, and speed keep following the merged factory.
- The checkout overlay stays out of the repository.
- The home block still shows the models, the watch list, and the roots.

## Capabilities

### Added

### Modified

- settings the home block agent field, above the models, writes the home file; the new-role form does not

## Open questions
