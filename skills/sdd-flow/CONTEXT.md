# Context

Skills talk to the tracker, the review, and the repository only through the `sdd` command. Every read and every write below is one of its verbs. A host note at `scripts/adapters/host.md` that names the chat command replaces `sdd` for this host. The source of this package, the built script, `bin/`, a package directory, a forge API, and `remote-solver` are not part of a skill. Do not search for them and do not open them to learn a verb.

## Outcome

A run ends in exactly one signal. A run that ends with none leaves the decision unchanged: the spy records the step idle and does not start it again.

| Signal | When | How |
|---|---|---|
| Publish | the action produced a commit | § Publish |
| Wait | a person has to decide or repair | § Wait |
| Hand-off | the work belongs to a layer | a thread or conversation comment carrying that layer's marker, § Threads |

"Stop" in a skill means: emit the signal that fits, then end the run.

## Once

Read this file once in a run, the first time a step names one of its sections. A file named under a step's Read only is read once. After an edit of a file succeeds, that file is known for the rest of the run: do not read it again.

One edit of a file covers one scenario of the step. When the check command fails after that edit and a file has changed since the last run of the command, one further edit of that file is allowed, then the command runs once more. A command the card does not name does not run, apart from the verbs and § Onto the base. A log, a show, and a diff of an older commit do not run.

The one-file command is the check while its test is red and after each edit of that test or its source, and after each edit in cover-baseline. It runs again after a later edit even when it already exited 0. The layer command, the fast suite, and the type check do not run inside a slice. They run in repair-suite, and once in cover-baseline after that action's one-file commands are green. A one-file command that is not red on its assertion allows one further edit of that test, then Wait.

A long command keeps its exit code. This includes the one-file command, the layer command, the fast suite, and the type check. Redirect its output to a file and remember its status. Do not pipe the command into `tail` or `head`: that status belongs to the pipe. On failure, print the failing test name, its assertion, and every line that contains `missing`, `near`, `outside`, or `spec coverage has gaps`. When the file has none of those lines, print its last lines. On success, print the last lines of the file. Exit with the remembered status. That print is the whole result. Do not run the command again to see another slice of the same output.

The validate command in § Delta runs once, after the spec edit, when this step checks a spec. It runs again only when it failed and that spec file has changed since.

## Layers

| Layer | Phase it opens | Change file |
|---|---|---|
| `proposal` | `proposing` | `proposal.md` |
| `spec` | `specifying` | `specs/<capability>/spec.md` |
| `design` | `designing` | `design.md` |
| `tasks` | `tasking` | `tasks.md`, `tasks/<id>.md` |
| `code` | `implementing` | source and tests |
| `out` | leaves the phase | another issue |

Earliest to latest: proposal, spec, design, tasks, code. The machine moves the phase to the earliest open thread marker. A marker on the conversation records a request and does not move the phase.

## Upstream

The prompt carries an `## Upstream` block. That block is the current input and the revision this file has absorbed. Do not rebuild it from history. Listing titles to satisfy a check is allowed. The facts to write come from the block.

- The block says this file does not exist yet: write it from the previous artifact, as the step says. Put `sdd-absorbed: <revision>` on its own line.
- The block says the stamp matches: leave this file.
- The block names an input revision: a fact in that text that this file does not already say is an edit. Move `sdd-absorbed:` to that revision only when the input is folded. Do not blank a section this file owns.
- The block says the previous artifact could not be read: do not leave this file.

`plan`: the issue text above the block is the previous artifact. A caller-visible sentence there that `proposal.md` has never stated is an edit. The file existing is not a reason to leave that sentence. A sentence `proposal.md` already replaced is not copied back. `specify`: the previous artifact is `proposal.md`. `design`: the previous artifact is the delta specs. `tasks`: the previous artifacts are the delta specs and `design.md`. Any other action: the block says this action has no previous artifact.

## Capability

