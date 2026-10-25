# board

## Purpose

The board is the part of the window that lays cycles out by phase. The manager takes a cycle from the pool. The window reads the phase row from the cycle and does not recompute it.

## Requirements

### Requirement: A gate shares the column of the phase it closes

A cycle on `proposed` SHALL stand on `proposing`, a cycle on `specified` SHALL stand on `specifying`, and a cycle on `designed` SHALL stand on `designing`. Those gates SHALL NOT have stations of their own. The station name SHALL be the phase the gate closes.

#### Scenario: Proposed stands in proposing

- **WHEN** a cycle carries `proposed` and the assignee is this manager
- **THEN** the plaque stands on the `proposing` station

#### Scenario: Specified stands in specifying

- **WHEN** a cycle carries `specified` and the assignee is this manager
- **THEN** the plaque stands on the `specifying` station

### Requirement: A column shows this manager's cycles

A column SHALL show a cycle whose assignee is this window's manager. A cycle with a phase and another assignee SHALL NOT be shown. A cycle with a phase and no assignee SHALL stand in the pool. While a cycle is in `accepting`, the issue is open, and one pull request is open, the card SHALL stand in `accepting` with icon reason `мерж`, and it SHALL leave when the issue closes. One open pull request on an earlier phase SHALL leave the card on that phase. A card that carries `sdd:cancelled` SHALL leave, even when an earlier phase label remains.

#### Scenario: Another assignee is hidden

- **WHEN** a cycle has a phase and the assignee is not this manager
- **THEN** the window does not show that card

#### Scenario: A phase without an assignee stands in the pool

- **WHEN** a cycle has a phase and no assignee
- **THEN** the card stands in the pool

#### Scenario: Accepting shows the merge while the issue is open

- **WHEN** a cycle is in `accepting`, the issue is open, and the merge is still ahead
- **THEN** the card stands in `accepting` and the icon reason contains `мерж`

#### Scenario: One open pull request leaves proposing in place

- **WHEN** the phase is `proposing` and one pull request is open
- **THEN** the card stands in `proposing` and the reason does not contain `мерж`

#### Scenario: Cancelled leaves the board

- **WHEN** an issue carries `sdd:cancelled` and an earlier phase label
- **THEN** the window shows no card for that issue

### Requirement: The pool holds cycles the manager can take

The pool SHALL hold open cycles on the watch list that carry `sdd:cycle`, have no phase, and have no assignee, and cycles that have a phase and no assignee. An issue without `sdd:cycle` SHALL NOT be in the pool. A cycle with no phase and another assignee SHALL be hidden. A cycle with no phase whose assignee is already this manager SHALL leave the pool when the merged factory config can start a step, and the window's spy SHALL set `proposing`. When that config cannot start a step, the card SHALL stay in the pool and «Взять» SHALL be disabled. Two open pull requests or a checkout break SHALL keep that card in the pool, and the spy SHALL NOT set `proposing`.

#### Scenario: A bare cycle label with no assignee is in the pool

- **WHEN** an open cycle on the watch list carries `sdd:cycle`, has no phase, and has no assignee
- **THEN** the card stands in the pool

#### Scenario: An issue without the cycle label is absent

- **WHEN** an open issue on the watch list has no `sdd:cycle` label
- **THEN** the pool does not show it

#### Scenario: This manager's cycle enters proposing when a step can start

- **WHEN** a cycle has no phase, the assignee is already this manager, and the merged factory config can start a step
- **THEN** the window's spy sets `proposing` and the card leaves the pool

#### Scenario: This manager's cycle stays when a step cannot start

- **WHEN** a cycle has no phase, the assignee is already this manager, and the merged factory config cannot start a step
- **THEN** the card stays in the pool and «Взять» is disabled

#### Scenario: Two pull requests keep an assigned cycle in the pool

- **WHEN** a cycle has no phase, the assignee is already this manager, two pull requests are open, and a step can start
- **THEN** the spy does not set `proposing` and the card stays in the pool with reason `несколько pull request`

#### Scenario: A checkout break keeps an assigned cycle in the pool

- **WHEN** a cycle has no phase, the assignee is already this manager, the checkout is broken, and a step can start
- **THEN** the spy does not set `proposing` and the card stays in the pool

### Requirement: Take writes this process login

