# Adapters

The outsides the machine and the reviewer talk to. Each one implements a port. Phase policy and marker grammar stay in the machine.

## Language

**Port**:
One outside the machine needs: the tracker, the review, the repository, or the runtime.
_Avoid_: Adapter, client, API

**Tracker**:
Where an issue, its phase, and its comments live.
_Avoid_: GitHub, board

**Review**:
The pull request's threads, conversation, checks, and merge.
_Avoid_: Reviewer, code review

**Repository**:
The service checkout the change is read from.
_Avoid_: Git, clone

**Runtime**:
Where a step or a judge runs. The repository port prepares the checkout.
_Avoid_: Agent, sandcastle

**Service**:
The repository the machine is aimed at. This package is not a service.
_Avoid_: Repo, project, host

**Issue branch**:
The branch named for one cycle. Commits for that cycle land on it.
_Avoid_: Feature branch, PR branch

**Worktree**:
The checkout one run uses. The session and the spy keep different directories.
_Avoid_: Clone, sandbox
