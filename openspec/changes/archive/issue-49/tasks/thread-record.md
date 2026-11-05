threadList asks for comments(first:100); threadRecord keeps every comment body in host order while body and comment stay the last node

## Source

Implement the review-port slice in `src/adapters/github.ts`: `threadList` uses `comments(first:100)`; nodes stay in host order; `threadRecord` keeps every comment body in that order while `body` and `comment` remain the last node so `threads()`, `readReview`, and `thread reply` still see the latest marker and comment id. Drop a thread only when it has no comment or every author is ignored. A memory seed that omits the list is one comment, the body. Leave `src/window/live.ts`, sidebar rendering, and marker grammar in the machine untouched.

Seam: the review port owns the thread record; the window places threads later. Marker grammar stays in the machine.

## Proof

Test file: `src/adapters/github.test.ts`

Observes `threadRecord`: the original comment survives when a later reply exists, ignored-only threads drop, and a person's comment with a later ignored `sdd:fixed` reply stays.

May read `src/adapters/github.test.ts`, `src/adapters/github.ts`, and existing adapter harness patterns.

Commands that must exit 0:

```
pnpm exec vitest --run --reporter=default src/adapters/github.test.ts
pnpm test
```

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