A play sign on a cycle SHALL write the assignee as the login of this process and SHALL NOT write a phase. Its accessible name SHALL be «Взять». The word «Взять» SHALL NOT be the button's text. On GitHub that login SHALL be the login of `gh api user`. The window's spy SHALL set `proposing` after that write when the merged factory config can start a step, and the plaque SHALL then stand on `proposing`. Dragging the tile onto a station SHALL be the same gesture: the station under the pointer SHALL show a ring, and the phase SHALL NOT be taken from the station where the tile is dropped. While the home config is missing, play SHALL look disabled and SHALL NOT write the assignee. An exclamation SHALL replace play when a checkout break or two open pull requests silence «Взять» for that cycle. The break phrase SHALL NOT be on the tile face. When «Взять» is silent because the home config is missing or the merged factory config cannot start a step, play SHALL stay on the corner and look disabled, and the reason SHALL be a board row, not a cycle popup. A cycle whose assignee is already this manager SHALL NOT show play.

#### Scenario: Take on a phaseless cycle writes the login only

- **WHEN** the manager takes a cycle that has no phase and the merged factory config can start a step
- **THEN** the assignee becomes this process login, the phase was not written by «Взять», and the window's spy then sets `proposing`

#### Scenario: Take does nothing without a home config

- **WHEN** the home config file is absent and the manager uses «Взять»
- **THEN** the assignee stays unset

#### Scenario: Play is named Take and is not the button text

- **WHEN** a phaseless cycle can be taken
- **THEN** the control's accessible name is «Взять» and the button text is not «Взять»

#### Scenario: A drop on a station does not write the phase

- **WHEN** the manager drops a phaseless cycle on the `implementing` station and a step can start
- **THEN** the assignee is written and that drop did not write a phase

#### Scenario: An exclamation replaces play on this cycle's break

- **WHEN** a pool cycle has a checkout break or two open pull requests
- **THEN** the tile shows an exclamation instead of play and does not show the break phrase on its face

#### Scenario: A board-wide silence leaves play disabled

- **WHEN** the merged factory config cannot start a step and the cycle has no checkout break and one open pull request
- **THEN** play stays on the corner, looks disabled, and the reason is a board row

### Requirement: Take on a cycle that has a phase keeps the phase

«Взять» on a cycle that already has a phase SHALL write this process login and SHALL NOT change the phase. An empty model SHALL NOT disable that gesture. The cycle SHALL remain in the column of its phase.

#### Scenario: Take keeps the phase

- **WHEN** the manager takes a cycle that stands in the pool with phase `implementing`
- **THEN** the assignee becomes this process login and the phase stays `implementing`

#### Scenario: An empty model still allows Take on a phased cycle

- **WHEN** the merged factory config has an empty model and the manager takes a cycle that already has a phase
- **THEN** the assignee is written and the phase stays

### Requirement: Two open pull requests block Take

Two open pull requests SHALL keep the card in the pool, SHALL show icon reason `несколько pull request`, and SHALL NOT write the assignee. When one pull request is open, «Взять» SHALL act.

#### Scenario: Two pull requests leave the card in the pool

- **WHEN** a pool cycle has two open pull requests and the manager uses «Взять»
- **THEN** the card stays in the pool, the assignee stays unset, and the icon reason is `несколько pull request`

#### Scenario: One pull request allows Take

- **WHEN** a pool cycle has one open pull request and the manager uses «Взять»
- **THEN** the assignee is written

### Requirement: The phase row is read from the cycle

The window SHALL read the phase row from the same files and headings the machine reads, and SHALL NOT recompute it. `proposing` SHALL show the number of open `- [ ]` items under `## Open questions` in `proposal.md`, including 0. `specifying` SHALL show no row. `designing` SHALL show the number of open `- [ ]` items under `## Open decisions` in `design.md`, including 0. `tasking` SHALL show no row. `implementing` SHALL show done and open from `tasks.md` when that file exists, counting `- [x]` as done and `- [ ]` as open. When `tasks.md` is absent, `implementing` SHALL show no such count. `verifying` and `accepting` SHALL show one state of the open pull request, `green`, `red`, or `pending`. A state `none` SHALL show no row. Check names and logs SHALL NOT be on the card. The window SHALL NOT show a coverage count, and SHALL NOT show children, blockers, or threads as a separate number.

#### Scenario: Proposing shows the open-question count

- **WHEN** a cycle stands in `proposing` and `proposal.md` has two open items under `## Open questions`
- **THEN** the phase row shows 2

