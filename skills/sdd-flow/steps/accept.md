mode: judgment

# sdd-accept

Folds the delta into the baseline on the same PR, by `CONTEXT.md` § Delta. A person merges that PR. `sdd:auto-merge` lets the machine merge it. `accepted` is set after the merge.

## Out of this action

- New scope
- Merging the PR
- Restoring a baseline from code

## archive

1. Run `node scripts/sdd.mjs fold <issue>`. The verb runs `openspec archive issue-<issue> --yes` instead of editing each baseline by hand. The command applies RENAMED, then REMOVED, then MODIFIED, then ADDED. The command archives to `openspec/changes/archive/<date>-issue-<issue>/`. The verb moves that directory to `openspec/changes/archive/issue-<issue>/`, sets Purpose on a spec the command created, runs `openspec validate --all --strict --no-interactive`, and commits. The commit body contains a line `Sdd-Archive: issue-<issue>`. That commit is the tip of `sdd/<issue>`. Keep the scenario meaning. Do not edit a baseline by hand. Do not run `openspec` yourself.
2. When the verb exits non-zero, or its text contains `Aborted. No files were changed.`, do not publish and do not commit. When the text says the rebuilt spec would have no requirement (`Spec must have at least one requirement`), Wait naming that baseline (`openspec/specs/<capability>/spec.md`) and do not set `sdd:refused`. When validate refuses `spec/<capability>` and the pull request changes `openspec/changes/issue-<issue>/specs/<capability>/spec.md`, the verb opens one thread on that file. The first line is `sdd:layer=spec → specifying` and the next line is what the command said. It does not post `sdd:refused` for that thread. The proposal's capability list does not decide this. That thread is the hand-off: do not call `sdd wait` and do not open a second thread. When a thread already carries that same command text, or the pull request does not change that file, the verb posts `sdd:refused` with what the command said. Wait with the verb text.
3. Publish (`CONTEXT.md`). One commit already holds the fold, the move, and any Purpose lines. Nothing is committed after it until unarchive. Focus with marker `sdd:focus:accept`. Mirror: `Change`, pointing at the archive path. This step does not merge the pull request.

## unarchive

1. Run `node scripts/sdd.mjs unfold <issue>`. Find this change's archive commit: the tip of `sdd/<issue>` whose body contains a line `Sdd-Archive: issue-<issue>`. When the tip has no such line, the verb exits non-zero. The tip body has no `Sdd-Archive: issue-<issue>`, and an earlier commit is not reverted. Wait with the verb text. Do not publish.
2. Revert that commit: the change returns to `openspec/changes/issue-<issue>/`, the baseline returns to its pre-archive text. The revert is the new tip. Its body contains a line `#<issue>` (§ Publish) and does not contain a line `Sdd-Archive: issue-<issue>`.
3. Publish (`CONTEXT.md`) without focus. No mirror line.

## Check

- archive: `openspec/changes/issue-<issue>/` is gone, `openspec/changes/archive/issue-<issue>/` exists, the baseline contains the delta scenarios, every baseline keeps at least one requirement, and the tip commit body contains a line `Sdd-Archive: issue-<issue>`
- unarchive: the reverse

## Stop

- Publish. Archive: when the checks are green, a person merges the pull request, or `sdd:auto-merge` is set and the machine merges. Unarchive: the machine runs again.
- The fold conflicts with a baseline already on the base branch of this run, or would leave a baseline with no requirement: Wait with which baseline conflicts.
