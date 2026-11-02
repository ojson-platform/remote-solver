A saved agent is shown

## Source

On the settings sheet, after the home file has saved an agent, the home block agent field shows that agent.

Edit `src/window/client/settings.tsx` to reflect the stored home agent in the select. Leave overlay agent, board signals, and write handlers unchanged except as needed for display.

## Proof

`src/window/home-agent.test.ts` observes the settings sheet when the home file already stores an agent (for example `cursor`). The test may read the settings markup and the home file.

Commands that must exit 0:

```bash
pnpm exec vitest --run src/window/home-agent.test.ts
pnpm test
pnpm run test:types
```

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`. The `scenario` name is the scenario title.
