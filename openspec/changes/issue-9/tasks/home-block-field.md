The home block has its own agent field above the models

The field is empty until an agent is saved

## Source

Move the home agent control into the `Дом` group: a `choose-agent` select is the first control, above the model fields. While `settings.agent` is empty, the select offers a blank option so the list does not show `cursor`. The new-role block keeps name, outcome, text, and `Добавить`, posts `add-role`, and does not include an agent field. No colour, ground, or measure changes — do not edit `src/window/FACE.md`.

Seams this slice touches: the settings face (`src/window/client/settings.tsx`). Seams left for later slices: home file write (`src/window/factory.ts` `openHome.chooseAgent`), HTTP routing (`src/window/page.ts`), checkout overlay (`openOverlay`, `mergeFactory`).

May edit:

- `src/window/client/settings.tsx`
- `src/window/page.test.ts`

Leave untouched:

- `src/window/factory.ts`
- `src/window/page.ts` act handlers beyond what the face requires

## Proof

`src/window/client/settings.test.ts`

Observes the settings sheet and `settings.agent` in the window snapshot: the home block shows its agent control above the models, still shows models, watch list, and roots, and the new-role form has no agent field; with no saved agent the home agent value is empty and the painted select does not default to `cursor`.

May read: `src/window/client/settings.tsx`, `src/window/page.test.ts`, `src/window/page.harness.ts`, `src/window/window.harness.ts`, `src/window/snapshot.ts`.

Commands (exit 0):

```
pnpm test -- src/window/client/settings.test.ts
pnpm test
pnpm run test:types
```