#### Scenario: Specifying has no phase row

- **WHEN** a cycle stands in `specifying`
- **THEN** the card has no phase row

#### Scenario: Implementing without tasks.md has no count

- **WHEN** a cycle stands in `implementing` and the change has no `tasks.md`
- **THEN** the card does not show a done and open count

#### Scenario: Verifying shows one check state

- **WHEN** a cycle stands in `verifying` and the open pull request state is `red`
- **THEN** the phase row shows `red` and does not show check names

#### Scenario: None leaves the check row blank

- **WHEN** a cycle stands in `verifying` and the pull request state is `none`
- **THEN** the card has no check row

### Requirement: Column order follows the icon occasion

In the key column, cycles this manager already holds SHALL come first. Inside that group, cards that have an icon occasion SHALL come first, even when the mark is hidden. Inside that group, and among the rest, cards SHALL be ordered by key. Pool cycles SHALL follow, ordered by key.

#### Scenario: A hidden icon still sorts first

- **WHEN** one card has an icon occasion and the mark is hidden because a step is running, and another card has no occasion
- **THEN** the card with the occasion stands above the other, and both are ordered by key inside their group

### Requirement: The icon is hidden while a step runs or checks are waited

The window SHALL record an icon occasion for a gate, an ask, an open question, an open decision, the merge, a child, a blocker, several pull requests, or a checkout break. It SHALL NOT draw that occasion as one lettered icon on the tile or the plaque. A cycle break SHALL be the exclamation on the tile. A future gate SHALL be Gandalf or a circle. Current work SHALL be the plaque. Children and blockers SHALL stay words on the reason line. While an agent leads a step, or the cycle waits on checks, the plaque SHALL keep its text and SHALL NOT add an occasion mark. The row order SHALL keep that occasion.

#### Scenario: A gate shows the icon

- **WHEN** a cycle stands on `proposed` and no step is running and checks are not waited
- **THEN** the occasion is recorded and the tile shows no lettered icon

#### Scenario: A running step hides the icon

- **WHEN** an agent is leading a step and the cycle has an ask
- **THEN** the plaque keeps its text and shows no occasion mark

### Requirement: The icon reason is one line

The icon reason SHALL be one line, the same line the sidebar shows in full. It SHALL start with at most one checkout break, in this order: `каталога нет`, otherwise `не назван сервис`, otherwise `конфига сервиса нет`, otherwise `очереди нет в конфиге сервиса`. The rest SHALL follow through `·`, and only the parts the cycle has, in this order: the gate name `proposed`, `specified`, `designed`, or `accepted`; Ask; `вопросы N` for open questions; `решения N` for open decisions; `мерж`; `дети` and the Child keys in key order; `блокеры` and the Blocker keys in key order; `несколько pull request`. The window SHALL gather children from the same reading: records that carry `sdd:cycle` and whose `parent` is this card's key. It SHALL gather blockers from `dependsOn` on this record and find them in the same reading. It SHALL NOT parse the issue body. When the only occasion is questions, or only decisions, and the phase row already shows that number, the card SHALL NOT show the reason line. The sidebar reason block SHALL remain.

#### Scenario: A missing catalog outranks a missing service config

- **WHEN** the checkout catalog is missing and the service config file is also missing
- **THEN** the reason starts with `каталога нет` and does not start with `конфига сервиса нет`

#### Scenario: The card hides a question-only reason

- **WHEN** the only occasion is open questions and the phase row already shows that count
- **THEN** the card shows no reason line

#### Scenario: Children are keys from parent

- **WHEN** another record carries `sdd:cycle` and its `parent` is this card's key
- **THEN** the reason contains `дети` and that record's key

### Requirement: A healthy pool card shows Take

A pool tile with no checkout break and without two open pull requests SHALL show the key, the title, and a play sign named «Взять», ordered by key. A pool tile with a checkout break or two open pull requests SHALL show an exclamation instead of play, and «Взять» SHALL NOT act. The break phrase SHALL NOT be on the tile face.

#### Scenario: A healthy pool card has no icon

- **WHEN** a pool cycle has no checkout break and one open pull request
- **THEN** the tile shows the key, the title, and play, and does not show an exclamation

#### Scenario: A broken pool card disables Take

- **WHEN** a pool cycle has a checkout break
- **THEN** the tile shows an exclamation instead of play, and «Взять» does not write the assignee

### Requirement: No home config leaves one row

