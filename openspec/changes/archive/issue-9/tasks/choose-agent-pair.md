Choosing cursor from an empty field writes the pair

Choosing codex writes the pair

## Source

Choosing an offered agent on the home block submits `choose-agent` at once and writes the home file with that agent and its known pair. From an empty home file, `cursor` writes `composer-2.5-fast` and `grok-4.7-high-fast`; `codex` writes `gpt-6-luna` and `gpt-6.1-sol`. The blank choice is not an offered agent: posting it writes nothing and does not clear a saved agent.

Edit `src/window/client/settings.tsx` for immediate `choose-agent` submission on agent choice. Edit `src/window/page.ts` so `choose-agent` calls `chooseAgent` only when the posted id is non-empty. Edit `src/window/factory.ts` (`openHome`, `chooseAgent`, `replaceAgent`) for the known-pair writes. Leave the overlay `choose-overlay-agent` path and board read of the home agent unchanged.

## Proof

`src/window/home-agent.test.ts` observes the home file after choosing `cursor` and after choosing `codex` from an empty home file. The test may read the home file and the settings gesture that posts `choose-agent`.

Commands that must exit 0:

```bash
pnpm exec vitest --run src/window/home-agent.test.ts
pnpm test
pnpm run test:types
```

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`. The `scenario` name is the scenario title.
