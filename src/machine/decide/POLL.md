# Poll

The order of one poll, what a run leaves, and the seam to the next poll. One cycle: an issue, its pull request, and its OpenSpec change.

A row names a scenario. The scenario is the behavior. This page is the order and the seam. When a row and its scenario disagree, the scenario wins and the row is edited to match, or the scenario changes in the same session.

Read this page before changing a phase decision, a skill hand-off, or what a run leaves for the next poll. Update the row in that same session.

The functions are `decide` (`open.ts`), `decideAhead` (`ahead.ts`), `decidePhase` (`phases.ts`), and `driveHeldIssue` (`src/main.ts`). The window, the reviewer, and the face are outside this page.

The first matching row in a table wins. A later table runs only when the earlier one decided nothing. The two wraps run after a decision exists and can replace it.

## Shared facts

Judged before the phase. `decideAhead`.

| When | Decision | Below is not read |
|---|---|---|
| Phase `cancelled` | `done`, reason `cancelled` | The rest of this table, consent, the phase |
| No phase label | `advance` to `proposing`, reason `enter the cycle` | The rest of this table, consent, the phase |
| Archive directory on the tip, a merged pull request, none open. The tip message may omit `Sdd-Archive` | `done`, reason `finished cycle`, after any child or blocker wait | The rest of this table, consent, the phase |
| Phase `accepted`, archive directory absent | `wait`, reason `the change is not archived` | The rest of this table, consent, the phase |
| Phase `accepted`, archive directory on the tip | Merge or wait for the open pull request. `auto-merge` is off on this path | The rest of this table, consent, the phase |
| Phase before `accepting`, tip message carries `Sdd-Archive`, nothing merged | `unarchive` | An unmarked thread, a conflict, the phase |
| An open thread has no marker and is not pinned to an open item, or the last conversation comment is a person's and has no marker | `classify-comments`, reason `unclassified review threads` | Rollback, the phase skill, archive |
| `implementing`, more than one open pull request, an open task, the card matches, and no earlier-phase thread | `implement-next-task` | Conflict and the phase's own writing rows |
| A pull request conflicts with its base, phase is `implementing` | `fix-implementation`, reason `rebase onto the base` | Rollback, the phase |
| A pull request conflicts with its base, any other phase | `advance` to `implementing`, reason `pull request conflicts with the base` | Rollback, the phase |
| An open thread marks an earlier phase. On `verifying`, the checks are already red or green | `advance` to the earliest such phase, reason `review thread sent the change back` | The phase skill |
| `specifying`, a Modified id has no baseline | `restore-baseline` | The specify skill and a spec thread |
| `specifying`, no delta file, an Added id `## Shelf` does not list, and no spec thread is open | `restore-baseline` | The specify skill. A spec thread and a delta file are read instead |
| An open thread marks this phase's layer | That layer's action: `improve-proposal`, `improve-specs`, `improve-design`, `improve-tasks`, or `fix-implementation` | The phase's own writing skill |
| `proposing`, `specifying`, or `designing`, and a thread counts for this phase | `wait`, reason `a thread on this phase is still open` | The review-gate ask |

Scenarios: `phase` / A cycle with no phase enters proposing. `phase` / Cancelled ends the cycle. `finished-cycle` / Accepting closes a merged archived cycle. `spec-archive` / Accepting closes after a later commit. `spec-archive` / Accepted closes after a later commit. `spec-archive` / A phase before accepting does not unarchive. `merge` / An archived change is restored before an unlabeled thread. `marker` / An unlabeled thread is classified during implementing. `marker` / An unanswered conversation on accepting is classified before the merge. `pull-request` / Several open pull requests hold the phase line. `verifying` / A merge conflict returns to implementing for a rebase. `marker` / A spec marker during implementing moves to specifying. `marker` / The earliest of two layers wins. `baseline` / Specifying restores a missing baseline before the delta. `baseline` / A spec thread waits for the missing baseline. `baseline` / An unjudged Added id is restored before the delta. `baseline` / An Added id is not restored once a delta exists. `marker` / A design marker during a held design review improves the design. `phase-thread-accept` / An unmarked thread is classified instead of the ask.

