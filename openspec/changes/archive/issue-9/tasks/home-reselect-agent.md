Choosing the saved agent again changes nothing

## Source

When the manager chooses on home `агент` the agent the home file already records, `openHome.chooseAgent` returns without writing. Custom mechanical, judgment, effort, and speed on disk stay as they were.

Edit `src/window/factory.ts` (`openHome.chooseAgent`). Leave overlay and new-role paths untouched.

## Proof

Test file: `src/window/factory.test.ts`

The test observes: home file unchanged after re-selecting `cursor` when mechanical was customized; disk content and settings models still show the custom mechanical.

May read: `src/window/factory.ts`, `src/window/window.ts`, `src/window/window.harness.ts`.

Commands (exit 0):

- `pnpm test -- src/window/factory.test.ts`
- `pnpm test`
- `pnpm run test:types`

`pnpm test` runs `vitest --run` from `package.json`. CI runs that script as `pnpm test` and the type check as `pnpm run test:types`.
