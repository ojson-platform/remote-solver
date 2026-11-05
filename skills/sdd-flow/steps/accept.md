mode: judgment

# sdd-accept

Folds the delta into the baseline on the same PR, by `CONTEXT.md` § Delta. A person merges that PR. `sdd:auto-merge` lets the machine merge it. `accepted` is set after the merge.

## Out of this action

- New scope
- Merging the PR
- Restoring a baseline from code

## archive

1. Fold with `openspec archive issue-<issue> --yes` instead of editing each baseline by hand. The command applies RENAMED, then REMOVED, then MODIFIED, then ADDED. The command archives to `openspec/changes/archive/<date>-issue-<issue>/`. Keep the scenario meaning. When the command exits non-zero, or prints `Aborted. No files were changed.`, stop. Do not commit and do not publish. When the output says the rebuilt spec would have no requirement (`Spec must have at least one requirement`), Wait naming that baseline (`openspec/specs/<capability>/spec.md`).
2. Move `openspec/changes/archive/<date>-issue-<issue>/` to `openspec/changes/archive/issue-<issue>/`.
3. In the same commit as the fold and move, for each line under `## Capabilities` in `openspec/changes/archive/issue-<issue>/proposal.md`, when `openspec/specs/<capability>/spec.md` still has Purpose `TBD - created by archiving change ...`, set Purpose to the gist words after the capability id on that line. Do not open or rewrite Purpose on a spec that did not get that placeholder, including an existing baseline such as `spec-archive`.
4. Run `openspec validate --all --strict --no-interactive`.
5. Publish (`CONTEXT.md`). One commit holds the fold, the move, and any Purpose lines. Its body contains a line `Sdd-Archive: issue-<issue>`. That commit is the tip of `sdd/<issue>`. Nothing is committed after it until unarchive. Focus with marker `sdd:focus:accept`. Mirror: `Change`, pointing at the archive path. This step does not merge the pull request.

## unarchive

1. Find this change's archive commit: the tip of `sdd/<issue>` whose body contains a line `Sdd-Archive: issue-<issue>`. When the tip has no such line, stop. Do not revert an earlier commit.
2. Revert that commit: the change returns to `openspec/changes/issue-<issue>/`, the baseline returns to its pre-archive text. The revert is the new tip. Its body contains a line `#<issue>` (§ Publish) and does not contain a line `Sdd-Archive: issue-<issue>`.
3. Publish (`CONTEXT.md`) without focus. No mirror line.

## Check

- archive: `openspec/changes/issue-<issue>/` is gone, `openspec/changes/archive/issue-<issue>/` exists, the baseline contains the delta scenarios, every baseline keeps at least one requirement, and the tip commit body contains a line `Sdd-Archive: issue-<issue>`
- unarchive: the reverse

## Stop

- Publish. Archive: when the checks are green, a person merges the pull request, or `sdd:auto-merge` is set and the machine merges. Unarchive: the machine runs again.
- The fold conflicts with a baseline already on the base branch of this run, or would leave a baseline with no requirement: Wait with which baseline conflicts.