A thread on an unchecked Open decisions line is `design`. A thread on an unchecked Open questions line is `proposal`. The reply's marker does not replace that, except `fixed`. The thread is not unmarked. `marker` / An unmarked reply on an open decision is design. `marker` / A spec marker on an open decision stays on design.

A `code` marker on `proposal.md`, `design.md`, `tasks.md`, or a delta spec does not start `fix-implementation`. `marker` / A code marker on the design boundary stays on the suite.

A layer marker only on the pull-request conversation does not roll the phase back and does not start that layer's action. `marker` / A conversation code marker during implementing leaves the next task. `marker` / A conversation code marker on accepting does not move to implementing.

`out`, `note`, `fixed`, and `begin` do not move the phase. `marker` / Out does not move the phase.

## Consent and hold

Reached only when the shared facts decided nothing.

| When | Decision | Below is not read |
|---|---|---|
| `sdd:proposed`, `sdd:specified`, or `sdd:designed` matches the phase, a pull request is open, and nothing blocks the gate | `advance` to the next writing phase, comment `sdd:accept <phase> → <next>` | The phase's writing skill |
| `sdd:auto-plan`, `sdd:auto-spec`, or `sdd:auto-design` is on, `sdd:wait-human` is absent, a pull request is open, and nothing blocks the gate | `advance` to the next writing phase, reason the auto tag | The phase's writing skill |
| `sdd:wait-human` is on and the writing phase is ready | The review gate for that phase | The phase's writing skill |
| `sdd:wait-human` is on and the phase is not a ready writing phase | `wait`, reason the hold | The phase |

A person accept moves even while `sdd:wait-human` is on. An auto tag moves only when the hold is absent. A blocker is a missing file, an open question or open decision, or a stamp behind its input. `review-gate` / Proposed on a ready proposal moves to specifying. `review-gate` / Auto-plan advances a ready proposal. `review-gate` / Auto-spec does not lift an open review. `review-gate` / Accept refuses accepting.

The next writing phases are `proposing` → `specifying` → `designing` → `tasking`.

## The phase

Reached only when consent did not advance and the hold did not stop the poll. Inside a phase the first matching row wins.

### proposing

| When | Decision |
|---|---|
| No `proposal.md`, or no open pull request | `create-proposal` |
| An open question | `wait`, the open-question reason |
| Otherwise | Review gate `proposal`, toward `proposed` |

`artifact` / Proposing without a proposal writes one. `artifact` / A proposal with no pull request is published. `artifact` / Open questions hold proposing under auto-plan. `review-gate` / A published proposal is asked once.

### specifying

| When | Decision |
|---|---|
| No `proposal.md` | `advance` to `proposing`, reason `proposal.md is missing` |
| No open pull request | `wait`, reason `no open pull request` |
| The delta is not ready | `create-initial-specs` |
| The delta exists and its stamp is not the proposal revision | `improve-specs`, reason `the proposal revision is not the stamp` |
| Otherwise | Review gate `spec`, toward `specified` |

`artifact` / Specifying without a proposal returns to proposing. `artifact` / Specifying with a named capability writes the delta. `artifact` / Specifying with no named capability opens the review. `artifact` / A stale spec stamp restarts specify before the auto advance. `artifact` / A matching spec stamp still opens the gate. A proposal that names no capability and has no delta is ready: the stamp is not behind, and the poll opens the review gate.

### designing

| When | Decision |
|---|---|
| A named capability has no delta file | `advance` to `specifying`, reason `delta spec is missing` |
| No open pull request | `wait`, reason `no open pull request` |
| No `design.md` | `create-design` |
| An open decision | `wait`, the open-decision count |
| `design.md` exists, a capability is named or a delta file exists, and its stamp is not the specs revision | `create-design`, reason `the spec revision is not the stamp` |
| Otherwise | Review gate `design`, toward `designed` |

