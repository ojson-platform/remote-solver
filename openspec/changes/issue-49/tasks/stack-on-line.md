One line holds more than one comment

## Source

Assume `phase-remark` landed. Under one drawn line, stack several threads and several comments of one thread in host order. Leave `sdd:fixed` status on the first comment and phase-without-line behavior untouched.

## Proof

Test file: `src/window/thread-line.test.ts`

Observes the rendered sidebar: one line holds more than one comment stacked in host order.

May read `src/window/thread-line.test.ts`, `src/window/client/sidebar.tsx`, and existing window test harness patterns.

Commands that must exit 0:

```
pnpm exec vitest --run --reporter=default src/window/thread-line.test.ts
pnpm test
```

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
