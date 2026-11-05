---
status: accepted
---

# The accept step folds with the archive command

The accept step runs `openspec archive issue-<key> --yes`. The command applies RENAMED, then REMOVED, then MODIFIED, then ADDED, and writes `openspec/changes/archive/<date>-issue-<key>/`. Before the one archive commit, the step moves that directory to `openspec/changes/archive/issue-<key>/`. A spec the command created takes its Purpose from that capability's line in the proposal. An existing spec keeps its Purpose. A refusal does not publish. A baseline that would have no requirement is a Wait that names it. `openspec validate --all --strict --no-interactive` still runs before the commit. Unarchive stays a revert of that commit. The step does not merge.

The readers already use the undated path: the machine, the window, review, and unarchive. A dated directory in the commit would make the archive commit irreversible for them, because unarchive is a revert of that one commit and ADR 0030 reads the change from its parent.

Hand-editing the requirement blocks was rejected: the command applies them. Keeping the dated directory was rejected: the readers would have to learn a date. A second commit for the move or the Purpose was rejected: the archive commit would no longer be the tip.
