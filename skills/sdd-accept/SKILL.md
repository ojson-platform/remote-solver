---
name: sdd-accept
description: >
  Moves the change delta into openspec/specs in the same pull request, or
  reverts that commit on rollback.
  Trigger: archive, unarchive. Phase sdd:accepting, or an early phase after archive.
mode: judgment
---

# sdd-accept

Folds the delta into the baseline on the same PR, by `context.md` § Delta. A person merges that PR. `sdd:auto-merge` lets the machine merge it. `accepted` is set after the merge.

## Out of this action

- New scope
- Merging the PR
- Restoring a baseline from code

## archive

1. Fold `openspec/changes/issue-<issue>/specs/` into `openspec/specs/<capability>/spec.md`: RENAMED, REMOVED, MODIFIED, ADDED, in that order. Keep the scenario meaning.
2. Move the change directory to `openspec/changes/archive/issue-<issue>/`.
3. Publish (`context.md`). Mirror: `Change`, pointing at the archive path.

## unarchive

1. Find this change's archive commit.
2. Revert that commit: the change returns to `openspec/changes/issue-<issue>/`, the baseline returns to its pre-archive text.
3. Publish (`context.md`). No mirror line.

## Check

- archive: `openspec/changes/issue-<issue>/` is gone, `openspec/changes/archive/issue-<issue>/` exists, the baseline contains the delta scenarios, and every baseline keeps at least one requirement
- unarchive: the reverse

## Stop

- Publish. Archive: when the checks are green, a person merges the pull request, or `sdd:auto-merge` is set and the machine merges. Unarchive: the machine runs again.
- The fold conflicts with a baseline already on the base branch of this run, or would leave a baseline with no requirement: Wait with which baseline conflicts.
