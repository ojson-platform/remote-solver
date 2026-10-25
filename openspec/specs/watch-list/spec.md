# watch-list

## Purpose

The watch list is the Tracker queues or the GitHub repositories one running ai-factory follows. The board and the window's spy both read it. Each read builds one list from the home config and the service overlays. A checkout is gathered from `sddService`.

## Requirements

### Requirement: The board and the window's spy read one watch list

The board and the window's spy SHALL read one watch list. The pool and the columns SHALL read the same union. A running ai-factory SHALL carry one adapter set, Tracker or GitHub, chosen by the launch. There SHALL be no system key. Two processes SHALL NOT share the list. Tracker entries SHALL be queue names. GitHub entries SHALL be repository names `owner/repo`. The machine's spy SHALL NOT read this list. Its intake SHALL be the service queue label together with `sdd:cycle` and an assignee that is already its login. It SHALL NOT read `.aifactory`.

#### Scenario: The pool and the columns share the list

- **WHEN** the watch list names one Tracker queue
- **THEN** the pool and the columns both read cycles of that queue and no other queue

#### Scenario: The machine's spy ignores a bare cycle label

- **WHEN** the machine runs without the window, a cycle carries `sdd:cycle`, and the assignee is unset
- **THEN** the machine's spy does not take that cycle in

### Requirement: Each read rebuilds the list from the files

Each read SHALL build the list again from the files, not from the previous union. Names in an overlay `watch` SHALL join the home `watch`. A repeated name SHALL be one name. Removing a name from one file SHALL leave it while another file still has it. A name that remains in no file SHALL leave the list. The process SHALL start from the files and repeat while a newly found overlay adds a name, until names stop being added. A catalog with no overlay file SHALL add nothing. When both lists are empty, the board SHALL have no cards. `sdd.queues` SHALL NOT be part of the union. The order of names SHALL NOT choose a cycle's queue. The first queue in the service config SHALL remain the queue of a new child. The user block SHALL write the home list immediately. The overlay group SHALL write that checkout's list immediately.

#### Scenario: An overlay name joins the home list

- **WHEN** home `watch` is `alpha` and one overlay `watch` is `beta`
- **THEN** the watch list is `alpha` and `beta`

#### Scenario: A name on either file remains

- **WHEN** the manager removes `alpha` from home and an overlay still has `alpha`
- **THEN** the watch list still has `alpha`

#### Scenario: Both lists empty means no cards

- **WHEN** home `watch` is empty and no overlay adds a name
- **THEN** the board has no cards

#### Scenario: Service queues do not join the list

- **WHEN** `sdd.queues` names `gamma` and neither watch list has `gamma`
- **THEN** the watch list does not have `gamma`

### Requirement: A Tracker queue is the port field

A Tracker cycle SHALL be in the selection when the queue it lies in is on the watch list. That queue SHALL be one port field. A label of another queue SHALL NOT replace it. The cycle's queue SHALL be in `sdd.queues` of the service named by `sddService`. When it is not, the cycle SHALL stay in the pool, the icon reason SHALL start with `очереди нет в конфиге сервиса`, and «Взять» SHALL look disabled and SHALL NOT write the assignee. The sidebar SHALL show that same line. A cycle with the same break SHALL stay in its column, the card SHALL have the icon, and steps SHALL NOT start. The window SHALL NOT move the queue and SHALL NOT append it to the service config.

#### Scenario: The port field selects the cycle

- **WHEN** the cycle's port queue is on the watch list and a label names a different queue
- **THEN** the board reads the cycle by the port queue

#### Scenario: A queue missing from the service config blocks Take

- **WHEN** the cycle is on the watch list and its queue is not in that service's `sdd.queues`
- **THEN** the card stays, «Взять» does not write the assignee, and the reason starts with `очереди нет в конфиге сервиса`

### Requirement: A GitHub queue is a label in sdd.queues

A GitHub cycle SHALL be in the selection when its repository `owner/repo` is on the watch list. The repository name SHALL be the watch-list key. The cycle's queue SHALL be the label `queueOf` finds in `sdd.queues`. When several names match, the queue SHALL be the first name in `sdd.queues` that is on the issue. When none match, the card SHALL have the queue break above. `sdd:cycle` SHALL still be required.