While the home config is absent, the board SHALL be visible and SHALL show one row: the factory still needs an agent, and the choice is in settings. Checkout rows for an empty model or a broken file SHALL be absent. Settings SHALL NOT open themselves. Steps SHALL NOT start.

#### Scenario: The board asks for an agent

- **WHEN** the launch passed no home path, or the home file does not exist
- **THEN** the board shows that the factory still needs an agent, and settings stay closed

### Requirement: A silent agent leaves one row

When the recorded agent no longer answers, the board SHALL show only the row `агент не отвечает`. The window's spy SHALL NOT start a step, and «Взять» SHALL NOT act. Settings SHALL NOT open themselves. The empty-model row SHALL be absent.

#### Scenario: A silent agent hides the empty-model row

- **WHEN** the recorded agent does not answer and a model field is empty
- **THEN** the board shows only `агент не отвечает`

### Requirement: An empty or rejected model names the checkout

When the agent answers and a model in the merged factory config is empty, the board SHALL show a row that names the checkout path and the empty skill mode: `нужна модель mechanical`, `нужна модель judgment`, or `нужны модели mechanical и judgment`. That row SHALL stop the window spy's steps for that service, and SHALL stop «Взять» on a cycle of that service that has no phase. It SHALL NOT stop «Взять» on a cycle that already has a phase. When a service-config row is also shown, the factory row SHALL come first. When the agent answers and a recorded model id is no longer accepted, the board SHALL show `модель не запускается` naming the checkout path, the skill-mode slot, and the id. The next step SHALL NOT start, and «Взять» for that service SHALL NOT act. Empty effort and empty speed SHALL NOT show these rows and SHALL NOT stop a step.

#### Scenario: Both models empty

- **WHEN** the agent answers and both skill-mode models are empty for a checkout
- **THEN** the row names that checkout path and says `нужны модели mechanical и judgment`, and «Взять» does not act for that service

#### Scenario: A rejected id names the slot

- **WHEN** the agent answers and rejects the recorded id of `judgment`
- **THEN** the row `модель не запускается` names the checkout path, `judgment`, and that id

#### Scenario: The factory row comes before the service-config row

- **WHEN** a checkout has an empty model and its service config does not read
- **THEN** the empty-model row is shown before `конфиг сервиса не читается`

### Requirement: The board is a column of keys and seven stations

The board SHALL show one column of keys and seven stations, left to right: `proposing`, `specifying`, `designing`, `tasking`, `implementing`, `verifying`, `accepting`. An empty station SHALL keep the same width as the others. The window SHALL NOT collapse an empty station and SHALL NOT replace a plaque with a dot. The key column SHALL stay when the pool is empty, and an empty pool SHALL draw no tile. Cycles whose assignee is this manager and that already have a phase SHALL stand above the pool. The window SHALL NOT add a control that sets a phase. The window is the surface of one running ai-factory. It SHALL NOT be a tracker page and SHALL NOT be the agent chat, and a running step SHALL NOT have a panel of its own.

#### Scenario: An empty station stays the same width

- **WHEN** no cycle stands in `specifying`
- **THEN** the `specifying` station is still on the board and has the same width as `proposing`

#### Scenario: The window adds no phase control

- **WHEN** the manager opens a row
- **THEN** the window offers no control that writes a phase label

#### Scenario: An empty pool draws no tile

- **WHEN** the pool has no cycle
- **THEN** the key column remains and the pool draws no tile

### Requirement: A plaque shows the top and the bottom in order

The tile SHALL show the full key and the title. The plaque SHALL be a button on the station of the cycle's phase. A click SHALL open the row and SHALL NOT write a phase. The top and the bottom SHALL be the first match, in the order below. The window SHALL NOT compose that text.

The top, in order:

1. `ask`, while the cycle has `sdd:wait-human`.
2. The layer names the latest `sdd:focus` did not mark `solid`, in focus order, joined by `·`.
3. `ревью`, when unanswered text is present and the top is not `ask`.
4. `red`, `green`, or `pending`, when the station is `verifying` or `accepting` and that state is present.
5. Otherwise there is no top, and the plaque is one bottom line.

The bottom is the first line below that is present and does not repeat the top:

1. The ask text, when the top is `ask`. On the closed plaque the tail SHALL be hidden.
2. The phase row, when the phase has one.
3. The reason line, when it does not repeat the top. Children and blockers stay words on that line.
4. The unanswered text, when the top is `ревью`.