An id names one rule the caller relies on, in kebab-case domain language:
`model-identity`, `preset`, `cache-first`. The id is the rule, whatever file
or helper implements it. Cut: when the rule changes, exactly one spec
changes. A rule observed through several helpers is one id. Several rules
inside one helper are several ids. A change that leaves every such rule as it
is names no id. `### Added` and `### Modified` stay empty. Do not invent an id
so the change has a spec.

`### Added`: this checkout does not show the rule today. `### Modified`: this
checkout shows the rule, and the baseline restores today's behavior before the
delta. A rule that exists and is being deepened or moved is Modified. The
issue text does not choose the shelf. Baseline moves the line to the shelf
the checkout shows and does not wait for a person.

The baseline of an id holds today's behavior of that rule only, including
disagreements between helpers. Behavior under `## Out of scope` belongs to
another id and stays out.

## Delta

`openspec/changes/issue-<issue>/specs/<capability>/spec.md` holds the change to one baseline, in sections `## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements`, `## RENAMED Requirements`. Every section is optional; a delta with none is invalid.

- ADDED and MODIFIED: full `### Requirement: <name>` blocks, each with at least one `#### Scenario:`. MODIFIED repeats the whole requirement as it reads after the change, under the name the baseline uses.
- REMOVED: names only, `### Requirement: <name>` or a bullet list of names. No body.
- RENAMED: `- FROM: \`### Requirement: <old>\`` and `- TO: \`### Requirement: <new>\``. A MODIFIED block for a renamed requirement uses the new name.
- A name appears in one section. MODIFIED or REMOVED of a name the baseline lacks fails the fold at archive. A capability with no baseline takes ADDED only.
- A scenario the change no longer observes is left out of the MODIFIED block. A requirement the change no longer observes is REMOVED.

Archive folds the delta into `openspec/specs/<capability>/spec.md`: RENAMED, then REMOVED, then MODIFIED replaces the block, then ADDED appends. A baseline must keep at least one requirement after that fold. REMOVED of the last requirement is a change of scope, not of spec: hand off to `proposal`.

`openspec validate --all --strict --no-interactive` checks all of this. Exit non-zero names the spec file and the rule. That file is a delta of this change: fix it and run the command again. A file that is not: Hand-off. Publish only after the command exits 0.

## Artifacts

The other files of `openspec/changes/issue-<issue>/`, with these headings exactly. An open `- [ ]` item under a heading the machine reads blocks the phase.

`proposal.md`:
- `## Problem`: why, in the caller's words.
- `## Outcome`: what the caller sees once the change lands.
- `## Scope`, `## Out of scope`: what this change touches, and what it leaves to another id.
- `## Constraints`: limits the solution keeps. A limit that names what the caller sees is a Scenario of this capability. A limit whose only claim is that a behavior of another surface is absent is not a Scenario. The Scenario names what this surface shows. Its WHEN is the caller's action. Its THEN is the check a wrong result would miss. The WHEN does not start from the result already visible.
- `## Capabilities`: `### Added` and `### Modified`, lines `- <id> <gist>`, ids by § Capability. Both lists empty means the change names no rule and needs no delta. A line under either list is a named capability. The machine requires a baseline for each `### Modified` id.
- `## Open questions`: `- [ ]` items. The machine counts them.

`design.md`, every section filled or `none`:
- `## Verification boundary`: where each capability's Scenarios are observed, and the commands. For each capability: a one-file command that contains `<test-file>`, and the layer command. When the trace line names `@ojson/spec-coverage`, the one-file command also contains `<titles>`. A fast suite is included when the init block names one, otherwise `none`. The last line of the section is the type check, once for the change, or `none`. The trace line and the test path rule, when the service named them, are copied once after that.
- `## External contracts`: what another service must provide, not its API.
- `## Technical prerequisites`: each one code in this PR, an issue `Depends: #N`, or a flag with a safe default.
- `## Approach`: how this change is built. Module boundaries, risks, rejected alternatives, or `none`. The machine does not read it.
- `## Open decisions`: `- [ ]` items. The machine counts them.