#### Scenario: The first matching queue name wins

- **WHEN** `sdd.queues` lists `alpha` then `beta`, and the issue has both labels
- **THEN** the cycle's queue is `alpha`

#### Scenario: No matching label is a break

- **WHEN** the repository is on the watch list and no `sdd.queues` name is on the issue
- **THEN** the card has the queue break and «Взять» does not write the assignee

### Requirement: A checkout is gathered from sddService

The checkout SHALL be the directory gathered from `sddService`. A worktree and the launch directory SHALL NOT be that checkout. The step and the overlay SHALL read that gathered checkout. A path with `..`, or a path outside the root, SHALL be the same break as a missing catalog. Both roots SHALL live in the home file. The user block SHALL write them immediately. The overlay SHALL NOT replace them. A Tracker process SHALL read the Arcadia root. A GitHub process SHALL read the GitHub root. An empty value SHALL leave the default, `~/arcadia` or `~/github`.

Tracker SHALL gather `~/arcadia/<sddService>`. GitHub SHALL gather `~/github/<owner>/<repo>/<sddService>`. An empty `sddService` on GitHub SHALL be the repository root. «Взять» SHALL act on that root when the catalog exists and the cycle's queue is in its `sdd.queues`. An empty `sddService` on Tracker SHALL be the same break as a missing field: the Arcadia root SHALL NOT count as a service.

#### Scenario: Tracker gathers under the Arcadia root

- **WHEN** the Arcadia root is `~/arcadia` and `sddService` is `services/billing`
- **THEN** the checkout is `~/arcadia/services/billing`

#### Scenario: An empty root keeps the default

- **WHEN** the home Arcadia root is empty
- **THEN** Tracker gathers under `~/arcadia`

#### Scenario: GitHub empty sddService is the repository root

- **WHEN** a GitHub cycle has an empty `sddService` and the repository is `acme/billing`
- **THEN** the checkout is `~/github/acme/billing`

#### Scenario: A path outside the root is a missing catalog

- **WHEN** `sddService` contains `..` and leaves the root
- **THEN** the card has the same break as a missing catalog

### Requirement: A missing field offers a choice

When `sddService` is missing, the card SHALL offer a choice and «Взять» SHALL NOT act, and the reason SHALL start with `не назван сервис`. A blank Tracker `sddService` SHALL be that same missing field. On Tracker that choice SHALL be the services of the checkouts already read whose `sdd.queues` already contains this queue. One such service SHALL be written by itself. On GitHub the choice SHALL be the directories that have `openspec/config.yaml` with an `sdd` key, including the repository root. One such directory SHALL be written by itself. Several SHALL be a choice. An unreadable service config SHALL NOT offer the choice on a vanished card. After the write, the card SHALL be reread. When the queue is still absent from the service config, the previous reason SHALL remain. The window SHALL NOT create a catalog.

#### Scenario: One Tracker service writes itself

- **WHEN** a Tracker cycle has no `sddService` and exactly one read checkout has this queue in `sdd.queues`
- **THEN** the window writes that service as `sddService` and rereads the card

#### Scenario: Several Tracker services stay a choice

- **WHEN** a Tracker cycle has no `sddService` and more than one read checkout has this queue in `sdd.queues`
- **THEN** the card offers those services, the reason starts with `не назван сервис`, and «Взять» does not act

#### Scenario: One GitHub directory writes itself

- **WHEN** a GitHub cycle has no `sddService` and only the repository root has `openspec/config.yaml` with an `sdd` key
- **THEN** the window writes that root as `sddService`

#### Scenario: A queue that is still missing keeps the reason

- **WHEN** the manager writes `sddService` and that service's `sdd.queues` still lacks the cycle's queue
- **THEN** the reason stays `очереди нет в конфиге сервиса`

### Requirement: A missing catalog keeps the cycle card

When the gathered path does not exist, the cycle card SHALL remain, the icon reason SHALL be `каталога нет`, «Взять» SHALL NOT act, and the `sddService` choice SHALL remain. This SHALL NOT be the card of an `openspec/config.yaml` that does not parse.

#### Scenario: A missing directory leaves the card

- **WHEN** the gathered checkout path does not exist
- **THEN** the card remains, the reason is `каталога нет`, and «Взять» does not act
