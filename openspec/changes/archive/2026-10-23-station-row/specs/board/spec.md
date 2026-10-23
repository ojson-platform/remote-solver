## RENAMED Requirements

- FROM: `### Requirement: The board is a pool and seven columns`
- TO: `### Requirement: The board is a column of keys and seven stations`
- FROM: `### Requirement: A column card shows the key, the title, the icon, the reason, the phase row, and gaps`
- TO: `### Requirement: A plaque shows the top and the bottom in order`

## MODIFIED Requirements

### Requirement: The board is a column of keys and seven stations

The board SHALL show one column of keys and seven stations, left to right: `proposing`, `specifying`, `designing`, `tasking`, `implementing`, `verifying`, `accepting`. An empty station SHALL keep the same width as the others. The window SHALL NOT collapse an empty station and SHALL NOT replace a plaque with a dot. The key column SHALL stay when the pool is empty, and an empty pool SHALL draw no tile. Cycles whose assignee is this manager and that already have a phase SHALL stand above the pool. The window SHALL NOT add a control that sets a phase. The window is the surface of one running ai-factory. It SHALL NOT be a tracker page and SHALL NOT be the agent chat, and a running step SHALL NOT have a panel of its own.

#### Scenario: An empty station stays the same width

- **WHEN** no cycle stands in `specifying`
- **THEN** the `specifying` station is still on the board and has the same width as `proposing`

#### Scenario: The window adds no phase control

- **WHEN** the manager opens a row
- **THEN** the window offers no control that writes a phase label

#### Scenario: An empty pool draws no tile

- **WHEN** the pool has no ticket
- **THEN** the key column remains and the pool draws no tile

### Requirement: A gate shares the column of the phase it closes

A cycle on `proposed` SHALL stand on `proposing`, a cycle on `specified` SHALL stand on `specifying`, and a cycle on `designed` SHALL stand on `designing`. Those gates SHALL NOT have stations of their own. The station name SHALL be the phase the gate closes.

#### Scenario: Proposed stands in proposing

- **WHEN** a cycle carries `proposed` and the assignee is this manager
- **THEN** the plaque stands on the `proposing` station

#### Scenario: Specified stands in specifying

- **WHEN** a cycle carries `specified` and the assignee is this manager
- **THEN** the plaque stands on the `specifying` station

### Requirement: Take writes this process login

A play sign on a ticket SHALL write the assignee as the login of this process and SHALL NOT write a phase. Its accessible name SHALL be «Взять». The word «Взять» SHALL NOT be the button's text. On GitHub that login SHALL be the login of `gh api user`. The window's spy SHALL set `proposing` after that write when the merged factory config can start a step, and the plaque SHALL then stand on `proposing`. Dragging the tile onto a station SHALL be the same gesture: the station under the pointer SHALL show a ring, and the phase SHALL NOT be taken from the station where the tile is dropped. While the home config is missing, play SHALL look disabled and SHALL NOT write the assignee. An exclamation SHALL replace play when a checkout break or two open pull requests silence «Взять» for that ticket. The break phrase SHALL NOT be on the tile face. When «Взять» is silent because the home config is missing or the merged factory config cannot start a step, play SHALL stay on the corner and look disabled, and the reason SHALL be a board row, not a ticket popup. A cycle whose assignee is already this manager SHALL NOT show play.

#### Scenario: Take on a phaseless ticket writes the login only

- **WHEN** the manager takes a ticket that has no phase and the merged factory config can start a step
- **THEN** the assignee becomes this process login, the phase was not written by «Взять», and the window's spy then sets `proposing`

#### Scenario: Take does nothing without a home config

- **WHEN** the home config file is absent and the manager uses «Взять»
- **THEN** the assignee stays unset

#### Scenario: Play is named Take and is not the button text

- **WHEN** a phaseless ticket can be taken
- **THEN** the control's accessible name is «Взять» and the button text is not «Взять»

#### Scenario: A drop on a station does not write the phase

- **WHEN** the manager drops a phaseless ticket on the `implementing` station and a step can start
- **THEN** the assignee is written and that drop did not write a phase

#### Scenario: An exclamation replaces play on this ticket's break

- **WHEN** a pool ticket has a checkout break or two open pull requests
- **THEN** the tile shows an exclamation instead of play and does not show the break phrase on its face

