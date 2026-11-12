# live-focus-page

## Purpose

The pager's open page is a live page in four cases. The closed plaque shows the shorter work lines.

## Requirements

### Requirement: The open page is a live page in four cases

The pager's open page SHALL be a live page in four cases. The window SHALL compute that page from the current decision and from whether a worker is on this issue. The live page SHALL NOT be an issue comment and SHALL NOT be a history slot. It SHALL disappear when the reason passes. Past live reasons SHALL NOT be pages.

#### Scenario: The pager's open page is a live page in four cases

- **WHEN** the pager's open page is already a live page in the four cases, a worker on this issue, a ready action the cap held back, a wait on another issue, and checks, together with the latest written page as the limit that can replace that live page
- **THEN** the pager's open page is a live page in four cases

#### Scenario: The window computes it from the current decision and from whether a worker is on this issue

- **WHEN** the current decision and whether a worker is on this issue are already visible, and the window already computes the live page from those, together with an issue comment as the limit that can replace that decision and that worker
- **THEN** the window computes the live page from the current decision and from whether a worker is on this issue

#### Scenario: It is not an issue comment, it is not a history slot, and it disappears when the reason passes

- **WHEN** the live page is already not an issue comment and already not a history slot, and it already disappears when the reason passes, together with that page remaining as a history slot after the reason passes as the limit that can replace that disappearance
- **THEN** it is not an issue comment, it is not a history slot, and it disappears when the reason passes

#### Scenario: Past live reasons are not pages

- **WHEN** past live reasons are already not pages, together with a past live reason as a page Back can open as the limit that can replace that
- **THEN** past live reasons are not pages

### Requirement: The live text is the case that holds

A worker on this issue SHALL make the text the catalog sentence for that action.

The next action that is ready and did not start because the cap is full SHALL make the text that next action.

When the cycle waits on a child, the text SHALL say the child is accepted, naming each key once.

A blocker SHALL be named once, the way the decision names that blocker.

#### Scenario: A worker on this issue shows the phase and the action

When checks are still running, the text SHALL say checks are still running.

When checks are red and the failure has not been handed to a worker yet, the text SHALL say checks are red and the failure has not been handed to a worker yet.

- **WHEN** a worker is already on this issue, the phase is already `specifying`, the action the machine gave the worker is already `create-initial-specs`, and the text is already that phase and that action, together with the next action `create-design` that the cap held back as the limit that can replace that phase and that action
- **THEN** the text is `Пишу спеки.`

#### Scenario: A full cap shows the next action

- **WHEN** the next action `create-design` is already ready and did not start because the cap is full, and the text is already `create-design`, together with a worker on this issue as the limit that can replace that next action
- **THEN** the text is `create-design`

#### Scenario: A wait on another issue names who and until which phase

- **WHEN** the cycle already waits on another issue, the decision already names child `12` and the wait already runs until `specified`, and the text already names `12` and `specified`, together with a name the decision does not use as the limit that can replace `12`
- **THEN** the text says `#12` will be accepted

#### Scenario: An implementing child is named until accepted

- **WHEN** the decision already names child `12` and the wait already runs until `accepted`, and the text already names `12` and `accepted`, together with `specified` as the limit that can replace `accepted`
- **THEN** the text says `#12` will be accepted

#### Scenario: A child and a blocker are named the way the decision names them

- **WHEN** the decision already names child `12` and blocker `7`, and the text already names `12` and `7` that same way, together with a different name for each as the limit that can replace those names
- **THEN** a child and a blocker are named the way the decision names them

#### Scenario: One number is named once

- **WHEN** `12` is already both the child and the blocker, the decision already names `12` once, and the text already names `12` once and the phase the wait runs until, together with naming `12` a second time as the limit that can replace naming that number once
- **THEN** the text names `12` once

#### Scenario: Checks still running

