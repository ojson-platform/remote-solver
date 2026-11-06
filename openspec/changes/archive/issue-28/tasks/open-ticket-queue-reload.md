The window holds the queue for the open ticket

A reload drops unsent remarks

## Source

Queue lives in page memory in `src/window/client/main.tsx` for the open ticket only; changing the open ticket clears it. Do not persist to `sessionStorage` or the server. A reload starts a new page with no unsent remarks. Leave server and persistence paths untouched.

Seams (no child issues): in-memory queue vs reload; open ticket scope vs another ticket’s remarks.

## Proof

`src/window/unsent-remark.test.ts` observes the queue is for the open ticket and that a full reload (new page) drops unsent remarks.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/window/unsent-remark.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
