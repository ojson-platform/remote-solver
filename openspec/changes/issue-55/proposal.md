## Problem

The accept step edits the baseline by hand.

## Outcome

The accept step folds a delta with `openspec archive issue-<key> --yes` instead of editing the baseline by hand. The command applies RENAMED, then REMOVED, then MODIFIED, then ADDED. The step still makes one commit. Its body contains a line `Sdd-Archive: issue-<key>`. That commit stays the tip until unarchive.

The command archives to `openspec/changes/archive/<date>-issue-<key>/`. Before the commit, the step moves that directory to `openspec/changes/archive/issue-<key>/`. The machine, the window, review, and unarchive keep reading `archive/issue-<key>`. Unarchive stays a revert of the archive commit. The step does not merge the pull request.

A new spec must not keep the Purpose the command writes (`TBD - created by archiving change ...`). In the same commit the step sets Purpose to the one line under that capability in the proposal. An existing spec keeps its Purpose. The command does not change it.

When the command refuses, the step does not publish. A refusal because a baseline would have no requirement is a Wait that names that baseline. `openspec validate --all --strict --no-interactive` still runs before the commit.

## Scope

The accept step folds a delta with `openspec archive issue-<key> --yes` instead of editing the baseline by hand. Before the commit, the step moves the dated archive directory to `openspec/changes/archive/issue-<key>/`. In the same commit a new spec's Purpose is the one line under that capability in the proposal. When the command refuses, the step does not publish. A refusal because a baseline would have no requirement is a Wait that names that baseline.

## Out of scope

Merging the pull request. A dated archive directory. Changing unarchive. Editing requirement blocks by hand when the command can apply them.

## Constraints

The command applies RENAMED, then REMOVED, then MODIFIED, then ADDED. The step still makes one commit. Its body contains a line `Sdd-Archive: issue-<key>`. That commit stays the tip until unarchive. The machine, the window, review, and unarchive keep reading `archive/issue-<key>`. Unarchive stays a revert of the archive commit. The step does not merge the pull request. An existing spec keeps its Purpose. The command does not change it. `openspec validate --all --strict --no-interactive` still runs before the commit.

## Capabilities

### Added

### Modified

- `spec-archive` the accept step folds a delta with `openspec archive` instead of editing the baseline by hand

## Open questions

none