`artifact` / Designing without a delta returns to specifying. `artifact` / A stale design stamp restarts design before the auto advance. `artifact` / An open decision waits before a stale design stamp. `artifact` / Designing with no named capability stays without a delta. `review-gate` / Designed over an open decision stays, then asks. The no-capability scenario opens the design review gate. A proposal that names no capability does not take the return row. A design stamp that is not the revision of no spec files does not restart the design skill. `artifact` / An empty specs revision does not restart design. `improve-design` checks an open decision in the same commit, and the next poll reads the closed item. The wait row is the poll while the item is still open.

### tasking

| When | Decision |
|---|---|
| No `design.md` | `advance` to `designing`, reason `design.md is missing` |
| No open pull request | `wait`, reason `no open pull request` |
| No `tasks.md` | `create-tasks` |
| The tasks stamp is not the revision of the specs and the design | `create-tasks`, reason `the design revision is not the stamp` |
| The card revision is not the live delta, or a delta scenario is named on no card | `create-tasks` with that gap |
| A delta scenario has no task line | `create-tasks` with that gap |
| A child is not accepted, or a blocker is open | `wait` for that link |
| Otherwise | `advance` to `implementing`, reason `tasks exist` |

`artifact` / A stale tasks stamp restarts tasks before implementing. `artifact` / Tasking without a design returns to designing. `artifact` / Tasking without an open pull request waits. `dependencies` / A child still on specifying holds tasking. `dependencies` / A specified child does not let tasking move on. `dependencies` / An accepted child lets tasking move on. The card gap and the missing task line start `create-tasks` before the children. `artifact` / A card gap on tasking starts tasks before children. When the stamp matches and a card gap remains, the tasks prompt names the gap and says not to Publish. `artifact` / A matching tasks stamp names the card gap.

### implementing

| When | Decision |
|---|---|
| No `tasks.md` | `advance` to `tasking`, reason `tasks.md is missing` |
| The card revision is not the live delta, or a delta scenario is named on no card | `advance` to `tasking` with that gap |
| A delta scenario has no task line | `advance` to `tasking` with that gap |
| No open pull request, and a task is open or a baseline scenario is untraced | `wait`, reason `no open pull request` |
| A baseline scenario the delta kept has no spec-coverage trace | `cover-baseline`, reason `untraced baseline` |
| A task is open | `implement-next-task`, reason `next open task <id>` |
| A child is not accepted, or a blocker is open | `wait` for that link |
| Otherwise | `repair-suite`, reason `repair the suite` |

`artifact` / A differing card revision returns implementing to tasking. `artifact` / A live scenario with no card returns implementing to tasking. `artifact` / A matching card still runs the open task. `artifact` / A checked-off cut with an unsliced scenario returns to tasking. `artifact` / An untraced baseline runs before the open task. `dependencies` / Implementing waits for children and blockers after the tasks. The card gap and the missing task line are before the open task and before cover-baseline. `artifact` / Implementing without tasks returns to tasking. `artifact` / Implementing without an open pull request waits. One `implement-next-task` run checks that task, commits its test, and leaves `sdd:focus:code`. The phase stays `implementing`. `step-handoff` / Scenarios from two requirements are split before the task. `repair-suite` is the poll after the last open task. After the suite is green, its `after` hook reviews before Publish. A return does not Publish. A clean run with no commit and no return moves the issue to `verifying`. The focus marker is not a layer.

### verifying

| When | Decision |
|---|---|
| No open pull request | `wait`, reason `no open pull request` |
| Checks are red | `classify-failures`. The reason is `red checks` when no failure has a completion time. Otherwise it is `red checks` plus `name@completedAt` for each failed check. A cancelled check and a failure without a time are left out, so two completions are different decisions |
| Checks are neither red nor green | `wait`, reason `checks are <color>` |
| A child is not accepted, or a blocker is open | `wait` for that link |
| Otherwise | `advance` to `accepting`, reason `checks are green` |

