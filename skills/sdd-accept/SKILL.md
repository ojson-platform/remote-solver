---
name: sdd-accept
description: >
  Moves the change delta into openspec/specs in the same pull request, or
  reverts that commit on rollback.
  Trigger: archive, unarchive. Phase sdd:accepting, or an early phase after archive.
mode: judgment
---

# sdd-accept

Folds the delta into the baseline on the same PR. A person merges that PR. `sdd:auto-merge` lets the machine merge it. `accepted` is set after the merge.

## Out of this action

- New scope
- Merging the PR
- Restoring a baseline from code

## archive

1. Move Requirement and Scenario from `openspec/changes/issue-<issue>/specs/` into `openspec/specs/<capability>/spec.md`. Keep the scenario meaning.
2. Move the change directory to `openspec/changes/archive/issue-<issue>/`.
3. Commit `#<issue>: archive change` and Publish.
4. Issue mirror: the Change line points at the archive path. Leave the phase. When the checks are green, a person merges the pull request, unless `sdd:auto-merge` is set. The machine sets `sdd:accepted` after the merge.

## unarchive

1. Find this change's archive commit.
2. Revert that commit: the change returns to `openspec/changes/issue-<issue>/`, the baseline returns to its pre-archive text.
3. Publish the revert. Leave the phase.

## Check

- archive: `openspec/changes/issue-<issue>/` is gone, `openspec/changes/archive/issue-<issue>/` exists, the baseline contains the delta scenarios
- unarchive: the reverse

## Stop

- Archive is on the PR and the checks are green: a person merges the pull request, or `sdd:auto-merge` is set and the machine merges.
- Unarchive is on the PR: the machine runs again.
- A conflict with a baseline already on `master`: stop and set `sdd:wait-human`.
