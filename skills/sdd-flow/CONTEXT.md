# Context

Skills talk to the tracker, the review, and the repository only through `node scripts/sdd.mjs`. Every read and every write below is one of its verbs. The source of this package, the built `sdd.mjs`, `bin/`, `node_modules`, the GitHub API, `gh`, and `remote-solver` are not part of a skill. Do not search for them and do not open them to learn a verb.

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

One edit of a file covers one scenario of the step. When the check command fails after that edit and a file has changed since the last run of the command, one further edit of that file is allowed, then the command runs once more. A command the card does not name does not run, apart from the verbs and the git steps in § Publish. `git log`, `git show`, and a diff of an older commit do not run.

The one-file command is the check while its test is red and after each edit of that test or its source. It runs again after a later edit even when it already exited 0. The layer command runs once per task, after the one-file command exits 0 for every scenario of that task, and before the commit. The fast suite and the type check run then too, when the card names them. They do not run while the one-file command is failing, and they do not run after each edit. A layer failure in a file this task names returns to the one-file command. The layer command runs once more after that command exits 0. A layer failure outside this task is a Hand-off, and the layer command does not run again.

A long command keeps its exit code. On failure the output keeps the failing test name and its assertion. On success the output keeps the last lines.

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

## Capability

An id names one rule the caller relies on, in kebab-case domain language:
`model-identity`, `preset`, `cache-first`. The id is the rule, whatever file
or helper implements it. Cut: when the rule changes, exactly one spec
changes. A rule observed through several helpers is one id. Several rules
inside one helper are several ids.

`### Added`: the caller cannot observe the rule today. `### Modified`: the
caller can, and the baseline restores it before the delta. A rule that exists
and is being deepened or moved is Modified.

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

`openspec validate --all --strict --no-interactive` checks all of this. Exit non-zero names the spec file and the rule; fix that file and run it again.

## Artifacts

The other files of `openspec/changes/issue-<issue>/`, with these headings exactly. An open `- [ ]` item under a heading the machine reads blocks the phase.

`proposal.md`:
- `## Problem`: why, in the caller's words.
- `## Outcome`: what the caller sees once the change lands.
- `## Scope`, `## Out of scope`: what this change touches, and what it leaves to another id.
- `## Constraints`: limits the solution keeps. A limit that names what the caller sees is a Scenario of this capability. Its WHEN shows each of those things already visible, together with the other limit that can replace them, and its THEN states those same values.
- `## Capabilities`: `### Added` and `### Modified`, lines `- <id> <gist>`, ids by § Capability. The machine reads both lists as the named capabilities, and requires a baseline for each `### Modified` id.
- `## Open questions`: `- [ ]` items. The machine counts them.

`design.md`, every section filled or `none`:
- `## Verification boundary`: where each capability's Scenarios are observed, and the commands. For each capability: a one-file command that contains `<test-file>`, and the layer command. A fast suite is included when the init block names one, otherwise `none`. The last line of the section is the type check, once for the change, or `none`. The trace line and the test path rule, when the service named them, are copied once after that.
- `## External contracts`: what another service must provide, not its API.
- `## Technical prerequisites`: each one code in this PR, an issue `Depends: #N`, or a flag with a safe default.
- `## Approach`: how this change is built. Module boundaries, risks, rejected alternatives, or `none`. The machine does not read it.
- `## Open decisions`: `- [ ]` items. The machine counts them.

`tasks.md`: lines `- [ ] \`<id>\`` in work order, each naming its Scenario titles. The machine counts every `- [ ]`.

`tasks/<id>.md`: the Scenario titles, then
- `## Source`: what changes, what the task leaves untouched, every file the implementer may edit. The test file is not here.
- `## Proof`: the test file path, what the test observes, which files it may read, and the commands. The one-file command runs on each attempt while the test is red and after each edit. The layer command, the fast suite when the card names one, and the type check when the card names it run once after the one-file command exits 0. The trace line is copied when the boundary has one.

## Threads

```bash
node scripts/sdd.mjs threads <pull> [--layer <layer>] [--unmarked]
node scripts/sdd.mjs thread open <pull> <file> <line> '<body>'
node scripts/sdd.mjs thread reply <pull> <comment> '<body>'
node scripts/sdd.mjs thread say <pull> '<body>'
node scripts/sdd.mjs thread resolve <thread>
node scripts/sdd.mjs thread fix <issue> <pull> <thread>
node scripts/sdd.mjs thread fix <issue> <pull> --conversation
```

`threads` prints the open review threads as JSON: `thread` (for `resolve` and `fix`), `comment` (for `reply`), `file`, `line`, `marker` (the layer, `note`, or `fixed` the latest reply carries, or `null`), `body`. `--layer X` keeps the threads marked `X`; `--unmarked` keeps the ones with no marker. `conversation.last` is the last pull request comment, `conversation.layer` is the layer the conversation still asks for, and `conversation.unanswered` is true when that last comment is a person's and carries no marker.

`thread open` places a thread on a line of the pull request head. `thread say` posts a pull request comment. The command adds `🤖 ` at the start of every body. `thread fix` replies `sdd:fixed <HEAD>` and resolves the thread in one call; `--conversation` posts that line to the conversation instead. It refuses while HEAD is not on the pushed `sdd/<issue>`. A thread marked `fixed` is done.

### Fix thread

A skill fixes the threads of its own layer: `threads <pull> --layer <layer>`. For each thread: one commit that answers it, Publish, then `thread fix <issue> <pull> <thread>`. The machine starts that skill for an open thread, not for a conversation marker alone. When the skill is already fixing that layer and `conversation.layer` names it, the conversation request is the same work, answered with `thread fix <issue> <pull> --conversation`.

