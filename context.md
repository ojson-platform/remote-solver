# Context

Skills talk to the tracker, the review, and the repository only through `sdd.ts`.

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
npx tsx .sandcastle/sdd.ts thread open <pull> <file> <line> '<body>'
npx tsx .sandcastle/sdd.ts thread reply <pull> <comment> '<body>'
npx tsx .sandcastle/sdd.ts thread resolve <thread>
```

`<thread>` is the review thread id. `<comment>` is the comment id the reply hangs from. The line is a line on the pull request head.

## Worktree

The agent for an issue runs on branch `sdd/<key>`. Sandcastle keeps that checkout under `.sandcastle/worktrees/`, named from the branch with `/` replaced by `-`, and reuses it on the next run. A branch is checked out in only one worktree, so an older checkout of `sdd/<key>` has to be removed before that issue can run. A run that records no commit leaves the issue idle.

## Issue mirror

Keep the author's text. Replace only the block between `<!-- sdd:begin -->`
and `<!-- sdd:end -->`. Create the block at the end if it is missing. One
line per layer; a layer keeps its line once written. Update one line with
`npx tsx .sandcastle/sdd.ts mirror <key> <Layer> "<text>"`, where `<Layer>` is `Change`, `Plan`, `Specify`, `Design`, or `Tasks`:

```md
<!-- sdd:begin -->
Change: `openspec/changes/issue-<issue>/` · PR #<pr>
Plan: <outcome in one line>
Specify: <capabilities, baseline restored or not>
Design: <verification boundary in one line>
Tasks: <done>/<total>
<!-- sdd:end -->
```