While an agent leads a step, or the cycle waits on checks, the plaque SHALL keep its text and SHALL NOT add an occasion mark. The row order SHALL keep that occasion.

#### Scenario: Ask is the top while the cycle waits

- **WHEN** a cycle has `sdd:wait-human` and the latest issue comment that is not `sdd:focus` is the ask
- **THEN** the plaque top is `ask` and the bottom is that ask text, and the phase row is not repeated on the plaque

#### Scenario: A focus gap is the top when there is no ask

- **WHEN** the latest `sdd:focus` marks Plan `solid` and lists a gap on Specify, and the cycle has no `sdd:wait-human`
- **THEN** the plaque top shows Specify and does not show Plan

#### Scenario: A solid focus adds no gap line

- **WHEN** the latest `sdd:focus` marks every recorded layer `solid` and the cycle has no `sdd:wait-human`
- **THEN** the plaque top is not a gap line

#### Scenario: Review is the top when text is unanswered

- **WHEN** a thread has no marker, the cycle has no `sdd:wait-human`, and the top is not a focus gap
- **THEN** the plaque top is `ревью` and the bottom is that unanswered text

#### Scenario: The check state is the top on verifying

- **WHEN** a cycle stands on `verifying` and the open pull request state is `red`
- **THEN** the plaque top is `red` and does not show check names

#### Scenario: A click opens the row and does not write a phase

- **WHEN** the manager clicks the plaque
- **THEN** the row opens and the phase was not written by that click

#### Scenario: The closed plaque hides the tail of the ask

- **WHEN** the ask text is longer than the closed plaque
- **THEN** the closed plaque shows one line and the open row shows the whole ask

### Requirement: A future gate sets or clears one auto label

A human gate exists on `proposing`, `specifying`, `designing`, and `accepting`. On a row that has a plaque, the sign SHALL stand only ahead of the plaque and only while that station has no file. On a pool cycle with no plaque, the sign SHALL stand on each of those four stations. When the gate is on, the sign SHALL be Gandalf and its accessible name SHALL be «Снять гейт» plus the station name. A click SHALL write that one label: `sdd:auto-plan`, `sdd:auto-spec`, `sdd:auto-design`, or `sdd:auto-merge`. The click SHALL NOT write a phase, `proposed`, `specified`, `designed`, or `accepted`. When the gate is off, the sign SHALL be an empty circle and its accessible name SHALL be «Поставить гейт» plus the station name. A click SHALL remove that one label. A started or passed station SHALL NOT show the button on the board, and a board click SHALL NOT change the label there. When a future station already has a door, the board SHALL show the door. A click SHALL NOT remove `sdd:wait-human`. A station with no gate and no file SHALL be a dot, including a station behind the plaque. A dot SHALL NOT be a button. `accepted` SHALL NOT be set by this button. Removing the last gate that is still on SHALL ask before the write. The question SHALL say that the cycle will be left without control. Dismissing it SHALL leave the label as it was. Confirming it SHALL write that one label.

#### Scenario: Gandalf writes one auto label and does not write a phase

- **WHEN** the plaque is on `proposing`, `designing` has no file, and the gate is on
- **THEN** the `designing` station is Gandalf named «Снять гейт designing», and a click adds `sdd:auto-design` and does not write a phase

#### Scenario: A circle removes that one label

- **WHEN** the gate on `specifying` is off and the station is still ahead of the plaque with no file
- **THEN** the station is an empty circle named «Поставить гейт specifying», and a click removes `sdd:auto-spec`

#### Scenario: A started phase has no gate button

- **WHEN** the plaque is on `specifying`
- **THEN** the `proposing` and `specifying` stations have no gate button

#### Scenario: A door keeps the gate button in the open row

- **WHEN** a future station already has a file
- **THEN** the board shows the door on that station and the sidebar still has the gate button

#### Scenario: A pool cycle sets a gate

- **WHEN** a pool cycle has no plaque and the manager turns off `proposing`
- **THEN** the four gate stations are buttons, `tasking` is a dot, the click adds `sdd:auto-plan`, and the window does not write a phase or `accepted`

#### Scenario: Accepting sets auto-merge

- **WHEN** the manager turns off `accepting` on a pool cycle
- **THEN** the click adds `sdd:auto-merge` and does not add `accepted` or write a phase

#### Scenario: The last gate asks before it clears