#### Scenario: A board-wide silence leaves play disabled

- **WHEN** the merged factory config cannot start a step and the ticket has no checkout break and one open pull request
- **THEN** play stays on the corner, looks disabled, and the reason is a board row

### Requirement: A healthy pool card shows Take

A pool tile with no checkout break and without two open pull requests SHALL show the key, the title, and a play sign named «Взять», ordered by key. A pool tile with a checkout break or two open pull requests SHALL show an exclamation instead of play, and «Взять» SHALL NOT act. The break phrase SHALL NOT be on the tile face.

#### Scenario: A healthy pool card has no icon

- **WHEN** a pool ticket has no checkout break and one open pull request
- **THEN** the tile shows the key, the title, and play, and does not show an exclamation

#### Scenario: A broken pool card disables Take

- **WHEN** a pool ticket has a checkout break
- **THEN** the tile shows an exclamation instead of play, and «Взять» does not write the assignee

### Requirement: A plaque shows the top and the bottom in order

The tile SHALL show the full key and the title. The plaque SHALL be a button on the station of the cycle's phase. A click SHALL open the row and SHALL NOT write a phase. The top and the bottom SHALL be the first match, in the order below. The window SHALL NOT compose that text.

The top, in order:

1. `ask`, while the cycle has `sdd:wait-human`.
2. The layer names the latest `sdd:focus` did not mark `solid`, in focus order, joined by ` · `.
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

### Requirement: The icon is hidden while a step runs or checks are waited

The window SHALL record an icon occasion for a gate, an ask, an open question, an open decision, the merge, a child, a blocker, several pull requests, or a checkout break. It SHALL NOT draw that occasion as one lettered icon on the tile or the plaque. A ticket break SHALL be the exclamation on the tile. A future gate SHALL be Gandalf or a circle. Current work SHALL be the plaque. Children and blockers SHALL stay words on the reason line. While an agent leads a step, or the cycle waits on checks, the plaque SHALL keep its text and SHALL NOT add an occasion mark. The row order SHALL keep that occasion.

#### Scenario: A gate shows the icon

- **WHEN** a cycle stands on `proposed` and no step is running and checks are not waited
- **THEN** the occasion is recorded and the tile shows no lettered icon

#### Scenario: A running step hides the icon

- **WHEN** an agent is leading a step and the cycle has an ask
- **THEN** the plaque keeps its text and shows no occasion mark

### Requirement: Column order follows the icon occasion

In the key column, cycles this manager already holds SHALL come first. Inside that group, cards that have an icon occasion SHALL come first, even when the mark is hidden. Inside that group, and among the rest, cards SHALL be ordered by key. Pool tickets SHALL follow, ordered by key.

#### Scenario: A hidden icon still sorts first

- **WHEN** one card has an icon occasion and the mark is hidden because a step is running, and another card has no occasion
- **THEN** the card with the occasion stands above the other, and both are ordered by key inside their group

## ADDED Requirements

### Requirement: A future gate sets or clears one auto label

A human gate exists on `proposing`, `specifying`, `designing`, and `accepting`. On a row that has a plaque, the sign SHALL stand only ahead of the plaque and only while that station has no file. On a pool ticket with no plaque, the sign SHALL stand on each of those four stations. When the gate is on, the sign SHALL be Gandalf and its accessible name SHALL be «Снять гейт» plus the station name. A click SHALL write that one label: `sdd:auto-plan`, `sdd:auto-spec`, `sdd:auto-design`, or `sdd:auto-merge`. The click SHALL NOT write a phase, `proposed`, `specified`, `designed`, or `accepted`. When the gate is off, the sign SHALL be an empty circle and its accessible name SHALL be «Поставить гейт» plus the station name. A click SHALL remove that one label. A started or passed station SHALL NOT show the button on the board, and a board click SHALL NOT change the label there. When a future station already has a door, the board SHALL show the door. A click SHALL NOT remove `sdd:wait-human`. A station with no gate and no file SHALL be a dot, including a station behind the plaque. A dot SHALL NOT be a button. `accepted` SHALL NOT be set by this button. Removing the last gate that is still on SHALL ask before the write. The question SHALL say that the ticket will be left without control. Dismissing it SHALL leave the label as it was. Confirming it SHALL write that one label.

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

#### Scenario: A pool ticket sets a gate