- **WHEN** checks are already still running, and the text already says checks are still running, together with checks that are red and whose failure has not been handed to a worker yet as the limit that can replace that text
- **THEN** the text says checks are still running

#### Scenario: Checks are red and the failure has not been handed to a worker yet

- **WHEN** checks are already red and the failure has not been handed to a worker yet, and the text already says that, together with checks that are still running as the limit that can replace that text
- **THEN** the text says checks are red and the failure has not been handed to a worker yet

### Requirement: The live page is the open page only in that order

Outside the review gate for the proposal, the spec, the design, or accepting, the live page SHALL be the open page only in those four cases, in this order. A worker on this issue SHALL win. Otherwise a ready action that the cap held back SHALL be the open page. Otherwise a wait on another issue, or checks, SHALL be the open page. Otherwise the latest written page SHALL stay open.

#### Scenario: A worker on this issue wins

- **WHEN** a worker is already on this issue, the phase is already `specifying`, the action is already `create-initial-specs`, a ready action `create-design` is already held because the cap is full, the cycle already waits on `12` until `specified`, checks are already still running, and the latest written page is already visible, together with that ready action, that wait, those checks, or that written page as the limit that can replace the worker
- **THEN** the open page is the live page, and the text is `Пишу спеки.`

#### Scenario: A ready action that the cap held back is the open page

- **WHEN** no worker is on this issue, the next action `create-design` is already ready and did not start because the cap is full, the cycle already waits on `12` until `specified`, checks are already still running, and the latest written page is already visible, together with that wait, those checks, or that written page as the limit that can replace `create-design`
- **THEN** the open page is the live page and the text is `create-design`

#### Scenario: A wait on another issue is the open page

- **WHEN** no worker is on this issue, no ready action is held by the cap, the cycle already waits on `12` until `specified`, checks are not the live case, and the latest written page is already visible, together with that written page as the limit that can replace the wait
- **THEN** the open page is the live page and the text names `12` and `specified`

#### Scenario: Checks are the open page

- **WHEN** no worker is on this issue, no ready action is held by the cap, the cycle does not wait on another issue, checks are already still running, and the latest written page is already visible, together with that written page as the limit that can replace those checks
- **THEN** the open page is the live page and the text says checks are still running

#### Scenario: The latest written page stays open

- **WHEN** no worker is on this issue, no ready action is held by the cap, the cycle does not wait on another issue, checks are not the live case, and the latest written page is already the open page, together with a past live reason as the limit that can replace that written page
- **THEN** the latest written page stays open

### Requirement: A review gate keeps the written focus and the ask

On the review gate for the proposal, the spec, the design, or accepting, the open page SHALL stay the written focus of that stop. The open row SHALL NOT show an ask block. On a review gate the plaque SHALL NOT take the live sentence.

#### Scenario: On the review gate for the proposal, the spec, the design, or accepting, the open page stays the written focus of that stop

- **WHEN** the review gate for the proposal, the spec, the design, or accepting is already on, and the open page already stays the written focus of that stop, together with the live page as the limit that can replace that written focus
- **THEN** on the review gate for the proposal, the spec, the design, or accepting, the open page stays the written focus of that stop

#### Scenario: Accepting keeps the written focus while checks are still running

- **WHEN** the review gate for accepting is already on, checks are already still running, and the open page already stays the written focus of that stop, together with the checks live page as the limit that can replace that written focus
- **THEN** the open page stays the written focus of the accepting stop

#### Scenario: The proposal gate keeps the written focus of that stop

- **WHEN** the review gate for the proposal is already on and the open page already stays the written focus of that stop, together with a ready action the cap held back as the limit that can replace that written focus
- **THEN** the open page stays the written focus of the proposal stop

#### Scenario: The spec gate keeps the written focus of that stop

- **WHEN** the review gate for the spec is already on and the open page already stays the written focus of that stop, together with a wait on another issue as the limit that can replace that written focus
- **THEN** the open page stays the written focus of the spec stop