### Hand-off

The work the run found belongs to another layer: `thread open <pull> <file> <line> 'sdd:layer=<layer> → <phase> <cause>'` on the line of the pushed head that shows it, `<layer>` and `<phase>` from § Layers. An existing thread that turns out to belong to another layer takes the same line as a `thread reply` instead, and stays open. Then end the run. The machine moves the phase on the next poll; the skill of that layer fixes the thread. A remark that is not a layer of this cycle is `sdd:note <cause>` and moves nothing. A thread on an unchecked item under Open decisions or Open questions stays that file's layer until the item is checked. A hand-off from that item is a new thread, after the check.

## Publish

1. The checkout lists only the files of this commit. Anything else is an artifact the task did not name: a generated directory is ignored by the repository, a stray file is deleted, a file that belongs to the task joins the commit. Find why it appeared and remove that cause in the same run. `publish` refuses a dirty checkout and lists its files.
2. Commit. The repository's own commit rule wins when a checkout-root file states it: `CONTRIBUTING`, `CONTRIBUTING.md`, `AGENTS.md`, `commitlint.config.js`, `commitlint.config.cjs`, `commitlint.config.mjs`, `.commitlintrc`, or `.commitlintrc.json`. Read those paths only. When none of them exists, the subject is `#<issue>: <what changed>`. Do not search the tree. The body contains a line `#<issue>`. Pass the message with `--cleanup=verbatim` so that line stays. Any uncommitted `openspec/` of this issue joins the commit.
3. `node scripts/sdd.mjs publish <issue> "#<issue>: <what changed>"`. The argument is the pull request title, not the commit subject. It pushes the issue branch and opens the pull request when there is none.
4. When the commit includes this phase's artifact: `node scripts/sdd.mjs focus <issue> '<body>'`. The body is one marker line plus the prose. A separate review step does not write focus. A step names this section and its marker; it does not restate these paragraphs. The closed markers are `sdd:focus:plan`, `sdd:focus:spec`, `sdd:focus:design`, `sdd:focus:tasks`, `sdd:focus:code`, `sdd:focus:accept`, and `sdd:focus` for the whole pull request. A pattern `sdd:focus:<phase>` is not a marker. The prose is Russian, short, and has no headings. It contains no diff and does not choose the next phase. The first paragraph answers that phase's question, because the spine row keeps the first sentence. A clean first visit is one paragraph. A further paragraph appears only for a refusal, open questions, a weak check, or a remark. There is no ledger and no fixed heading. `sdd:focus:plan`: the paragraph says what changes for the reader of the ticket and what was refused; a second paragraph appears only for open questions and gives their place and count, not their text. `sdd:focus:spec`: say which promise is new and which existing promise changed, name the scenario without which the decision cannot be understood, and name a promise the issue asked for that the spec does not make. `sdd:focus:design`: say where the behavior lives and which alternative was rejected, what is deliberately not built, and where the behavior is observed. `sdd:focus:tasks`: name the slices in the order a person would notice them, and name a slice that waits on another. `sdd:focus:code`: say what became true after this commit, what the slice left untouched, and a check that does not prove it. `sdd:focus:accept`: say what the person has now, what was left out on purpose, and how many capabilities and scenarios there are and whether tests cover them. The archive writes this comment every time, including when `sdd:auto-merge` is set. `sdd:focus`: prose for the whole pull request; it belongs to the focus block and to no single spine row. A visit that fixes review threads of its own phase writes that phase's marker even when the diff is small. The first paragraph is the updated answer to the phase question. The next paragraph names the remarks in their own words and what changed because of them, including scenario names when scenarios appeared. A last paragraph appears only when something remains to look at, and it says what to look at. The previous comment of that phase stays. Verify, labeling threads, a rebase-only commit, an unarchive publish, and a publish that carries no phase artifact do not call `focus`. When the document was published, `sdd:auto-plan`, `sdd:auto-spec`, and `sdd:auto-design` do not skip the comment.
5. The layer's mirror line, when the skill names one: § Issue mirror.

Nothing to commit: skip steps 1–2 and still run step 3.

## Wait

`node scripts/sdd.mjs wait <issue> '<what the person does>'` sets `sdd:wait-human` and comments on the issue. The comment is the ask: the decision or the broken check, and the next command. A wait without that sentence is refused.

Wait only for a blocker. The review of a published proposal, spec, or design is not one: the machine opens that gate itself.

## Worktree

Run `node scripts/sdd.mjs worktree <key>` and work in the directory it prints. A branch is checked out in one place, so an older checkout of the same branch has to be removed before this issue can run. A dirty checkout is reused as it is. The spy and a chat driving one issue do not share a checkout.

## Issue mirror

Keep the author's text. Replace only the block between `<!-- sdd:begin -->`
and `<!-- sdd:end -->`. Create the block at the end if it is missing. One
line per layer; a layer keeps its line once written. Update one line with
`node scripts/sdd.mjs mirror <key> <Layer> "<text>"`, where `<Layer>` is `Change`, `Plan`, `Specify`, `Design`, or `Tasks`:

```md
<!-- sdd:begin -->
Change: `openspec/changes/issue-<issue>/` · PR #<pr>
Plan: <outcome in one line>
Specify: <capabilities, baseline restored or not>
Design: <verification boundary in one line, the kinds of boundaries, not the commands>
Tasks: <done>/<total>
<!-- sdd:end -->
```
