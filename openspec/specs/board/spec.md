# board

## Purpose

The board is the part of the window that lays cycles out by phase. The manager takes a ticket from the pool. The window reads the phase row from the cycle and does not recompute it.

## Requirements

### Requirement: The board is a pool and seven columns

The board SHALL show a pool and seven columns, left to right: `proposing`, `specifying`, `designing`, `tasking`, `implementing`, `verifying`, `accepting`. An empty column and an empty pool SHALL remain. The window SHALL NOT add a control that sets a phase. The window is the surface of one running ai-factory. It SHALL NOT be a tracker page and SHALL NOT be the agent chat, and a running step SHALL NOT have a panel of its own.

#### Scenario: An empty column stays

- **WHEN** no cycle stands in `specifying`
- **THEN** the `specifying` column is still on the board

#### Scenario: The window adds no phase control

- **WHEN** the manager opens a card
- **THEN** the window offers no control that writes a phase label

### Requirement: A gate shares the column of the phase it closes

A cycle on `proposed` SHALL stand in `proposing`, a cycle on `specified` SHALL stand in `specifying`, and a cycle on `designed` SHALL stand in `designing`. Those gates SHALL NOT have columns of their own. The column name SHALL be the phase the gate closes.

#### Scenario: Proposed stands in proposing

- **WHEN** a cycle carries `proposed` and the assignee is this manager
- **THEN** the card stands in the `proposing` column

#### Scenario: Specified stands in specifying

- **WHEN** a cycle carries `specified` and the assignee is this manager
- **THEN** the card stands in the `specifying` column

### Requirement: A column shows this manager's cycles

A column SHALL show a cycle whose assignee is this window's manager. A cycle with a phase and another assignee SHALL NOT be shown. A cycle with a phase and no assignee SHALL stand in the pool. While the issue is open and the merge is still ahead, the card SHALL stand in `accepting` with icon reason `мерж`, and it SHALL leave when the issue closes. A card that carries `sdd:cancelled` SHALL leave, even when an earlier phase label remains.

#### Scenario: Another assignee is hidden

- **WHEN** a cycle has a phase and the assignee is not this manager
- **THEN** the window does not show that card

#### Scenario: A phase without an assignee stands in the pool

- **WHEN** a cycle has a phase and no assignee
- **THEN** the card stands in the pool

#### Scenario: Accepting shows the merge while the issue is open

- **WHEN** a cycle is in `accepting`, the issue is open, and the merge is still ahead
- **THEN** the card stands in `accepting` and the icon reason contains `мерж`

#### Scenario: Cancelled leaves the board

- **WHEN** an issue carries `sdd:cancelled` and an earlier phase label
- **THEN** the window shows no card for that issue

### Requirement: The pool holds tickets the manager can take

The pool SHALL hold open tickets on the watch list that carry `sdd:cycle`, have no phase, and have no assignee, and cycles that have a phase and no assignee. An issue without `sdd:cycle` SHALL NOT be in the pool. A ticket with no phase and another assignee SHALL be hidden. A ticket with no phase whose assignee is already this manager SHALL leave the pool when the merged factory config can start a step, and the window's spy SHALL set `proposing`. When that config cannot start a step, the card SHALL stay in the pool and «Взять» SHALL be disabled. Two open pull requests or a checkout break SHALL keep that card in the pool, and the spy SHALL NOT set `proposing`.

#### Scenario: A bare cycle label with no assignee is in the pool

- **WHEN** an open ticket on the watch list carries `sdd:cycle`, has no phase, and has no assignee
- **THEN** the card stands in the pool

#### Scenario: An issue without the cycle label is absent

- **WHEN** an open ticket on the watch list has no `sdd:cycle` label
- **THEN** the pool does not show it

#### Scenario: This manager's ticket enters proposing when a step can start

- **WHEN** a ticket has no phase, the assignee is already this manager, and the merged factory config can start a step
- **THEN** the window's spy sets `proposing` and the card leaves the pool

#### Scenario: This manager's ticket stays when a step cannot start

- **WHEN** a ticket has no phase, the assignee is already this manager, and the merged factory config cannot start a step
- **THEN** the card stays in the pool and «Взять» is disabled

#### Scenario: Two pull requests keep an assigned ticket in the pool

- **WHEN** a ticket has no phase, the assignee is already this manager, two pull requests are open, and a step can start
- **THEN** the spy does not set `proposing` and the card stays in the pool with reason `несколько pull request`

#### Scenario: A checkout break keeps an assigned ticket in the pool

- **WHEN** a ticket has no phase, the assignee is already this manager, the checkout is broken, and a step can start
- **THEN** the spy does not set `proposing` and the card stays in the pool

### Requirement: Take writes this process login

«Взять» on a ticket with no phase SHALL write the assignee as the login of this process and SHALL NOT write a phase. On GitHub that login SHALL be the login of `gh api user`. The window's spy SHALL set `proposing` after that write when the merged factory config can start a step, and the card SHALL move to the `proposing` column. Dragging a card from the pool onto the board SHALL be «Взять». While the home config is missing, «Взять» SHALL look disabled and SHALL NOT write the assignee.

#### Scenario: Take on a phaseless ticket writes the login only

- **WHEN** the manager takes a ticket that has no phase and the merged factory config can start a step
- **THEN** the assignee becomes this process login, the phase was not written by «Взять», and the window's spy then sets `proposing`