#### Scenario: The design gate keeps the written focus of that stop

- **WHEN** the review gate for the design is already on and the open page already stays the written focus of that stop, together with a worker on this issue as the limit that can replace that written focus
- **THEN** the open page stays the written focus of the design stop

#### Scenario: The open row has no ask block on a live page

- **WHEN** the issue carries `sdd:wait-human`, a worker is on this issue, and an older comment is not focus
- **THEN** the open row has no ask block and the live page does not show that comment

#### Scenario: A live page does not show the ask comment

- **WHEN** the issue carries `sdd:wait-human` and the live page is showing
- **THEN** the open row has no ask block and the written focus remains

#### Scenario: On a review gate the plaque does not take the live sentence

- **WHEN** a review gate is already on, a live reason already holds, and the plaque already does not show the live sentence, together with the plaque showing that sentence as the limit that can replace that
- **THEN** on a review gate the plaque does not take the live sentence

### Requirement: The phase paints a tail on the open page

When the open page is the written focus, the phase SHALL append a tail the comment does not store. A proposal, spec, or design review gate SHALL append `Проверь и подтверди.` An open-question wait SHALL append the question count. An open-decision wait SHALL append the decision count. A wait to merge the open pull request SHALL append `Архив записан локально. Отправь его и смержи #<id>.` An older pager page SHALL show the saved prose. Accepting SHALL NOT append the confirm tail.

#### Scenario: The proposal gate appends the confirm tail

- **WHEN** the open page is the written proposal focus and the settled decision is the proposal review gate
- **THEN** the open page ends with `Проверь и подтверди.` and the stored prose does not

#### Scenario: An older page keeps the saved prose

- **WHEN** an older written page is open
- **THEN** that page shows the saved prose and does not show `Проверь и подтверди.`

#### Scenario: Open questions append the count

- **WHEN** the open page is the written plan focus and one question is open
- **THEN** the open page ends with `Есть 1 открытый вопрос. Ответь на него.` and the stored prose does not

#### Scenario: Accepting does not append the confirm tail

- **WHEN** accepting waits to merge pull request 9 and the open page is the written focus
- **THEN** the page ends with `Архив записан локально. Отправь его и смержи #9.` and does not end with `Проверь и подтверди.`

### Requirement: A missing pull request is the only page

When the decision waits because there is no open pull request, the open page SHALL be `На этой фазе нет открытого пул-реквеста.` The pager SHALL be absent. Acceptance and Continue SHALL be absent.

#### Scenario: Specifying with no open pull request shows only that sentence

- **WHEN** specifying waits because there is no open pull request and an older focus comment exists
- **THEN** the open page is that sentence, the pager is absent, and Continue is absent

### Requirement: Several keys use a comma and и before the last

When a sentence names two keys, they SHALL be joined by `и`. When it names more than two, the keys SHALL be separated by a comma and the last SHALL be joined by `и`.

#### Scenario: Three children are listed with a comma

- **WHEN** the decision waits for children `#1`, `#2`, and `#3`
- **THEN** the text is `Жду, пока #1, #2 и #3 будут приняты.`

#### Scenario: Two blockers are joined by и

- **WHEN** the decision waits for blockers `#4` and `#5`
- **THEN** the text is `Жду блокеры #4 и #5.`

#### Scenario: Three open pull requests are listed with a comma

- **WHEN** the cycle stopped until one open pull request remains among `8`, `9`, and `10`
- **THEN** the text is `Открыты #8, #9 и #10. Оставь один.`

### Requirement: A plain wait is the ask

When the decision waits because `sdd:wait-human` is set and the wait has no review gate, the open page SHALL be the prose after the first line of the latest comment whose first line is `sdd:wait-human`. A robot prefix SHALL NOT hide that line. A later comment with another first line SHALL NOT replace it. When no such comment exists, the page SHALL be `Метка sdd:wait-human стоит.`

#### Scenario: The latest ask is the open page

