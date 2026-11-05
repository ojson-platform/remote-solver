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
- **Skill → Tracker**: a phase skill writes a focus through an sdd verb when its artifact is published. The machine does not append the layer ledger. Phase movement stays on layer threads.
- **Window → focus**: the focus block pages the written focus comments and does not recompute the prose. The marker grammar stays in the machine, and `sdd:focus:accept` is one of its focus markers. Each spine row keeps the first sentence of the latest written focus of that phase. The Accept caption reads the latest `sdd:focus:accept` comment. A scenario name in the prose links to that scenario's row.
- **Window → review**: the sidebar places each review thread of the open pull request on the line it anchors. A thread with no line stands on the phase. The review port supplies the thread's comments, the path, and the line. The window does not call the host. The latest comment stays the machine's marker.
