# Context

Skills talk to the tracker, the review, and the repository only through `npx remote-solver`.

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

## Review threads

```bash
npx remote-solver thread open <pull> <file> <line> '<body>'
npx remote-solver thread reply <pull> <comment> '<body>'
npx remote-solver thread say <pull> '<body>'
npx remote-solver thread resolve <thread>
```

`<thread>` is the review thread id. `<comment>` is the comment id the reply hangs from. The line is a line on the pull request head. `thread say` posts an issue comment on the pull request. The command adds `🤖 ` at the start of the body.

## Worktree

The agent for an issue runs on branch `sdd/<key>`. The library keeps that checkout in the service under `.sandcastle/worktrees/`, named from the branch with `/` replaced by `-`, and reuses it on the next run. This package is linked into that checkout as `.sandcastle/`. A branch is checked out in only one worktree, so an older checkout of `sdd/<key>` has to be removed before that issue can run. A run that records no commit leaves the issue idle.

Before Publish, `git status` is empty aside from the files of this commit. Anything else is an artifact the task did not name. Find why it appeared and remove that cause in the same run: a generated directory goes into the service `.gitignore`, a stray file is deleted, a file that belongs to the task joins the commit. Do not publish while the tree is dirty. A dirty tree is reused as-is and is not fast-forwarded from origin.

## Commit

The default subject is `#<issue>: <what changed>`.

The repository's own commit rule wins. Read it where the repository states commit messages (`CONTRIBUTING`, the agent style guide, a commitlint config). The subject follows that rule and says what this commit changed. The body contains a line `#<issue>`.

The pull request title stays `#<issue>: <what changed>`. That string is the `publish` argument, not the commit subject.

## Wait

`npx remote-solver wait <issue> '<what the person does>'` sets `sdd:wait-human` and comments on the issue. The comment is the ask: the decision, the review, or the broken check, and the next command. A wait without that sentence is refused.

## Issue mirror

Keep the author's text. Replace only the block between `<!-- sdd:begin -->`
and `<!-- sdd:end -->`. Create the block at the end if it is missing. One
line per layer; a layer keeps its line once written. Update one line with
`npx remote-solver mirror <key> <Layer> "<text>"`, where `<Layer>` is `Change`, `Plan`, `Specify`, `Design`, or `Tasks`:

```md
<!-- sdd:begin -->
Change: `openspec/changes/issue-<issue>/` · PR #<pr>
Plan: <outcome in one line>
Specify: <capabilities, baseline restored or not>
Design: <verification boundary in one line>
Tasks: <done>/<total>
<!-- sdd:end -->
```