- **WHEN** implementing waits because `sdd:wait-human` is set and the latest comment starts with that line
- **THEN** the open page is the prose under that line

#### Scenario: A later comment does not replace the ask

- **WHEN** a later comment does not start with `sdd:wait-human`
- **THEN** the open page stays the earlier ask

#### Scenario: No ask comment says the label is on

- **WHEN** `sdd:wait-human` is set and no comment starts with that line
- **THEN** the open page is `Метка sdd:wait-human стоит.`

#### Scenario: A robot prefix still marks the ask

- **WHEN** the comment's first line is the robot prefix plus `sdd:wait-human`
- **THEN** the open page is the prose under that line

### Requirement: A repeated refusal is the open page

When the decision waits because the same effect was refused, the open page SHALL be that refusal text. A worker line SHALL NOT replace it.

#### Scenario: A repeated refusal stays while a worker turn is set

- **WHEN** the decision reason is `refused implement-next-task: next open task` and a worker turn is set
- **THEN** the open page is that reason and does not show the working sentence

### Requirement: Open questions without a retelling are the page

When the decision waits on open questions or open decisions and the newest written focus is not that phase's retelling, the open page SHALL be the count sentence.

#### Scenario: Open questions without a plan focus are the page

- **WHEN** proposing waits on open questions, one question is open, and no plan focus is written
- **THEN** the open page is `Есть 1 открытый вопрос. Ответь на него.`

### Requirement: Checks before merge are the open page

When accepting waits because checks are not green before merge, the open page SHALL be `Перед мержем #<id> проверки ещё не зелёные.`

#### Scenario: Accepting names the pull request whose checks are not green

- **WHEN** accepting waits for green checks before merge of pull request 9 and a written accept focus exists
- **THEN** the open page is `Перед мержем #9 проверки ещё не зелёные.`

### Requirement: A refused archive is the open page

When the accept step's command refuses, the open page SHALL be the live page, including on accepting and including while a worker is on this issue. The text SHALL be what the command said. The plaque SHALL show `Архив отказал`. Another wait on accepting SHALL keep the written focus.

#### Scenario: A refused archive on accepting is the open page and the text is what the command said

- **WHEN** the phase is already `accepting`, the decision is already a refused archive, and the command already said `openspec validate --all --strict refused spec/board: Requirement text is very long (>500 characters)`, together with the written focus of accepting as the limit that can replace that live page
- **THEN** the open page is the live page and the text is `openspec validate --all --strict refused spec/board: Requirement text is very long (>500 characters)`

#### Scenario: A baseline with no requirement is that same page

- **WHEN** the decision already names `openspec/specs/section/spec.md` because the rebuilt spec would have no requirement, together with the written focus of accepting as the limit that can replace that live page
- **THEN** the open page is the live page and the text names `openspec/specs/section/spec.md`

#### Scenario: Another accepting wait keeps the written focus

- **WHEN** accepting already waits for a person and the written focus of that stop is already the open page, together with the live page of a refused archive as the limit that can replace that written focus
- **THEN** the open page stays that written focus

#### Scenario: The plaque shows the short archive refusal

- **WHEN** the plaque and the open page already see the refused archive, together with the plaque keeping `Done <done>/<done+open>` as the limit that can replace that text
- **THEN** the open page keeps the command text and the plaque says `Архив отказал`

### Requirement: The closed plaque shows the work, not the open-page sentence

The plaque SHALL show `Done <done>/<done+open>` and the open task id for the next code task, and SHALL NOT show that step's open-page sentence. When the step is over, the count SHALL stay. A child not yet specified SHALL be `Жду #<key>` only while tasks are not being written. A child not yet accepted SHALL be `Жду принятия #<key>`. That line SHALL NOT name a blocker, a worker, a cap, or checks.

#### Scenario: The plaque shows the count and the task