`verifying` / Verifying without an open pull request waits. `verifying` / Red checks with no marker are classified. `verifying` / Two completions of one check are different decisions. `verifying` / A cancelled check is not the name. `verifying` / Pending checks wait. `verifying` / Green checks move to accepting. `dependencies` / A child that is not accepted holds verifying. `verifying` / A conflicting pull request leaves verifying for a rebase. `verifying` / Green checks with a design marker roll back.

A marker already moved the phase in the shared facts, before this table. Pending checks do not roll back. While the checks stay red, the next poll follows that marker and does not classify again.

### accepting

| When | Decision |
|---|---|
| No open pull request and nothing merged | `wait`, reason `no open pull request` |
| Archive directory absent, and a delta scenario has no task line | `wait` with that gap |
| Archive directory absent | `archive`, reason `archive the change` |
| Archived, one pull request is already merged, and another is still open | `wait`. Checks that are not green wait for green. Green checks wait for that open pull request. Does not merge, even when `sdd:auto-merge` is on |
| Archived, nothing merged yet, and the checks are not green | `wait` for green checks |
| Archived, nothing merged yet, checks green, `sdd:auto-merge` off | `wait` for the person to merge, one ask `Merge pull request #<id>.` |
| Archived, nothing merged yet, checks green, `sdd:auto-merge` on, one open pull request | `merge` |

`spec-archive` / Accepting starts the accept step. `spec-archive` / Accepting does not archive again. `artifact` / Accepting waits while a delta scenario has no task. `merge` / Accepting archives a change that is still open. `merge` / Auto-merge merges a green archived pull request. `merge` / Without auto-merge the person merges. `merge` / A merged pull request beside an open one stays open. `finished-cycle` / Accepting closes a merged archived cycle.

Accepting does not wait for children. The link wait is on tasking, implementing, and verifying. A merged pull request and none open do not reach this table. The shared facts close the issue and do not set `accepted`. `finished-cycle` / Accepting closes.

## Wraps

Applied to the decision the tables produced, in this order.

| When | Decision | What it replaces |
|---|---|---|
| `sdd:refused` matches this agent decision's phase, action, and reason | `wait`. The note is the refusal comment, or `refused <action>: <reason>` | That agent start. A different phase, action, or reason still starts. A person comment removes the label. A refusal `threads on <layer>` is removed when that layer has no open thread |
| More than one open pull request | `wait` until one remains | Every exit except `implement-next-task`, `cover-baseline`, `repair-suite`, `classify-comments`, `unarchive`, an earlier-phase rollback, a return to `tasking` for a card gap, and a wait that is not a gate and does not mention merge, archive, or finished |

`idle` / The same decision stays idle. `idle` / A person comment starts the effect. `idle` / A different action starts. `idle` / A closed code thread releases the refusal. `pull-request` / Several open pull requests hold the phase line.

## What a run leaves

`driveHeldIssue`. A commit is Publish. A new layer marker on a thread or on the conversation is Hand-off. A new thread with no layer marker is Hand-off. A `sdd:wait-human` gained in the run, or a new comment while that label is on, is Wait. `handedOff` counts a marker other than `note`, `fixed`, and `begin`.

| Outcome | Left in place | Next poll |
|---|---|---|
| One or more commits | The new tip. The next start of that action is a new chat | The poll reads the tip again |
| Hand-off or Wait, no commit | The marker or the wait label. `sdd:refused` is not posted. This drive reads the cycle again | The shared facts see the marker or the hold |
| A dirty worktree, no commit | The edited files. `sdd:refused` is not posted. This drive reads the cycle again | The same effect may start |
| No commit, no Hand-off, no Wait, a clean tree | `sdd:refused` with the phase, the action, and the reason, and the label | That effect does not start while the label matches |
| The same signature again after a run that did not commit | The drive stops. A second refusal is not posted for that stop | The label from the empty outcome still holds that effect |
| The run crashes before a commit | The chat stays. `sdd:refused` is not posted | The same decision resumes that chat. A second crash posts `sdd:refused` and does not start an agent |
| Another process holds the issue | No agent, and the decision is not marked idle | The next drive takes the hold once that process is gone |

