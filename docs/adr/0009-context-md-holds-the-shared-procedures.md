---
status: accepted
---

# `prompts/context.md` holds every procedure two skills share; a skill holds only its action

Publish (clean tree, commit rule, `publish`, mirror line), Fix thread, Hand-off, Wait, the delta grammar, the change-file headings (Artifacts), and the layer table live once in `prompts/context.md`. A skill names the section and the layer (`Fix thread, layer spec`; `Publish. Mirror: Specify.`) and nothing more. The prompt loads `context.md` with every skill, so the pointer is always resolvable.

The alternative, a self-contained `SKILL.md` per action, is the usual convention and was the state before: the `sdd:fixed` protocol was written five times, the publish cargo seven, and the OpenSpec delta grammar nowhere, so agents read `node_modules/@fission-ai/openspec` (twenty-five times in one `improve-specs` run) and each other's skills (seven of ten in that same run) to fill the gaps. One source keeps a change to a procedure a one-file edit and keeps a skill short enough that its own steps stay in view.

A test guards the shape: every action skill points at `context.md`, its Stop section names a signal, only `sdd-flow` names other skills, and the route in `src/machine/route.ts` matches each Trigger and the `sdd-flow` table.
