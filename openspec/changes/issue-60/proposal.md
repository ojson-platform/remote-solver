# OpenSpec CLI archive contract for accept fold

## Problem

This child tracks that contract for #55. Implementation in remote-solver assumes the CLI already behaves this way (same tool as `openspec validate`, ADR 0015).

## Outcome

The OpenSpec CLI applies a change delta onto baselines with `openspec archive issue-<key> --yes`. It applies RENAMED, then REMOVED, then MODIFIED, then ADDED. It parks the change under `openspec/changes/archive/<date>-issue-<key>/`. On a spec that did not exist, it writes placeholder Purpose (`TBD - created by archiving change ...`). It leaves an existing spec's Purpose unchanged. It refuses with non-zero exit when a baseline would have no requirement after the fold; it does not commit.

## Scope

OpenSpec CLI: apply that change delta onto baselines, park the change, write Purpose only on a spec that did not exist, leave an existing Purpose unchanged, and refuse a baseline that would have no requirement after the fold.

remote-solver: assume the CLI already behaves this way for the accept fold of #55.

## Out of scope

The rest of #55. A new issue. Reimplementing the fold. How `openspec validate` checks a delta. Where this repository names its change directory, and when it merges.

## Constraints

Implementation in remote-solver assumes the CLI already behaves this way (same tool as `openspec validate`, ADR 0015). The fold order is RENAMED, then REMOVED, then MODIFIED, then ADDED. The CLI refuses with non-zero exit when a baseline would have no requirement after the fold; it does not commit.

## Capabilities

### Added

- `archive-fold`: The OpenSpec CLI applies a change delta onto baselines with `openspec archive issue-<key> --yes`, RENAMED, then REMOVED, then MODIFIED, then ADDED.
- `archive-park`: The OpenSpec CLI parks the change under `openspec/changes/archive/<date>-issue-<key>/`.
- `archive-purpose`: On a spec that did not exist, the archive writes placeholder Purpose (`TBD - created by archiving change ...`), and it leaves an existing spec's Purpose unchanged.
- `archive-refusal`: The archive refuses with a non-zero exit when a baseline would have no requirement after the fold, and it does not commit.

### Modified

## Open questions
