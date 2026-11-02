## Problem

The board turns on from the agent in the home file. The row `фабрике ещё нужен агент`, the lamp, and Take all read that agent. In settings the home block shows the models, the watch list, and the roots. The select that writes the home agent is the first field of the new-role form, under Roles, and its label is `агент`. While nothing is saved the list already shows `cursor`, and choosing `cursor` does not submit.

The select a manager finds is `агент слоя`. It writes the checkout overlay, and the board still says the factory needs an agent.

## Outcome

The home block has its own agent field, above the models, and the new-role form does not. The field is empty until an agent is saved. Choosing an agent writes the home file at once, with that agent's known pair. After that, choosing the saved agent again changes nothing.

`агент слоя` remains the override for that one checkout. Empty means the home agent. The overlay models, effort, and speed keep following the merged factory. The checkout overlay stays out of the repository.

## Scope

This service only. The home block gains the field that writes the home agent, above the models. The new-role form no longer carries that field. Nothing is required from another service.

## Out of scope

- A project agent that turns the board on while the home file has no agent.
- A non-cursor overlay agent changing the model the machine launches.

## Constraints

- The field is empty until an agent is saved. Choosing an agent writes the home file at once, with that agent's known pair. Choosing the saved agent again changes nothing.
- `агент слоя` stays the override for that one checkout. An empty overlay agent means the home agent.
- The overlay models, effort, and speed keep following the merged factory.
- The checkout overlay stays out of the repository.
- The row `фабрике ещё нужен агент`, the lamp, and Take keep reading the agent in the home file.

## Capabilities

### Added

### Modified

- `settings` the home block has its own agent field above the models, empty until an agent is saved; choosing an agent writes the home file at once with the known pair, choosing the saved agent again changes nothing, and the new-role form does not have the field

## Open questions