`tasks.md`: lines `- [ ] \`<id>\`` in work order, each naming its Scenario titles. The machine counts every `- [ ]`.

`tasks/<id>.md`: the Scenario titles as `- <title>` lines, then one line `sdd-delta: <revision>` for the delta revision named in the upstream block. The card does not copy the scenario text. After that line:
- `## Source`: what changes, what the task leaves untouched, every file the implementer may edit. The test file is not here.
- `## Proof`: the test file path, what the test observes, which files it may read, and the commands. The one-file command runs on each attempt while the test is red and after each edit. The card names the layer command, the fast suite, and the type check. repair-suite runs them. The slice does not. The trace line is copied when the boundary has one.

## Threads

```bash
sdd threads <pull> [--layer <layer>] [--unmarked]
sdd thread open <pull> <file> <line> '<body>'
sdd thread reply <pull> <comment> '<body>'
sdd thread say <pull> '<body>'
sdd thread resolve <thread>
sdd thread fix <issue> <pull> <thread>
sdd thread fix <issue> <pull> --conversation
```

`threads` prints the open review threads as JSON: `thread` (for `resolve` and `fix`), `comment` (for `reply`), `file`, `line`, `marker` (the layer, `note`, or `fixed` the latest reply carries, or `null`), `instruction` (the first comment), `body` (the latest comment). `--layer X` keeps the threads marked `X`; `--unmarked` keeps the ones with no marker. `conversation.last` is the last pull request comment, `conversation.layer` is the layer the conversation still asks for, and `conversation.unanswered` is true when that last comment is a person's and carries no marker.

`thread open` places a thread on a line of the pull request head. `thread say` posts a pull request comment. The command adds `🤖 ` at the start of every body. `thread fix` replies `sdd:fixed <HEAD>` and resolves the thread in one call; `--conversation` posts that line to the conversation instead. It refuses while HEAD is not on the pushed `sdd/<issue>`. On a `code` thread it also refuses unless the boundary command fails on that commit's parent and passes on HEAD. When the trace line names `@ojson/spec-coverage`, a test the answering commit changes, whose `scenario` title this change's delta names, is that command. A `scenario` the delta does not name does not count, and a neighboring check in the same file does not either. A `scenario` a stable spec names counts the same way. A trace that does not name that package runs the one-file command of each changed file the test path names, and a `scenario` call is not required. A missing one-file command refuses and does not mark `sdd:layer=spec`. The thread stays open. A thread marked `fixed` is done.

### Fix thread

A skill fixes the threads of its own layer: `threads <pull> --layer <layer>`. When such a thread is open, the instruction is that thread's first comment. Carry it out on this phase's artifact, in the words it gives, including its language. A thread on an unchecked item under Open questions or Open decisions writes the answer on that item and checks it. The rest of the file stays. The numbered steps before Publish do not write that file again. § Onto the base comes before the rest of that instruction. For each thread: one commit that answers it, then `thread fix <issue> <pull> <thread>`. That `code` commit includes the test that fails on its parent. When `thread fix` refuses because the test does not fail on the parent, Hand-off to `spec` and leave the thread open. Publish is this step's own Publish, once. An instruction this step cannot carry out is a Wait that repeats the instruction. Do not mark it `sdd:note`. The machine starts that skill for an open thread, not for a conversation marker alone. When the skill is already fixing that layer and `conversation.layer` names it, the conversation request is the same work, answered with `thread fix <issue> <pull> --conversation`.

### Onto the base

Run `sdd rebase <issue> <base>` before the rest of Fix thread. `<base>` is the base the step printed. When the branch already contains that base, the command changes nothing. When the command prints conflicted paths, edit only those paths, publish without focus, and stop. The phase stays. When the command prints no path, continue the thread. Do not open the program. The same command runs when the pull request conflicts with its base and no person asked. When `sdd rebase` or `sdd publish` exits non-zero, stop and name the exit. Do not rebase again by hand.

