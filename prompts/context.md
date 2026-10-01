# Context

Skills talk to the tracker, the review, and the repository only through `npx sdd`. Every read and every write below is one of its verbs. The source of this package, the GitHub API, `gh`, and `remote-solver` are not part of a skill.

## Outcome

A run ends in exactly one signal. A run that ends with none leaves the decision unchanged: the spy records the step idle and does not start it again.

| Signal | When | How |
|---|---|---|
| Publish | the action produced a commit | § Publish |
| Wait | a person has to decide or repair | § Wait |
| Hand-off | the work belongs to a layer | a thread or conversation comment carrying that layer's marker, § Threads |

"Stop" in a skill means: emit the signal that fits, then end the run.

## Layers

| Layer | Phase it opens | Change file |
|---|---|---|
| `proposal` | `proposing` | `proposal.md` |
| `spec` | `specifying` | `specs/<capability>/spec.md` |
| `design` | `designing` | `design.md` |
| `tasks` | `tasking` | `tasks.md`, `tasks/<id>.md` |
| `code` | `implementing` | source and tests |
| `out` | leaves the phase | another issue |

Earliest to latest: proposal, spec, design, tasks, code. The machine moves the phase to the earliest open marker.

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
- `## Constraints`: limits the solution keeps.
- `## Capabilities`: `### Added` and `### Modified`, lines `- <id> <gist>`, ids by § Capability. The machine reads `### Modified` ids and requires their baseline.
- `## Open questions`: `- [ ]` items. The machine counts them.

`design.md`, every section filled or `none`:
- `## Verification boundary`: where each capability's Scenarios are observed, and the commands. For each capability: a narrow command that runs one test file and contains `<test-file>`, and the fast suite. The last line of the section is the type check, once for the change, or `none`. The trace line and the test path rule, when the service named them, are copied once after that.
- `## External contracts`: what another service must provide, not its API.
- `## Technical prerequisites`: each one code in this PR, an issue `Depends: #N`, or a flag with a safe default.
- `## Approach`: how this change is built. Module boundaries, risks, rejected alternatives, or `none`. The machine does not read it.
- `## Open decisions`: `- [ ]` items. The machine counts them.

`tasks.md`: lines `- [ ] \`<id>\`` in work order, each naming its Scenario titles. The machine counts every `- [ ]`.

`tasks/<id>.md`: the Scenario titles, then
- `## Source`: what changes, what the task leaves untouched, every file the implementer may edit. The test file is not here.
- `## Proof`: the test file path, what the test observes, which files it may read, the commands that must exit 0 (the narrow command and the fast suite, and the type check when the card names it), and the trace line when the boundary copied one.

## Threads

```bash
npx sdd threads <pull> [--layer <layer>] [--unmarked]
npx sdd thread open <pull> <file> <line> '<body>'
npx sdd thread reply <pull> <comment> '<body>'
npx sdd thread say <pull> '<body>'
npx sdd thread resolve <thread>
npx sdd thread fix <issue> <pull> <thread>
npx sdd thread fix <issue> <pull> --conversation
```

`threads` prints the open review threads as JSON: `thread` (for `resolve` and `fix`), `comment` (for `reply`), `file`, `line`, `marker` (the layer, `note`, or `fixed` the latest reply carries, or `null`), `body`. `--layer X` keeps the threads marked `X`; `--unmarked` keeps the ones with no marker. `conversation.last` is the last pull request comment, `conversation.layer` is the layer the conversation still asks for, and `conversation.unanswered` is true when that last comment is a person's and carries no marker.

`thread open` places a thread on a line of the pull request head. `thread say` posts a pull request comment. The command adds `🤖 ` at the start of every body. `thread fix` replies `sdd:fixed <HEAD>` and resolves the thread in one call; `--conversation` posts that line to the conversation instead. It refuses while HEAD is not on the pushed `sdd/<issue>`. A thread marked `fixed` is done.

### Fix thread

A skill fixes the threads of its own layer: `threads <pull> --layer <layer>`. For each thread: one commit that answers it, Publish, then `thread fix <issue> <pull> <thread>`. A conversation request of that layer (`conversation.layer`) is the same work, answered with `thread fix <issue> <pull> --conversation`.

### Hand-off

The work the run found belongs to another layer: `thread open <pull> <file> <line> 'sdd:layer=<layer> → <phase> <cause>'` on the line of the pushed head that shows it, `<layer>` and `<phase>` from § Layers. An existing thread that turns out to belong to another layer takes the same line as a `thread reply` instead, and stays open. Then end the run. The machine moves the phase on the next poll; the skill of that layer fixes the thread. A remark that is not a layer of this cycle is `sdd:note <cause>` and moves nothing.

## Publish

1. `git status` is empty aside from the files of this commit. Anything else is an artifact the task did not name: a generated directory goes into the service `.gitignore`, a stray file is deleted, a file that belongs to the task joins the commit. Find why it appeared and remove that cause in the same run. `publish` refuses a dirty tree and lists its files.
2. Commit. The repository's own commit rule wins: read it where the repository states commit messages (`CONTRIBUTING`, the agent style guide, a commitlint config). Without one, the subject is `#<issue>: <what changed>`. The body contains a line `#<issue>`. Any uncommitted `openspec/` of this issue joins the commit.
3. `npx sdd publish <issue> "#<issue>: <what changed>"`. The argument is the pull request title, not the commit subject. It pushes `sdd/<issue>` and opens the pull request when there is none.
4. The layer's mirror line, when the skill names one: § Issue mirror.

Nothing to commit: skip steps 1–2 and still run step 3.

## Wait

`npx sdd wait <issue> '<what the person does>'` sets `sdd:wait-human` and comments on the issue. The comment is the ask: the decision or the broken check, and the next command. A wait without that sentence is refused.

Wait only for a blocker. The review of a published proposal, spec, or design is not one: the machine opens that gate itself.

## Worktree

The agent for an issue runs on branch `sdd/<key>`. A branch is checked out in only one worktree, so an older checkout of `sdd/<key>` has to be removed before that issue can run. A dirty tree is reused as-is and is not fast-forwarded from origin. This package is linked into the checkout as `.sandcastle/`.

The spy's library keeps its checkout under `.sandcastle/worktrees/`, named from the branch with `/` replaced by `-`. A person driving one issue in a chat runs `npx sdd worktree <key>`, which checks the same branch out at `.worktrees/sdd-<key>`. The two checkouts are not used together.

## Issue mirror

Keep the author's text. Replace only the block between `<!-- sdd:begin -->`
and `<!-- sdd:end -->`. Create the block at the end if it is missing. One
line per layer; a layer keeps its line once written. Update one line with
`npx sdd mirror <key> <Layer> "<text>"`, where `<Layer>` is `Change`, `Plan`, `Specify`, `Design`, or `Tasks`:

```md
<!-- sdd:begin -->
Change: `openspec/changes/issue-<issue>/` · PR #<pr>
Plan: <outcome in one line>
Specify: <capabilities, baseline restored or not>
Design: <verification boundary in one line, the kinds of boundaries, not the commands>
Tasks: <done>/<total>
<!-- sdd:end -->
```