`idle` / A commit starts a new chat. `idle` / A layer marker does not refuse the run. `idle` / A new unmarked thread does not refuse the run. `idle` / A conversation layer marker does not refuse the run. `idle` / A dirty worktree does not refuse the open task. `idle` / A run with no commit does not start again. `idle` / A crash resumes the same chat. `idle` / A second crash stays idle. `idle` / A held issue does not start an agent. `idle` / A dead holder releases the issue.

A drive stops when the decision is not an agent start. It also stops after 40 steps.

The skill for an action is `ACTION_SKILL` in `route.ts`.

## Seams

What a step leaves, and the poll that takes it. The step text lives in `skills/sdd-flow/steps/`. The poll behavior is the scenario.

| Leaves | Takes | Scenario |
|---|---|---|
| Plan publishes `proposal.md` and the pull request, and a question is open | The poll stays on proposing and waits. The printed wait carries `dialog` for each open question | `artifact` / Open questions hold proposing under auto-plan. `step` / Open questions are printed as a dialog |
| The chat records an answer on an open question | The next poll runs `improve-proposal` and prints no `dialog` | `step` / A thread on an open question is the proposal action |
| Plan publishes `proposal.md` and the pull request, and no question is open | The proposal review gate. `specifying` in the same poll only after `sdd:auto-plan` or `proposed` | `review-gate` / A published proposal is asked once |
| Specify publishes the delta and the stamp matches the proposal revision | The spec review gate. `designing` only after `sdd:auto-spec` or `specified` | `artifact` / A matching spec stamp still opens the gate |
| The delta exists and the spec stamp is behind the proposal revision | `improve-specs`, and does not advance | `artifact` / A stale spec stamp restarts specify before the auto advance |
| An open decision, even when the design stamp is behind | Wait on designing, before `create-design`. The printed wait carries `dialog` for each open decision on the issue branch | `artifact` / An open decision waits before a stale design stamp. `step` / Open decisions are printed as a dialog |
| The chat records an answer on an open decision | The next poll runs `improve-design` | `marker` / A design marker during a held design review improves the design |
| Design is published, the stamp matches the specs revision, and no decision is open | The design review gate. `tasking` in the same poll only after `sdd:auto-design` or `designed` | `review-gate` / The machine opens the review once. Its scenario is the proposal ask. The design ask has no scenario of its own |
| The tasks stamp records the revision of the specs and the design | `create-tasks` when the stamp is behind, before the advance to implementing | `artifact` / A stale tasks stamp restarts tasks before implementing |
| A card revision that is not the live delta, or a delta scenario named on no card | `advance` from implementing to tasking before the open task | `artifact` / A differing card revision returns implementing to tasking. `artifact` / A live scenario with no card returns implementing to tasking |
| Every task is checked and a delta scenario has no task line | `advance` from implementing to tasking | `artifact` / A checked-off cut with an unsliced scenario returns to tasking |
| Accepting is not archived and a delta scenario has no task line | Wait, and does not archive | `artifact` / Accepting waits while a delta scenario has no task |
| No open task, no child, and no open blocker | The poll runs `repair-suite`. After the suite is green, `repair-suite.after` makes the final review before Publish. A return does not Publish, so the phase stays. A clean run with no commit and no return moves to `verifying`. One implement run does not leave this | `dependencies` / Finished tasks with no children run the suite |
| `classify-failures` leaves a layer marker and stays on verifying | While the checks stay red, the next poll moves to that marker's phase and does not classify again | `verifying` / Red checks with a code marker return to implementing |
| Green checks and no layer marker | `advance` to `accepting`. Archive is the next poll on accepting, not this one | `verifying` / Green checks move to accepting |
| An open unmarked thread, not on an open item | `classify-comments` before the phase skill | `marker` / An unlabeled thread is classified during implementing |
| A thread marker for an earlier phase | `advance` to that phase. The phase skill there reads the thread as its instruction | `marker` / A spec marker during implementing moves to specifying |
| Archive's fold opens a spec thread for a spec this change owns | The next poll moves to specifying. That opening does not post `sdd:refused` | `spec-archive` / A refused spec this change owns opens a spec thread. `spec-archive` / The next poll moves that issue to specifying |
| The same validate text is already on a thread, or the refused spec is a file this pull request does not change | Wait, and `sdd:refused` for `accepting` / `archive` / `archive the change`. The next poll does not start that archive. An open spec thread still rolls back first | `spec-archive` / A repeated validate refusal waits. `spec-archive` / A refused validate names the specs and the rule. `spec-archive` / The next poll does not archive again |
| Archive's fold would leave a baseline with no requirement | Wait naming that baseline. `sdd:refused` is not set | `spec-archive` / The machine waits and names the baseline instead of refusing |
| The final review opens a thread whose body starts `sdd:layer=spec → specifying` because no scenario names the promise, and does not Publish | The next poll rolls back to specifying. The run is Hand-off | `idle` / A layer marker does not refuse the run |
| A `code` thread is closed | The reply is `fixed` and the thread is resolved only when HEAD is the remote issue-branch tip and the boundary command fails on the parent and passes on HEAD. When the trace is `@ojson/spec-coverage`, the changed test names a `scenario` the delta or a stable spec names | `marker` / Fix closes a code thread after the new test fails on the parent. `marker` / Fix closes a code thread whose scenario a stable spec names. `marker` / Fix closes a code thread by the boundary command |
| `thread fix` refuses and the refusal says to hand the thread to `spec` | The reply is `sdd:layer=spec → specifying` and the refusal. The thread stays open. The next poll moves to `specifying`. A refusal that does not say that, including a missing one-file command, leaves the thread open and does not move the phase | `marker` / Fix refuses a code thread whose scenario is not in the delta. `marker` / Fix refuses a code thread whose boundary names no command |
| A phase before accepting finds the tip archived | `unarchive` before that phase's repair | `merge` / Implementing restores an archived change before a code repair |
| The final review opens a thread with no marker and publishes nothing | The run is Hand-off. `sdd:refused` is not posted. The same drive classifies the thread | `idle` / A new unmarked thread does not refuse the run |
| A layer marker only on the conversation, and an open task remains | The run is Hand-off. The phase stays. The next drive runs that task | `idle` / A conversation layer marker does not refuse the run. `marker` / A conversation code marker during implementing leaves the next task |
| A card gap on `tasking`, including when the stamp matches | `create-tasks` before children. The tasks prompt names the gap and says not to Publish | `artifact` / A card gap on tasking starts tasks before children. `artifact` / A matching tasks stamp names the card gap |
| A verification boundary with no command | Hand-off to `design`. The card is not written | `step-handoff` / A verification boundary with no command hands off to design |
| A scenario in two tasks, in none, or a task with no anchor | The tasks step fixes that before the commit | `step-handoff` / A scenario in two tasks is fixed before the commit |
| A scenario no caller path can verify | Hand-off to `spec` | `step-handoff` / A scenario no caller can verify hands off to spec |
| The tasks step cuts the delta | One card per slice. Scenarios of one observation share it. Each scenario sits in one slice | `step-handoff` / Tasks publishes one card per slice |
| Specify finds the capability list, the problem, the scope, or the last requirement of a baseline wrong | Hand-off to `proposal`. The spec files stay. The next poll reads that marker | `step-handoff` / Specify hands the capability list to proposal |
| A failing log's THEN names the behavior | Hand-off to `code`. The verify step writes no files. While the checks stay red the next poll moves to that phase | `step-handoff` / A failure that names behavior hands off to code. `verifying` / Red checks with a code marker return to implementing |
| `thread open` for a Hand-off exits non-zero | Wait (§ Wait) naming the file and the exit. No thread on another path. The next poll does not start that layer's action | `marker` / A hand-off whose line is not on the pushed head waits |
| Validate names a spec file | Hand-off to `spec` | `step-handoff` / A validate failure that names a spec file hands off to spec |
| A coverage line `missing`, `near`, or `outside` names a delta scenario | Hand-off to `code` on that spec's test. The next poll writes the test. This is not a Wait | `step-handoff` / A missing scenario test returns to code |
| A failure has no test line | `sdd:note` and Wait | `step-handoff` / No test line is a note and a wait |
| The failures are infrastructure only | Wait | `step-handoff` / Infrastructure only waits |
| The proposal names no capability and no delta file exists, and the design stamp is not the empty specs revision | The design review gate. The design skill does not run | `artifact` / An empty specs revision does not restart design |
| An Added id is missing from `## Shelf`, no delta file exists, and a spec thread is open | `improve-specs`. The shelf is not restored | `baseline` / An open spec thread waits out an unjudged Added id |
| An unmarked thread is classified | The reply is `sdd:layer=<layer> → <phase>` and the thread stays open | `step-handoff` / Classification replies and leaves the thread open |
| `verifying` or `accepting`, and the conversation is unanswered | The cause, with no marker, and Wait. No `code` thread | `step-handoff` / Verifying and accepting name the cause and wait |
| The phase has a layer row and the conversation asks for work now | A thread whose body starts `sdd:layer=<layer> → <phase>`. The next poll reads that thread | `step-handoff` / A phase with a layer row opens a thread |
| The classify step did not Wait | `sdd:wait-human` is removed | `step-handoff` / Classification removes the hold unless it waited |
| The reply is `out` | An issue is opened and the thread is resolved. An open `out` does not move the phase | `step-handoff` / An out reply resolves the thread. `marker` / Out does not move the phase |
| Unfold reports a tip with no `Sdd-Archive` line | `sdd:refused` for that phase, `unarchive`, `return the delta to the change`. The next poll does not run that unarchive | `spec-archive` / Unfold refuses a tip that is not the archive commit |
| The fold conflicts with a baseline | One spec thread, no `sdd:refused`. The next poll moves to `specifying` | `spec-archive` / A baseline conflict opens a spec thread |
| `proposed` is set and a question is open | `proposed` is dropped. The phase stays `proposing` and waits. After the question closes, the poll posts the proposal ask | `review-gate` / Proposed over an open question stays, then asks |
| An approach sentence names an observation no scenario names, or contradicts a scenario | Hand-off to `spec`. No publish. `sdd-absorbed` stays | `step-handoff` / An approach sentence with no scenario hands off to spec |
| The init block lists `Open questions:`, or the repository has no one-file command or no layer command | An unchecked Open decisions item in `design.md`. No publish. The next poll waits on that item | `step-handoff` / An init question is written as an open decision. `artifact` / An open decision waits before a stale design stamp |
| Two open pull requests, an open task, and an earlier-phase thread | `advance` to that phase. The task does not run | `pull-request` / An earlier-phase thread moves while two pull requests are open |
| Two open pull requests, an open task, and a card gap | `advance` to `tasking`. The task does not run | `pull-request` / A card gap returns to tasking while two pull requests are open |
| `implementing`, an open task, and no pull request | Wait `no open pull request` | `artifact` / Implementing without an open pull request waits |
| `implementing` and no `tasks.md` | `advance` to `tasking` | `artifact` / Implementing without tasks returns to tasking |
| No `tasks/<id>.md`, or a card with no § Artifacts heading, or a coverage gap outside the task | Hand-off to `tasks` or the gap's layer. The task stays open. The next poll reads the marker | `step-handoff` / A missing task card hands off to tasks. `step-handoff` / A coverage gap outside the task is a hand-off |
| Scenarios from two Requirements on one card | `tasks.md` is split in its own commit. The checkbox stays open. The run ends | `step-handoff` / Scenarios from two requirements are split before the task |

The final review is `sdd.hooks.repair-suite.after` in `openspec/config.yaml`. It runs when the suite is green, before Publish, so a return is a thread while the phase is still `implementing`. A return whose promise a scenario already names carries no marker. That run is the unmarked-thread seam above. Archive no longer carries this hook.

Service hook text is inserted into the prompt. It does not change which row matches. `hook` / The prompt inserts service lines and then the cycle paragraph.