### Hand-off

The work the run found belongs to another layer: `thread open <pull> <file> <line> 'sdd:layer=<layer> → <phase> <cause>'` on the line of the pushed head that shows it, `<layer>` and `<phase>` from § Layers. An existing thread that turns out to belong to another layer takes the same line as a `thread reply` instead, and stays open. Then end the run. The machine moves the phase on the next poll; the skill of that layer fixes the thread. A remark that asks the cycle to do nothing is `sdd:note <cause>` and moves nothing. A remark that asks this phase to do something is a thread of this phase's layer, including when it names no line. A phase with no row in § Layers does not invent `code`. A thread on an unchecked item under Open decisions or Open questions stays that file's layer until the item is checked. A hand-off from that item is a new thread, after the check.

A `thread open` that exits non-zero, including HTTP 422, ends that Hand-off. Do not call `thread open` on another file. Wait (§ Wait), and the sentence names the file and the exit. The next poll does not start that layer's action.

A failing log is one signal. No test line: `sdd:note <cause>` and Wait. A coverage line `missing|near|outside` that names a delta scenario is a Hand-off to `code` on the test file for that spec, not the note. A coverage gap the slice does not name is not a success of that slice. repair-suite carries a `missing` or `outside` line for a triple of this change as a Hand-off to `code`. `near` alone is not a Hand-off. A test name whose THEN does not name that behavior: one Hand-off to `spec`. A THEN that names it: Hand-off to `code` on that file.

## Publish

1. The checkout lists only the files of this commit. Anything else is an artifact the task did not name: a generated directory is ignored by the repository, a stray file is deleted, a file that belongs to the task joins the commit. Find why it appeared and remove that cause in the same run. `publish` refuses a dirty checkout and lists its files.
2. Run `sdd commit <issue> "#<issue>: <what changed>"`. The repository's own commit rule wins when a checkout-root file states it: `CONTRIBUTING`, `CONTRIBUTING.md`, `AGENTS.md`, `commitlint.config.js`, `commitlint.config.cjs`, `commitlint.config.mjs`, `.commitlintrc`, or `.commitlintrc.json`. Read those paths only. When none of them exists, the subject is `#<issue>: <what changed>`. Do not search the tree. The body is a second paragraph that is the line `#<issue>`. Any uncommitted `openspec/` of this issue joins the commit.
3. `sdd publish <issue> "#<issue>: <what changed>"`. The argument is the pull request title, not the commit subject. It pushes the issue branch. Only the plan step opens the pull request when there is none. A later phase does not open one.
4. When the commit includes this phase's artifact: `sdd focus <issue> '<body>'`. The body is one marker line plus the prose. A separate review step does not write focus. A step names this section and its marker; it does not restate these paragraphs. The closed markers are `sdd:focus:plan`, `sdd:focus:spec`, `sdd:focus:design`, `sdd:focus:tasks`, `sdd:focus:code`, `sdd:focus:accept`, and `sdd:focus` for the whole pull request. A pattern `sdd:focus:<phase>` is not a marker. The prose is Russian, short, and has no headings. It contains no diff and does not choose the next phase. The first paragraph answers that phase's question. The first sentence of that paragraph is itself the answer. That sentence says what a person sees. A code name follows the plain words and is not the point of the sentence. One sentence holds one decision. A refusal, what is deliberately not built, and where to look are their own sentences. An implementation word does not become a metaphor. Where to look is a place on the screen and is not a test file. These rules hold for every focus, including `sdd:focus` for the whole pull request. A clean first visit is one paragraph. A further paragraph appears only for a refusal, open questions, a weak check, or a remark. There is no fixed heading and no status of layers. `sdd:focus:plan`: the paragraph says what changes for the person and what was refused. It does not count open questions. The phase paints that count. `sdd:focus:spec`: say which promise is new and which existing promise changed, name the scenario without which the decision cannot be understood, and name a promise the issue asked for that the spec does not make. `sdd:focus:design`: say what the person sees on the screen, which alternative was rejected, what is deliberately not built, and where on the screen to look. `sdd:focus:tasks`: name the slices in the order a person would notice them, and name a slice that waits on another. `sdd:focus:code`: say what became true after this commit, what the slice left untouched, and a check that does not prove it. `sdd:focus:accept`: say what landed in the baseline specs and what was left out on purpose. Do not count capabilities, scenarios, or tests. The phase paints the merge sentence. The archive writes this comment every time, including when `sdd:auto-merge` is set. `sdd:focus`: prose for the whole pull request; it belongs to the focus block and to no single spine row. A visit that fixes review threads of its own phase writes that phase's marker even when the diff is small. On plan, spec, design, and tasks the first paragraph says what this commit changed. It names a refusal, a new or changed promise, a rejected alternative, or a waiting slice only when this commit added or changed that. A code change that answers a review thread still says what became true after this commit, what the slice left untouched, and a check that does not prove it. The next paragraph names the remarks in their own words and what changed because of them, including scenario names when scenarios appeared. A last paragraph appears only when something remains to look at, and it says what to look at. The previous comment of that phase stays. Verify, labeling threads, a rebase-only commit, an unarchive publish, and a publish that carries no phase artifact do not call `focus`. When the document was published, `sdd:auto-plan`, `sdd:auto-spec`, and `sdd:auto-design` do not skip the comment. cover-baseline and repair-suite do not call focus, even when the commit contains tests or source.
5. The layer's mirror line, when the skill names one: § Issue mirror.

