# Reviewer

The accepting pass that can stand in for a person. It is not a phase and not a skill. The machine's phase policy does not include it.

## Language

### The pass

**Reviewer**:
The pass over accepting cycles a person has marked for this judgment.
_Avoid_: Review, spy, skill

**Pass**:
One walk of every issue the reviewer may touch.
_Avoid_: Run, poll, tick

**Ready**:
An accepting cycle wearing the reviewer label, with one open pull request, and no auto-merge tag.
_Avoid_: Open, queued

**Skip**:
An issue the reviewer sees and leaves alone: it is not accepting yet, or auto-merge will merge it.
_Avoid_: Wait, ignore

### The judgment

**Dossier**:
The commits, the diff, the change, and the written standards, as one packet.
_Avoid_: Context, prompt, bundle

**Judge**:
The reader of one dossier. It returns a verdict and does not post or merge.
_Avoid_: Model, reviewer

**Verdict**:
The judge's answer: clean, remarks, or unjudged.
_Avoid_: Decision, review, approval

**Clean**:
A verdict that this head should merge.
_Avoid_: Approve, LGTM

**Remark**:
One reason the change should go back, written as a person would write it.
_Avoid_: Comment, thread, finding

**Unjudged**:
A verdict that is neither clean nor remarks. The pass posts nothing and merges nothing.
_Avoid_: Error, failure

**Reviewed note**:
The note that names the head a clean verdict already covered. That head is not judged again.
_Avoid_: Approval, memory

### What a remark is about

**Change axis**:
Whether the diff fulfills the change and contains nothing the change does not ask for.
_Avoid_: Spec, coverage

**Standards**:
Rules written in the repository files the service names as its standards. A remark on this axis cites one of those files.
_Avoid_: Style, lint, code smell