#### Scenario: Take does nothing without a home config

- **WHEN** the home config file is absent and the manager uses «Взять»
- **THEN** the assignee stays unset

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

- **WHEN** a pool ticket has two open pull requests and the manager uses «Взять»
- **THEN** the card stays in the pool, the assignee stays unset, and the icon reason is `несколько pull request`

#### Scenario: One pull request allows Take

- **WHEN** a pool ticket has one open pull request and the manager uses «Взять»
- **THEN** the assignee is written

### Requirement: A column card shows the key, the title, the icon, the reason, the phase row, and gaps

A column card SHALL show, top to bottom, the key, the title, and the icon; the icon reason on one line, and only together with the icon; the phase row; and the layer names the latest `sdd:focus` did not mark `solid`, in focus order, joined by ` · `. The tail of the icon reason SHALL be hidden on the card. Pointers and the why line SHALL NOT be on the card. When there is no `sdd:focus` comment, or every recorded layer is `solid`, that layer line SHALL be absent. The icon SHALL be one icon and SHALL carry no letters.

#### Scenario: A column card shows a gap layer

- **WHEN** the latest `sdd:focus` marks Plan `solid` and lists a gap on Specify
- **THEN** the card shows Specify and does not show Plan

#### Scenario: A solid focus adds no layer line

- **WHEN** the latest `sdd:focus` marks every recorded layer `solid`
- **THEN** the card has no layer line under the phase row

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

In a column, cards that have an icon occasion SHALL come first, even when the icon is hidden. Inside that group, and among the rest, cards SHALL be ordered by key.

#### Scenario: A hidden icon still sorts first

- **WHEN** one card has an icon occasion and the icon is hidden because a step is running, and another card has no occasion
- **THEN** the card with the occasion stands above the other, and both are ordered by key inside their group

### Requirement: The icon is hidden while a step runs or checks are waited

The card SHALL show the icon when the occasion is a gate, an ask, an open question, an open decision, the merge, a child, a blocker, several pull requests, or a checkout break. While an agent leads a step, or the cycle waits on checks, the card SHALL have no icon, even when an occasion already exists. The column order SHALL keep that occasion.

#### Scenario: A gate shows the icon

- **WHEN** a cycle stands on `proposed` and no step is running and checks are not waited
- **THEN** the card shows the icon

#### Scenario: A running step hides the icon

- **WHEN** an agent is leading a step and the cycle has an ask
- **THEN** the card shows no icon

### Requirement: The icon reason is one line

The icon reason SHALL be one line, the same line the sidebar shows in full. It SHALL start with at most one checkout break, in this order: `каталога нет`, otherwise `не назван сервис`, otherwise `конфига сервиса нет`, otherwise `очереди нет в конфиге сервиса`. The rest SHALL follow through ` · `, and only the parts the cycle has, in this order: the gate name `proposed`, `specified`, `designed`, or `accepted`; Ask; `вопросы N` for open questions; `решения N` for open decisions; `мерж`; `дети` and the Child keys in key order; `блокеры` and the Blocker keys in key order; `несколько pull request`. The window SHALL gather children from the same reading: records that carry `sdd:cycle` and whose `parent` is this card's key. It SHALL gather blockers from `dependsOn` on this record and find them in the same reading. It SHALL NOT parse the issue body. When the only occasion is questions, or only decisions, and the phase row already shows that number, the card SHALL NOT show the reason line. The sidebar reason block SHALL remain.

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

A pool card with no checkout break and without two open pull requests SHALL show the key, the title, and «Взять», ordered by key. A pool card with a checkout break or two open pull requests SHALL show the same icon and the same one reason, and «Взять» SHALL be disabled.

#### Scenario: A healthy pool card has no icon

- **WHEN** a pool ticket has no checkout break and one open pull request
- **THEN** the card shows the key, the title, and «Взять»

#### Scenario: A broken pool card disables Take

- **WHEN** a pool ticket has a checkout break
- **THEN** the card shows the icon and the reason, and «Взять» is disabled

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

When the agent answers and a model in the merged factory config is empty, the board SHALL show a row that names the checkout path and the empty skill mode: `нужна модель mechanical`, `нужна модель judgment`, or `нужны модели mechanical и judgment`. That row SHALL stop the window spy's steps for that service, and SHALL stop «Взять» on a ticket of that service that has no phase. It SHALL NOT stop «Взять» on a cycle that already has a phase. When a service-config row is also shown, the factory row SHALL come first. When the agent answers and a recorded model id is no longer accepted, the board SHALL show `модель не запускается` naming the checkout path, the skill-mode slot, and the id. The next step SHALL NOT start, and «Взять» for that service SHALL NOT act. Empty effort and empty speed SHALL NOT show these rows and SHALL NOT stop a step.

#### Scenario: Both models empty

- **WHEN** the agent answers and both skill-mode models are empty for a checkout
- **THEN** the row names that checkout path and says `нужны модели mechanical и judgment`, and «Взять» does not act for that service

#### Scenario: A rejected id names the slot

- **WHEN** the agent answers and rejects the recorded id of `judgment`
- **THEN** the row `модель не запускается` names the checkout path, `judgment`, and that id

#### Scenario: The factory row comes before the service-config row

- **WHEN** a checkout has an empty model and its service config does not read
- **THEN** the empty-model row is shown before `конфиг сервиса не читается`