- **WHEN** three gates are already off and the manager turns off the last one
- **THEN** the window asks, the label stays, dismissing the question writes nothing, and confirming adds `sdd:auto-merge` without `accepted`

#### Scenario: An auto label does not clear the wait

- **WHEN** the cycle has `sdd:wait-human` and the manager sets `sdd:auto-spec`
- **THEN** `sdd:wait-human` remains

#### Scenario: A station behind the plaque with no file is a dot

- **WHEN** the plaque is on `implementing` and `tasking` has no file
- **THEN** `tasking` is a dot and is not a button

### Requirement: A station door opens the port and does not write a phase

A door SHALL stand where the artifact already exists, behind the plaque and ahead of it. The current station SHALL NOT draw a circle. The window SHALL read file presence the same way focus reads a layer, and SHALL NOT write `sdd:focus` or compose gap text.

| Station        | Door                                                   |
| -------------- | ------------------------------------------------------ |
| `proposing`    | the change has `proposal.md`                           |
| `specifying`   | the change has `specs/<capability>/spec.md`            |
| `designing`    | the change has `design.md`                             |
| `tasking`      | the change has `tasks.md`                              |
| `implementing` | the single open pull request has a diff                |
| `verifying`    | the cycle state is `green`, `red`, or `pending`        |
| `accepting`    | the reason contains `мерж` and the issue is still open |

The door SHALL be a circle with the artifact icon: `plan`, `spec`, `design`, `tasks`, `code`, or the check mark. Several capabilities SHALL be one `spec` circle. A click on one file SHALL open the port address for that path at line 1 and SHALL NOT write a phase. When the port returns nothing, the circle SHALL stay a button and SHALL NOT navigate. A click on several `spec.md` files SHALL open this row. The board SHALL NOT list the capability ids under the cycle. The station width SHALL NOT change. A `note` or `out` marker SHALL NOT move the phase. The named layer's circle SHALL keep a small brass dot, and the plaque SHALL stay. A marker that moves the phase SHALL move the plaque with it, and SHALL NOT leave a separate gap behind.

#### Scenario: A file ahead of the plaque is a door

- **WHEN** the plaque is on `specifying` and the change has `proposal.md`
- **THEN** `proposing` shows a `plan` door

#### Scenario: A door opens the port and does not write a phase

- **WHEN** the manager clicks a `plan` door and the port returns an address
- **THEN** that address opens for `proposal.md` at line 1 and the phase was not written

#### Scenario: An empty port leaves the circle without a navigation

- **WHEN** the manager clicks a door and the port returns nothing
- **THEN** the circle stays a button and the window does not navigate

#### Scenario: Several specs open one list of capabilities

- **WHEN** the change has `specs/alpha/spec.md` and `specs/beta/spec.md` and the manager clicks the `spec` door
- **THEN** the row opens, the station stays one `spec` circle, and the board does not list the capability ids under the cycle

#### Scenario: The current station is the plaque

- **WHEN** the plaque is on `designing` and `design.md` exists
- **THEN** `designing` shows the plaque and does not show a `design` circle

#### Scenario: A note does not move the plaque

- **WHEN** a review thread's marker is `note` on the design layer and the phase is `implementing`
- **THEN** the phase stays `implementing` and the `design` door keeps a brass dot

### Requirement: A break opens one repair field

A row SHALL show at most one repair field, and that field SHALL be the first checkout break the window can write. The settings sheet SHALL NOT open for it. After the write the row SHALL be read again and the field SHALL go. The next break SHALL show its own field. Ask, a gate, the merge, children, and blockers SHALL NOT be a repair. A model or agent hole SHALL be a board row that names the slot. It SHALL NOT be a field on that row, SHALL NOT be a cycle popup, and SHALL NOT open the settings sheet. Play on the affected cycles SHALL stay disabled.

The window SHALL write:

- **Не назван сервис.** A service choice, including an empty string as the repository root on GitHub. The write is `sddService`.
- **Конфига сервиса нет.** One queue name, and the window creates the file. The write is `openspec/config.yaml`. Hooks, ignore, and branch scope SHALL NOT be in this field.
- **Нужна модель.** The board row names the empty slot.
- **Модель не запускается.** The board row names the slot and the rejected id.
- **Фабрике нужен агент.** The board row stays `фабрике ещё нужен агент`.

