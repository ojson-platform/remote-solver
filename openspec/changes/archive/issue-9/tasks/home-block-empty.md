The agent field sits above the models

Nothing saved leaves the field empty

## Source

On the settings sheet, the home block (`Дом`) gains a select labeled `агент` above the models, then the models, then effort and speed when that agent has them, then the watch list, then the roots. Under Roles, the new-role form keeps the name, the outcome, and the text only; it must not include a field labeled `агент`. The home agent select offers a blank choice and shows no chosen agent while the home file has no agent; it must not show `cursor` as already chosen.

Edit `src/window/client/settings.tsx` for layout and the empty choice. Leave the checkout overlay control `агент слоя`, the board row, lamp, and Take, home-file writes, and `FACE.md` untouched.

## Proof

`src/window/home-agent.test.ts` observes the settings sheet when the home file has no agent: field order, no agent chosen, and no home agent field on the new-role form. The test may read the settings markup and the home file the sheet reflects.

Commands that must exit 0:

```bash
pnpm exec vitest --run src/window/home-agent.test.ts
pnpm test
pnpm run test:types
```

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`. The `scenario` name is the scenario title.