- **WHEN** `implement-next-task` is running, tasks are `Done 1/4`, and the open task id is `success-send`
- **THEN** the plaque shows `Done 1/4` and `success-send`, and does not show the open-page sentence

#### Scenario: That sentence leaves when the reason passes

- **WHEN** the step is over and tasks are `Done 0/2`
- **THEN** the plaque shows `Done 0/2` and does not show the action token

#### Scenario: The Done count stays when no live reason applies

- **WHEN** no live reason applies, the phase is `implementing`, and tasks are one done and three open
- **THEN** the plaque shows `Done 1/4`

#### Scenario: The child wait is only the unspecified child

- **WHEN** the phase is `tasking` and the phase row waits on child `12`
- **THEN** the plaque says `Жду #12` and does not name `7`, a worker, a cap, or checks

### Requirement: No written page leaves the live page as the only page

While no written page exists, the live page SHALL be the only page and Back SHALL do nothing.

#### Scenario: While no written page exists, the live page is the only page and Back does nothing

- **WHEN** no written page exists, the live page is already the only page, and Back already does nothing, together with a written page as the limit that can replace that only page and give Back a page to open
- **THEN** the live page is the only page and Back does nothing

### Requirement: The live badge is not a phase marker

The live page's badge SHALL be its own: `working` when a worker is on this issue, `waiting for a slot` when a ready action is held by the cap, `waiting on an issue` when the cycle waits on another issue, `checks` when checks are the live case, or `archive` when the accept step's command refused. The badge SHALL NOT be a phase marker.

#### Scenario: The badge is working

- **WHEN** a worker is already on this issue and the badge is already `working`, together with the phase marker `sdd:focus:spec` as the limit that can replace that badge
- **THEN** the badge is `working` and it is not a phase marker

#### Scenario: The badge is waiting for a slot

- **WHEN** a ready action is already held by the cap and the badge is already `waiting for a slot`, together with the phase marker `sdd:focus:spec` as the limit that can replace that badge
- **THEN** the badge is `waiting for a slot` and it is not a phase marker

#### Scenario: The badge is waiting on an issue

- **WHEN** the cycle already waits on another issue and the badge is already `waiting on an issue`, together with the phase marker `sdd:focus:spec` as the limit that can replace that badge
- **THEN** the badge is `waiting on an issue` and it is not a phase marker

#### Scenario: The badge is checks

- **WHEN** checks are already the live case and the badge is already `checks`, together with the phase marker `sdd:focus:spec` as the limit that can replace that badge
- **THEN** the badge is `checks` and it is not a phase marker

#### Scenario: The badge is archive

- **WHEN** the accept step's command has already refused and the badge is already `archive`, together with the phase marker `sdd:focus:accept` as the limit that can replace that badge
- **THEN** the badge is `archive` and it is not a phase marker

### Requirement: Opening the sidebar, a worker starting, and a new written comment return the block to now

Opening the sidebar, a worker starting, and a new written comment SHALL each return the block to now. While one of the four cases holds and a review gate does not, now SHALL be the live page. Otherwise now SHALL be the latest written page.

#### Scenario: Opening the sidebar returns the block to now

- **WHEN** an older written page is already open, one of the four cases already holds, a review gate does not, and opening the sidebar already returns the block to the live page, together with staying on that older page as the limit that can replace now
- **THEN** opening the sidebar returns the block to now

#### Scenario: A worker starting returns the block to now

- **WHEN** an older written page is already open, a worker is already starting, the phase is already `specifying`, the action is already `create-initial-specs`, and the block already returns to the live page, together with staying on that older page as the limit that can replace now
- **THEN** a worker starting returns the block to now, and the text is `Пишу спеки.`

#### Scenario: A new written comment returns the block to now

- **WHEN** an older written page is already open, a new written comment is already visible, one of the four cases already holds, a review gate does not, and the block already returns to the live page, together with that new written comment as the limit that can replace now
- **THEN** a new written comment returns the block to now
