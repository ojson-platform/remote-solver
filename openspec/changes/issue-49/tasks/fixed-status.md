A reply whose marker is sdd:fixed is a status on the original comment, with the commit when the reply has one

It is not a second comment

## Source

Assume `stack-on-line` landed. In `src/window/live.ts`, `reviewOf` splits comments with `parseMarker`; a reply whose marker is `fixed` is not a comment—it is a status on the first comment with `marker.commit` when the reply has one. The client does not match `sdd:` tokens and does not call the host. In the sidebar, show that status on the first comment of its thread; show the commit when present and no commit when absent; do not draw the reply as another comment under the line. Leave draft, send, resolving threads, and «Принять» untouched.

## Proof

Test file: `src/window/thread-line.test.ts`

Observes the rendered sidebar: a reply whose marker is `sdd:fixed` is a status on the original comment with the commit when the reply has one, and it is not a second comment.

May read `src/window/thread-line.test.ts`, `src/window/live.ts`, `src/window/client/sidebar.tsx`, and existing window test harness patterns.

Commands that must exit 0:

```
pnpm exec vitest --run --reporter=default src/window/thread-line.test.ts
pnpm test
```

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
