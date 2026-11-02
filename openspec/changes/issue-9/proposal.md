## Problem

The board turns on from the agent in the home file. The row `фабрике ещё нужен агент`, the lamp, and Take all read that agent. In settings the home block shows the models, the watch list, and the roots. The select that writes the home agent is the first field of the new-role form, under Roles, and its label is `агент`. While nothing is saved the list already shows `cursor`, and choosing `cursor` does not submit.

The select a manager finds is `агент слоя`. It writes the checkout overlay, and the board still says the factory needs an agent.

## Outcome

The home block has its own agent field, above the models, and the new-role form does not. The field is empty until an agent is saved. Choosing an agent writes the home file at once, with that agent's known pair. After that, choosing the saved agent again changes nothing.

`агент слоя` remains the override for that one checkout. Empty means the home agent.

## Scope

The home block has its own agent field, above the models, and the new-role form does not. The field is empty until an agent is saved. Choosing an agent writes the home file at once, with that agent's known pair. After that, choosing the saved agent again changes nothing.

The row `фабрике ещё нужен агент`, the lamp, and Take all read the agent in the home file.

## Out of scope

A project agent that turns the board on while the home file has no agent. A non-cursor overlay agent changing the model the machine launches.

## Constraints

`агент слоя` remains the override for that one checkout. Empty means the home agent. The overlay models, effort, and speed keep following the merged factory. The checkout overlay stays out of the repository.

## Capabilities

### Added

- `home-agent` the home block's agent field, empty until an agent is saved, writes the home file at once with that agent's known pair, and choosing the saved agent again changes nothing

### Modified

## Open questions
