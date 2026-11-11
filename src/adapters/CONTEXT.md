# Adapters

The outsides the machine and the reviewer talk to. Each one implements a port. Phase policy and marker grammar stay in the machine. A port implementation calls `adapterMachine` and nothing else of the machine. The runtime this package ships calls `runtimeMachine`.

`compose.ts` wires the ports this repository ships. `load.ts` replaces them when an Arcadia adapter file is present. `locate.ts` finds that file.

That file is loaded beside the bundled script, or from the Arcadia skills tree. The bundle keeps the machine inside itself, so the file cannot import it. `createAdapters(root, config, machine)` receives `adapterMachine`.

The subjects are `tracker`, `review`, `vcs`, `runtime`, and `openspec`. GitHub fills the tracker and the review from one client, so that client lives in `tracker`. `review` holds the Actions annotation the reviewer writes. `vcs` is the git checkout. The runtime subject holds the process, its sandbox, the session, and the lock. The OpenSpec subject is the binary path. `arcanum.ts` is not wired here. Arcadia replaces the ports from its own adapter file.

## Language

**Port**:
One outside the machine needs: the tracker, the review, the repository, the runtime, or the OpenSpec binary.
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

**OpenSpec binary**:
The `openspec` executable the fold runs. Arcadia may supply another path.
_Avoid_: Archive command, CLI wrapper

**Service**:
The repository the machine is aimed at. This package is not a service.
_Avoid_: Repo, project, host

**Issue branch**:
The branch named for one cycle. Commits for that cycle land on it.
_Avoid_: Feature branch, PR branch

**Worktree**:
The checkout one run uses. The session and the spy keep different directories.
_Avoid_: Clone, sandbox
