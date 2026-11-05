A remark with no line stands on the phase

## Source

Assume `anchor-on-line` landed. When a thread has no line, stand it on the phase its path names: `proposal.md` Plan, `specs/<capability>/spec.md` Specify, `design.md` Design, `tasks.md` or `tasks/<id>.md` Tasks, any other path Code. On Plan, Specify, and Design put the comment in the phase foot above the draft remark; on Tasks and Code at the top of that fold. When the line is not among drawn lines, use the same phase placement with path and line so the comment is not dropped. A closed spec fold renders the comment when it renders the row; do not open the fold or draw source lines. Leave draft, send, fixed status, and multi-comment stacking untouched.

## Proof

Test file: `src/window/thread-line.test.ts`

Observes the rendered sidebar: a remark with no line stands on the phase, and a thread whose line is not drawn stands on the phase with its path and line.

May read `src/window/thread-line.test.ts`, `src/window/client/sidebar.tsx`, and existing window test harness patterns.

Commands that must exit 0:

```
pnpm exec vitest --run --reporter=default src/window/thread-line.test.ts
pnpm test
```

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