Nothing to commit: skip steps 1–2 and still run step 3.

## Wait

`sdd wait <issue> '<what the person does>'` sets `sdd:wait-human` and comments on the issue. The comment is the ask: the decision or the broken check, and the next command. A wait without that sentence is refused.

Wait only for a blocker. The review of a published proposal, spec, or design is not one: the machine opens that gate itself.

## Worktree

Run `sdd worktree <key>` and work in the directory it prints. A branch is checked out in one place, so an older checkout of the same branch has to be removed before this issue can run. A dirty checkout is reused as it is. The spy and a chat driving one issue do not share a checkout.

## Archive

`sdd fold <issue>` runs `openspec archive issue-<issue> --yes`, moves the dated directory to `openspec/changes/archive/issue-<issue>/`, sets Purpose on a spec the command created, runs `openspec validate --all --strict --no-interactive`, and commits. The commit body contains a line `Sdd-Archive: issue-<issue>`. The verb does not post a focus comment. A non-zero exit is the command text. Do not run `openspec archive` yourself.

`sdd unfold <issue>` reverts the tip whose body contains a line `Sdd-Archive: issue-<issue>`. The revert is the new tip. Its body contains a line `#<issue>` and does not contain `Sdd-Archive: issue-<issue>`. When the tip has no such line, the verb exits non-zero and does not revert an earlier commit.

## Issue mirror

Keep the author's text. Replace only the block between `<!-- sdd:begin -->`
and `<!-- sdd:end -->`. Create the block at the end if it is missing. One
line per layer; a layer keeps its line once written. Update one line with
`sdd mirror <key> <Layer> "<text>"`, where `<Layer>` is `Change`, `Plan`, `Specify`, `Design`, or `Tasks`:

```md
<!-- sdd:begin -->
Change: `openspec/changes/issue-<issue>/` · PR #<pr>
Plan: <outcome in one line>
Specify: <capabilities, baseline restored or not>
Design: <verification boundary in one line, the kinds of boundaries, not the commands>
Tasks: <done>/<total>
<!-- sdd:end -->
```
