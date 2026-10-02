---
status: accepted
---

# `skills/sdd-flow/CONTEXT.md` holds every procedure two steps share; a step holds only its action

Publish (clean tree, commit rule, `publish`, mirror line), Fix thread, Hand-off, Wait, the delta grammar, the change-file headings (Artifacts), and the layer table live once in `skills/sdd-flow/CONTEXT.md`. A step names the section and the layer (`Fix thread, layer spec`; `Publish. Mirror: Specify.`) and nothing more. The spy prompt loads that file with every step, so the pointer is always resolvable.

The alternative, a self-contained file per action, is the usual convention and was the state before: the `sdd:fixed` protocol was written five times, the publish cargo seven, and the OpenSpec delta grammar nowhere, so agents read `node_modules/@fission-ai/openspec` (twenty-five times in one `improve-specs` run) and each other's files (seven of ten in that same run) to fill the gaps. One source keeps a change to a procedure a one-file edit and keeps a step short enough that its own instructions stay in view.

A test guards the shape: every step points at `CONTEXT.md`, its Stop section names a signal, a step does not name another step, and the route in `src/machine/route.ts` matches the `sdd-flow` Actions table.
