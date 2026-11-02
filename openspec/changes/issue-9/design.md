## Verification boundary

`home-agent` is observed on the settings sheet, the home file, the board, and the checkout overlay. The home block's agent field, empty until an agent is saved and placed above the models, and the new-role form without the field that writes the home agent, are the sheet. Choosing an agent, and choosing that saved agent again, is the home file. The row `фабрике ещё нужен агент`, the lamp, and Take are the board, and they read the home file when `агент слоя` names an agent and the home file does not. An empty `агент слоя`, a layer choice, and overlay models, effort, and speed are that checkout's overlay and the merged factory.

`pnpm test <test-file>`
`pnpm test`
none
`pnpm run test:types`

## External contracts

none

## Technical prerequisites

none

## Approach

The window already keeps three reads apart. The home block writes `~/.aifactory/config.yaml` (or the launch path). The overlay group writes that checkout's `.aifactory/config.yaml`, which stays out of the repository. The board's row, lamp, and Take read the home file. This change moves the control that writes the home agent. It does not add a second record, and it does not let the overlay satisfy the board.

In the home section of the settings sheet, an agent field labeled `агент` sits above the model fields. Its act is `choose-agent`, and it submits on change. While the home file names no agent, the field has an empty choice selected, so the list can still offer `cursor` and choosing `cursor` submits. Once an agent is saved, the field shows that agent. The new-role form, under Roles, drops that select and posts `add-role`. It does not send an agent. `add-role` is already the settings act that stores a role; it has to count as a sheet gesture, the way `choose-agent` does today, or Добавить leaves the sheet's gesture set.

`openHome.chooseAgent` still writes at once through the known pair (`replaceAgent` and the pairs already in the factory). A different agent still replaces the home models, effort, and speed with that agent's pair. The same agent returns before commit, so a later model edit stays on disk. The home commit does not open the overlay file.

`агент слоя` stays `choose-overlay-agent` on the overlay group. An empty overlay agent still means the home agent at `mergeFactory`. A choice there still commits only that checkout's overlay. Overlay models, effort, and speed keep coming from the merge: a home choice does not rewrite keys the overlay already names. The board keeps `agentRows(home.recorded())`, the lamp on the home agent's models, and Take on that same home read. An agent that exists only on the overlay leaves `фабрике ещё нужен агент`.

`boardModel` stays as ADR 0029 left it: a cursor pair in the merged factory can replace the built-in pair, and any other agent keeps the built-in pair. A project agent that turns the board on while the home file has no agent is out of scope. A non-cursor overlay agent that changes the model the machine launches is out of scope.

The field uses the sheet's existing select. No colour, ground, or measure changes, so the face is untouched.

Rejected: leaving the select on the new-role form and only adding an empty choice. The form would still be the thing that writes the home agent, and Добавить would still submit it. Rejected: treating the merged factory as the board's agent. The row would then go out while the home file was empty. Rejected: copying the known pair into the overlay when the home agent changes. The overlay's own models, effort, and speed would stop following the merge.

## Open decisions

none