- **WHEN** a pool ticket has no plaque and the manager turns off `proposing`
- **THEN** the four gate stations are buttons, `tasking` is a dot, the click adds `sdd:auto-plan`, and the window does not write a phase or `accepted`

#### Scenario: Accepting sets auto-merge

- **WHEN** the manager turns off `accepting` on a pool ticket
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

| Station | Door |
| --- | --- |
| `proposing` | the change has `proposal.md` |
| `specifying` | the change has `specs/<capability>/spec.md` |
| `designing` | the change has `design.md` |
| `tasking` | the change has `tasks.md` |
| `implementing` | the single open pull request has a diff |
| `verifying` | the cycle state is `green`, `red`, or `pending` |
| `accepting` | the reason contains `мерж` and the issue is still open |

The door SHALL be a circle with the artifact icon: `plan`, `spec`, `design`, `tasks`, `code`, or the check mark. Several capabilities SHALL be one `spec` circle. A click on one file SHALL open the port address for that path at line 1 and SHALL NOT write a phase. When the port returns nothing, the circle SHALL stay a button and SHALL NOT navigate. A click on several `spec.md` files SHALL open this row. The board SHALL NOT list the capability ids under the ticket. The station width SHALL NOT change. A `note` or `out` marker SHALL NOT move the phase. The named layer's circle SHALL keep a small brass dot, and the plaque SHALL stay. A marker that moves the phase SHALL move the plaque with it, and SHALL NOT leave a separate gap behind.

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
- **THEN** the row opens, the station stays one `spec` circle, and the board does not list the capability ids under the ticket

#### Scenario: The current station is the plaque

- **WHEN** the plaque is on `designing` and `design.md` exists
- **THEN** `designing` shows the plaque and does not show a `design` circle

#### Scenario: A note does not move the plaque

- **WHEN** a review thread's marker is `note` on the design layer and the phase is `implementing`
- **THEN** the phase stays `implementing` and the `design` door keeps a brass dot

### Requirement: A break opens one repair field

A row SHALL show at most one repair field, and that field SHALL be the first checkout break the window can write. The settings sheet SHALL NOT open for it. After the write the row SHALL be read again and the field SHALL go. The next break SHALL show its own field. Ask, a gate, the merge, children, and blockers SHALL NOT be a repair. A model or agent hole SHALL be a board row that names the slot. It SHALL NOT be a field on that row, SHALL NOT be a ticket popup, and SHALL NOT open the settings sheet. Play on the affected tickets SHALL stay disabled.

The window SHALL write:

- **Не назван сервис.** A service choice, including an empty string as the repository root on GitHub. The write is `sddService`.
- **Конфига сервиса нет.** One queue name, and the window creates the file. The write is `openspec/config.yaml`. Hooks, ignore, and branch scope SHALL NOT be in this field.
- **Нужна модель.** The board row names the empty slot.
- **Модель не запускается.** The board row names the slot and the rejected id.
- **Фабрике нужен агент.** The board row stays `фабрике ещё нужен агент`.

The window SHALL show the path or the reason and SHALL NOT draw a field for: **Каталога нет**, **Очереди нет в конфиге сервиса**, **Конфиг не читается**, and **Несколько pull request**. It SHALL NOT create a catalog, SHALL NOT append a queue, SHALL NOT write a broken edit, and SHALL NOT close a pull request. A checkout field SHALL live in the exclamation popup. A healthy closed row SHALL NOT show that sign. A model or agent hole SHALL stay a board row, with play left disabled, and SHALL NOT be a ticket popup.

#### Scenario: An unnamed service is a field in the exclamation popup

- **WHEN** the ticket's break is `не назван сервис`
- **THEN** the exclamation popup offers the service choice, an empty choice is the repository root, and the tile face does not show the field

#### Scenario: A missing catalog shows the reason and no field

- **WHEN** the checkout catalog is missing
- **THEN** the window shows `каталога нет` and does not create the catalog

#### Scenario: An empty model is a board row

- **WHEN** a model slot for the checkout is empty and the ticket has no checkout break
- **THEN** the board row names that slot, play stays disabled, and the ticket has no exclamation popup

#### Scenario: Several pull requests are not closed by the window

- **WHEN** two pull requests are open
- **THEN** the tile shows an exclamation and the window does not close a pull request
