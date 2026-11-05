# Context Map

## Contexts

- [SDLC machine](./CONTEXT.md): the shared language of one cycle
- [Machine](./src/machine/CONTEXT.md): what the machine concludes about a cycle
- [Reviewer](./src/reviewer/CONTEXT.md): the accepting pass that can stand in for a person
- [Adapters](./src/adapters/CONTEXT.md): the outsides the machine talks to
- [Window](./src/window/CONTEXT.md): the face the window draws. Look: [FACE.md](./src/window/FACE.md)

`skills/sdd-flow/CONTEXT.md` holds the procedures skills share. It is not a glossary.

## Relationships

- **SDLC machine → Machine, Reviewer, Adapters, Window**: cycle, phase, gate, change, layer, marker, thread, and signal keep their names from the root glossary. A module glossary adds only words that are its own.
- **Window**: the face draws the board. It uses the phase and the gate the machine already named. The controls it draws are named in the window glossary.
- **Machine → Adapters**: the machine reads and writes the tracker, the review, the repository, and the runtime through ports. Adapters implement those ports. Marker grammar stays in the machine.
- **Reviewer → Machine**: the reviewer reads the change, the markers, and the review. The machine's phase policy does not know the reviewer.
- **Reviewer → Adapters**: the reviewer uses the same ports. The judge is a runtime ask, not a skill action.
- **Skill → Tracker**: a phase skill writes a focus through an sdd verb when a visit leaves something a person will read. The prose rules live in the shared Publish procedure. `sdd:auto-plan`, `sdd:auto-spec`, and `sdd:auto-design` do not skip it. The archive writes `sdd:focus:accept` every time, including when `sdd:auto-merge` is set. The machine does not append the layer ledger. Phase movement stays on layer threads.
- **Window → focus**: a written page shows that comment's marker as a badge and the prose under it, and the window does not rewrite that prose. Now is a live page in four cases, computed from the decision the spy settled and from whether a worker is on this issue. That page is not a comment and leaves when the reason passes. On the review gate for the proposal, the spec, the design, or accepting, now stays the written focus. The closed plaque shows the same live sentence while the reason holds and that gate is off. A phase spine row keeps the first sentence of that phase's latest comment. The Accept row caption is the merge sentence.
- **Window → Machine**: the window does not settle the cycle. The spy publishes the settled decision, the worker turn, and a ready action the cap did not start. The row already knows the worker. The held action is the fact this change adds.
- **Window → review**: the sidebar places each review thread of the open pull request on the line it anchors. A thread with no line stands on the phase. The review port supplies the thread's comments, the path, and the line. The window does not call the host. The latest comment stays the machine's marker.
