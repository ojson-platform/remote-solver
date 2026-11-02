---
status: accepted
---

# An archive commit is marked and read from its parent

One commit holds the fold into `openspec/specs/` and the move into `openspec/changes/archive/issue-<key>/`. Its body contains a line `Sdd-Archive: issue-<key>`. That commit is the tip of `sdd/<key>` until unarchive. The solver reads the change documents, the baselines, and the end of a pull-request diff from its parent. A remark on a change file is posted on the archive path at the real pull-request head. The revert that unarchives does not contain that line. The line belongs to this commit, not to every publish.
