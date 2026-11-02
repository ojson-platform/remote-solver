Choosing the saved agent again changes nothing

## Source

When the home file already stores an agent and the manager chooses that same agent again, the home file stays unchanged, including a model the manager had edited.

Edit `src/window/factory.ts` so `chooseAgent` returns after the disk check without committing when the stored home agent id already matches the choice. The home block field shows the saved agent so choosing it again is not a new value; adjust `src/window/client/settings.tsx` only if needed for that behavior. Leave overlay `chooseAgent` separate and unchanged.

## Proof

`src/window/home-agent.test.ts` observes the home file when the saved agent is `cursor`, one model was changed, and the manager chooses `cursor` again. The test may read the home file before and after the gesture.

Commands that must exit 0:

```bash
pnpm exec vitest --run src/window/home-agent.test.ts
pnpm test
pnpm run test:types
```

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`. The `scenario` name is the scenario title.
