# Context Map

## Contexts

- [SDLC machine](./CONTEXT.md): the shared language of one cycle
- [Machine](./src/machine/CONTEXT.md): what the machine concludes about a cycle
- [Reviewer](./src/reviewer/CONTEXT.md): the accepting pass that can stand in for a person
- [Adapters](./src/adapters/CONTEXT.md): the outsides the machine talks to

`prompts/context.md` holds the procedures skills share. It is not a glossary.

## Relationships

- **SDLC machine → Machine, Reviewer, Adapters**: cycle, phase, gate, change, layer, marker, thread, and signal keep their names from the root glossary. A module glossary adds only words that are its own.
- **Machine → Adapters**: the machine reads and writes the tracker, the review, the repository, and the runtime through ports. Adapters implement those ports. Marker grammar stays in the machine.
- **Reviewer → Machine**: the reviewer reads the change, the markers, and the review. The machine's phase policy does not know the reviewer.
- **Reviewer → Adapters**: the reviewer uses the same ports. The judge is a runtime ask, not a skill action.
