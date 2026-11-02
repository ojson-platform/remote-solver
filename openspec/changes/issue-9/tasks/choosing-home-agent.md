Choosing an agent writes the home file at once

Choosing the saved agent again changes nothing

## Source

Home `choose-agent` submits only the agent; `roleDraft` must not add a role from that post. The new-role form posts `add-role` only so `Добавить` does not write the home file. In `openHome.chooseAgent`, when the chosen id is already the agent in the home file, return before `commit` so a repeated choice leaves the file unchanged; a different id still runs `replaceAgent` (agent, known pair, effort when the pair has it, no speed key) behind `canWrite`.

Seams: home file write (`replaceAgent`, `commit`, home path). Seams left untouched: checkout overlay write path, `mergeFactory` / merged overlay display, board lamp from home agent.

May edit:

- `src/window/factory.ts`
- `src/window/page.ts`
- `src/window/client/settings.tsx` (only if the home or role forms still need act wiring)
- `src/window/settings.test.ts`
- `src/window/window.harness.ts` (helpers the proofs need)

Leave untouched:

- `openOverlay`, overlay agent clear/set, service-config save path
- ADR 0029 out-of-scope behavior (project agent, non-cursor overlay changing launched model)

## Proof

`src/window/factory.test.ts`

Observes the home file on disk and window settings state: choosing a new agent writes the file at once with that agent and its known pair; choosing the same saved agent again leaves the file bytes unchanged (including models the manager edited after the first save).

May read: `src/window/factory.ts`, `src/window/settings.test.ts`, `src/window/window.harness.ts`, `src/window/page.ts`.

Commands (exit 0):

```
pnpm test -- src/window/factory.test.ts
pnpm test
pnpm run test:types
```
