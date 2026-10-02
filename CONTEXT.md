# SDLC machine

The machine moves one cycle: an issue, its pull request, and its change. Terms that belong to one module are in that module's `CONTEXT.md`; `CONTEXT-MAP.md` lists them.

## Language

**Cycle**:
One issue the machine may move, together with its pull request and its change.
_Avoid_: Ticket, task

**Phase**:
Where a cycle is. The tracker names it on the issue: a label on GitHub, a status in Tracker.
_Avoid_: Status, stage

**Gate**:
A phase only a person opens.
_Avoid_: Approval, review

**Change**:
The OpenSpec documents for one cycle.
_Avoid_: Spec (that is one file inside the change)

**Spy**:
The process that reads open cycles and starts the ones that can move.
_Avoid_: Watcher, poller, bot

**Step**:
The file an agent decision names. The chat and the spy run it. `sdd-flow` and `sdd-init` are skills; a step is not.
_Avoid_: Skill

**Skill mode**:
Whether a step follows an instruction already written, or has to judge.
_Avoid_: Model, tier

**Layer**:
One kind of change file a remark can be about: proposal, spec, design, tasks, or code. Each layer opens one phase.
_Avoid_: Level, stage

**Marker**:
The `sdd:` token a reply carries: a layer, `note`, or `fixed`. The machine reads only the latest marker of a thread.
_Avoid_: Tag, label (that is the tracker's)

**Thread**:
One open review conversation on the pull request, with the handles a step replies and resolves with.
_Avoid_: Comment (that is one message inside it)

**Signal**:
How a step run ends: Publish, Wait, or Hand-off. A run with none is idle.
_Avoid_: Result, exit

**Hand-off**:
A marker that says the work belongs to another layer.
_Avoid_: Rollback (that is what the machine does after it), escalation

**Capability**:
One rule the caller relies on, named by a kebab-case id. One spec per capability.
_Avoid_: Feature, module

**Baseline**:
The spec of a capability as the code behaves today, before the change.
_Avoid_: Current spec, main spec

**Delta**:
The change to one baseline: added, modified, removed, or renamed requirements.
_Avoid_: Diff, patch
