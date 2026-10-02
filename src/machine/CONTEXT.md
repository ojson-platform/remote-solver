# Machine

What the machine concludes about a cycle: which phase it is in, which skill to start, or who it is waiting on. Shared words — cycle, phase, gate, change, spy, layer, marker, thread, signal, hand-off — stay in the root glossary.

## Language

### Reading

**Decision**:
One outcome for a cycle this reading: agent, advance, wait, merge, or done.
_Avoid_: Action, step, result

**Advance**:
A decision that sets the phase and does not start a skill.
_Avoid_: Transition, promotion

**Settlement**:
The phase labels left after a reading has applied every advance, together with the decision that stopped it.
_Avoid_: Plan, schedule

**Action**:
The named piece of work one step does. Each action belongs to one step.
_Avoid_: Command, workflow step, annotation

**Idle**:
The spy's memory that this same agent decision already ended with no commit.
_Avoid_: Failure, skip

### People and marks

**Ask**:
The issue comment that says how a person closes the current gate.
_Avoid_: Prompt, instruction

**Auto tag**:
A label that lets the machine pass a wait that otherwise belongs to a person: the proposing, specifying, and designing gates, or the merge.
_Avoid_: Flag, option

**Robot**:
A comment the machine wrote, or a commenter the service listed as ignored. A login ending in `[bot]` is still a person.
_Avoid_: Bot

**Conversation**:
Comments on the pull request that are not attached to the diff. A marker here can still name a layer.
_Avoid_: Thread, review body

**Unanswered**:
A thread or conversation whose latest word is a person's and carries no marker.
_Avoid_: Open comment

**Rollback**:
An advance back to the earliest phase an open layer marker names. It is what follows a hand-off.
_Avoid_: Revert, reset

**Mirror**:
The marked block in the issue body, one line per layer. Text outside the block is the author's.
_Avoid_: Summary, description

### Other cycles

**Queue label**:
The service's label an issue wears, together with the cycle label, to be in the spy's intake.
_Avoid_: Board, column, backlog

**Child**:
A cycle that names this issue as its parent.
_Avoid_: Sub-issue, subtask

**Blocker**:
An issue this cycle says it depends on, while that issue is still open.
_Avoid_: Dependency, link

### The pull request

**Checks**:
The pull request's status checks as one color: green, red, pending, or none.
_Avoid_: CI, status

**Merge**:
Rebase of the pull request into its base branch. The accepted phase is the cycle after that rebase has landed.
_Avoid_: Accept, archive

**Archive**:
The change once it has left the active directory and its delta sits in the baseline.
_Avoid_: Merge, close
