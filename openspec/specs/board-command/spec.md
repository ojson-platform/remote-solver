# board-command

## Purpose

`remote-solver board` serves the window for this repository and runs the machine spy in that process.

## Requirements

### Requirement: The board command serves this repository

`remote-solver board` SHALL serve the window for the GitHub repository of the working directory, print its URL, and run the machine spy in that same process. The home file SHALL be `~/.aifactory/config.yaml` when the command does not name one. When that file is missing, the watch list SHALL be that repository's `owner/repo`. Open issues that carry `sdd:cycle` SHALL be the cycles. The working directory SHALL be the gathered checkout for that repository, and an empty service SHALL mean that directory. Another repository on the watch list SHALL stay under the GitHub root. Take SHALL assign the process login. The window's spy SHALL add `sdd:proposing` for a phaseless cycle this manager holds. The machine spy SHALL start an agent for a cycle it would start from `remote-solver spy`. While that agent runs, the window SHALL treat the step as leading. While a worker is on a turn, the page SHALL show that issue, its phase, and its action, as `#<issue> <phase> → <action>`. A later turn of the same worker SHALL replace that line. When the worker leaves the turn, that line SHALL go, and another worker's line SHALL stay. While the page stays open it SHALL read the tracker again about every minute. That read SHALL learn whether the one open pull request differs from its base without reading the diff text. A spy poll that already read the tracker SHALL paint the page from that reading and SHALL NOT read the tracker again for that poll. When that poll matches the tickets, the review, and the branch fingerprints already stored, the generation SHALL stay. When that reading includes the threads and the conversation of one open pull request, the page SHALL show that thread and SHALL NOT read those threads or pull request comments again. A cycle the spy did not read SHALL still have its threads read when the page refreshes. The spy SHALL read an open pull request's threads once. When the home agent is cursor, a step SHALL use that mode's model from the merged factory config. Any other home agent, and an empty agent, SHALL keep the built-in model for that mode.

`GET /snapshot` SHALL return a JSON snapshot of the header, the rows, and the open cycle's spine. When a cycle's branch summary is already stored, the snapshot SHALL build that cycle's plaque from the summary and SHALL NOT open the branch again for the plaque. `GET /` SHALL remain an HTML page that loads the client. `GET /events` SHALL be a server-sent stream of `change` events carrying the generation. A successful `POST /act` or `POST /take` SHALL return that snapshot as JSON. A refused gesture SHALL stay a text error. The snapshot generation SHALL start at 0 and SHALL grow when the turn changes, when a tracker read commits a change to the tickets, the review, or a branch fingerprint, and when a gesture is written. Reading the page, a refused gesture, setting the same turn again, and a tracker read that matches the tickets, the review, and the branch fingerprints SHALL NOT grow it. An open client SHALL receive a new generation without reloading the page. The snapshot's spy line SHALL be the current turn line, and that cycle's row SHALL carry the turn's action. When a plaque has no top line and no other bottom line, the snapshot's bottom line SHALL be the worker's action. When the open cycle is specifying and one pull request is open, the snapshot's Specify layer SHALL offer acceptance when `openspec/specs/acceptance/spec.md` offers it, and SHALL offer neither acceptance nor the specifying gate when it does not. An error the page would show between the header and the board SHALL be in the snapshot that is sent next, and SHALL be absent from the snapshot after that.

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
- **THEN** it reads the tracker again about a minute later, and the generation stays when that reading matches

#### Scenario: A spy poll paints from the reading it already has

- **WHEN** the spy finishes a poll
- **THEN** the page uses that reading and does not read the tracker again for the poll

#### Scenario: The board keeps the spy's threads

- **WHEN** the spy poll includes the threads and the conversation of a cycle's one open pull request
- **THEN** the page shows that thread and does not read the threads or the pull request comments again for that pull request

#### Scenario: A cycle outside the spy still reads threads

- **WHEN** the page refreshes a cycle the spy did not read and one pull request is open
- **THEN** the page reads that pull request's threads

#### Scenario: The spy reads a pull request's threads once

- **WHEN** the spy reads one open pull request
- **THEN** the threads are read once and the reading keeps the thread text

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
- **THEN** an agent run starts for that issue while the window treats the step as leading, and the spy line is `#6 proposing → create-proposal`

#### Scenario: The spy line follows the next turn and then goes

- **WHEN** one worker runs `create-proposal` and the next turn of that worker is `restore-baseline`
- **THEN** the spy line becomes `#6 specifying → restore-baseline` and is absent after the worker exits

#### Scenario: Another worker's line stays

- **WHEN** two workers are on a turn and one of them leaves
- **THEN** the page still shows the other worker's line

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

#### Scenario: The snapshot is JSON beside the page

- **WHEN** the board is served
- **THEN** `GET /snapshot` returns the snapshot as JSON and `GET /` returns the HTML page

#### Scenario: The snapshot names the current turn

- **WHEN** a worker is on `restore-baseline` for issue 6 while specifying
- **THEN** the snapshot's spy line is `#6 specifying → restore-baseline` and that row's action is `restore-baseline`

#### Scenario: The snapshot shows the action on an empty plaque

- **WHEN** specifying has no ask, phase row, or reason and the worker's action is `restore-baseline`, and tasking likewise has `create-tasks`
- **THEN** each snapshot plaque has no top line and its bottom line is that action

#### Scenario: The snapshot offers Specify acceptance for an empty delta

- **WHEN** the open cycle is specifying, one pull request is open, and the change has a delta file with no requirement
- **THEN** the snapshot's Specify layer offers acceptance

#### Scenario: The snapshot hides Specify acceptance during a spec turn

- **WHEN** the open cycle is specifying, one pull request is open, the change has a delta requirement, and the action is `create-initial-specs`
- **THEN** the snapshot's Specify layer offers neither acceptance nor the specifying gate

#### Scenario: The snapshot shows an error once

- **WHEN** a comment is empty and the snapshot is read
- **THEN** that snapshot contains the error and the next snapshot does not

#### Scenario: The snapshot generation moves

- **WHEN** a gesture is written, a tracker read changes a ticket, or the turn changes
- **THEN** the generation is higher, and a refused gesture, reading the page, setting the same turn again, and a tracker read that matches leave it unchanged

#### Scenario: An unchanged spy poll leaves the generation

- **WHEN** the spy finishes a poll whose tickets, review, and branch fingerprints match the copy
- **THEN** the generation stays

#### Scenario: A stored branch summary fills the plaque

- **WHEN** the page has stored a cycle's branch summary
- **THEN** a snapshot shows that summary on the plaque

#### Scenario: The minute read asks only whether the diff is empty

- **WHEN** the page refreshes a cycle with one open pull request
- **THEN** it asks whether the range differs and does not read the diff text

### Requirement: The header shows the factory mark

The header SHALL show a factory mark and then the name `AI FACTORY`. The served page SHALL link that same mark as its icon.

#### Scenario: The factory mark leads the name

- **WHEN** the board is served
- **THEN** the header shows the factory mark before `AI FACTORY`, and the page icon is that mark

### Requirement: The header opens settings with a gear

The header SHALL open settings with one gear. That control SHALL be a gear and SHALL NOT show the word `Настройки`.

#### Scenario: The header control is a gear

- **WHEN** the board is served
- **THEN** the header opens settings with a gear and does not show the word `Настройки` on that control
