The home block has its own agent field above the models and the new-role form does not

## Source

Move the home agent control into the home block above the model fields, watch list, and roots. Label it `агент`. Remove the agent field from the new-role form under Roles; that form keeps name, outcome, text, and `Добавить` only.

Edit `src/window/client/settings.tsx` for layout and labels. Edit `src/window/page.ts` so `choose-agent` on the home field does not require role form fields and `add-role` does not write the home agent. Leave `openHome` / `openOverlay` in `src/window/factory.ts` and overlay group behavior unchanged in this slice.

Update `src/window/FACE.md` when control placement or labels change.

## Proof

Test file: `src/window/client/settings.test.ts`

The test observes settings HTML: the home block shows `агент` above the models, watch list, and roots; the new-role form under Roles has no agent field and still posts `add-role` with name, outcome, and text.

May read: `src/window/client/settings.tsx`, `src/window/page.ts`, `src/window/page.harness.ts`, `src/window/window.harness.ts`.

Commands (exit 0):

- `pnpm test -- src/window/client/settings.test.ts`
- `pnpm test`
- `pnpm run test:types`

`pnpm test` runs `vitest --run` from `package.json`. CI runs that script as `pnpm test` and the type check as `pnpm run test:types`.
