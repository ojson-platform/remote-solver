---
status: accepted
---

# Publish waits for the pull request

`arc push` updates the issue branch and then asks Arcanum to build a diff-set. While that build runs, the pull request's `full_status` is `uploading` and the command exits non-zero. The branch is already on the server. `sdd publish` passes `--wait`, so arc polls that status itself. If the command still returns `uploading`, publish polls `arc pr status` until `from_id` is HEAD. A pull request that does not exist yet is not a failure: publish creates it after the push. `configuration_failed` and `merge_failed` stop the wait. A dropped connection pushes again. `uploading` does not.

Pushing again while the diff-set is building was rejected. The second push starts another update and reads the local `arcadia/` ref, which still names the previous tip.