The window SHALL show the path or the reason and SHALL NOT draw a field for: **Каталога нет**, **Очереди нет в конфиге сервиса**, **Конфиг не читается**, and **Несколько pull request**. It SHALL NOT create a catalog, SHALL NOT append a queue, SHALL NOT write a broken edit, and SHALL NOT close a pull request. A checkout field SHALL live in the exclamation popup. A healthy closed row SHALL NOT show that sign. A model or agent hole SHALL stay a board row, with play left disabled, and SHALL NOT be a cycle popup.

#### Scenario: An unnamed service is a field in the exclamation popup

- **WHEN** the cycle's break is `не назван сервис`
- **THEN** the exclamation popup offers the service choice, an empty choice is the repository root, and the tile face does not show the field

#### Scenario: A missing catalog shows the reason and no field

- **WHEN** the checkout catalog is missing
- **THEN** the window shows `каталога нет` and does not create the catalog

#### Scenario: An empty model is a board row

- **WHEN** a model slot for the checkout is empty and the cycle has no checkout break
- **THEN** the board row names that slot, play stays disabled, and the cycle has no exclamation popup

#### Scenario: Several pull requests are not closed by the window

- **WHEN** two pull requests are open
- **THEN** the tile shows an exclamation and the window does not close a pull request

### Requirement: The board command serves this repository

`remote-solver board` SHALL serve the window for the GitHub repository of the working directory, print its URL, and run the machine spy in that same process. The home file SHALL be `~/.aifactory/config.yaml` when the command does not name one. When that file is missing, the watch list SHALL be that repository's `owner/repo`. Open issues that carry `sdd:cycle` SHALL be the cycles. The working directory SHALL be the gathered checkout for that repository, and an empty service SHALL mean that directory. Another repository on the watch list SHALL stay under the GitHub root. Take SHALL assign the process login. The window's spy SHALL add `sdd:proposing` for a phaseless cycle this manager holds. The machine spy SHALL start an agent for a cycle it would start from `remote-solver spy`. While that agent runs, the window SHALL treat the step as leading. The page SHALL show the spy's latest line. While the page stays open it SHALL read the tracker again about every 15 seconds. When the home agent is cursor, a step SHALL use that mode's model from the merged factory config. Any other home agent, and an empty agent, SHALL keep the built-in model for that mode.

#### Scenario: The home file is the factory file when the command names none

- **WHEN** the command does not name a home file
- **THEN** the home file is `~/.aifactory/config.yaml`

#### Scenario: The served page answers at its URL

- **WHEN** the board is served
- **THEN** a request to its URL returns the page

#### Scenario: Another repository stays under the GitHub root

- **WHEN** the working directory is the checkout of one repository and the watch list also has another repository
- **THEN** the other repository is gathered under the GitHub root

#### Scenario: The page reads the tracker again while it stays open

- **WHEN** the page stays open
- **THEN** it reads the tracker again about 15 seconds later

#### Scenario: The page pool lists a cycle in this repository

- **WHEN** the home file is missing, the working directory is a GitHub repository, and an open issue carries `sdd:cycle` and the queue label of the gathered checkout
- **THEN** the served page's pool contains that issue and omits an open issue without `sdd:cycle`

#### Scenario: A taken cycle gains proposing on the page

- **WHEN** this manager takes a phaseless cycle and the page loads
- **THEN** the cycle carries `sdd:proposing` and the plaque stands on proposing

#### Scenario: The working directory is the gathered checkout

- **WHEN** the board's checkout is this repository's directory and the GitHub root does not contain it
- **THEN** the pool card gathers that directory

#### Scenario: The spy starts an agent for a proposing cycle

- **WHEN** this manager holds a proposing cycle with no proposal and the board's spy polls
- **THEN** an agent run starts for that issue while the window treats the step as leading, and the spy line names the run

#### Scenario: The page shows the spy line

- **WHEN** the spy's latest line is set
- **THEN** the page shows that line

#### Scenario: A cursor home model is the step model

- **WHEN** the home agent is cursor and the mechanical model is `custom-mechanical`
- **THEN** a mechanical step uses `custom-mechanical`

#### Scenario: An empty home agent keeps the built-in model

- **WHEN** the home file names no agent and names a mechanical model
- **THEN** a mechanical step uses the built-in mechanical model

#### Scenario: A home agent other than cursor keeps the built-in model

- **WHEN** the home agent is not cursor and the mechanical model is set
- **THEN** a mechanical step uses the built-in mechanical model
