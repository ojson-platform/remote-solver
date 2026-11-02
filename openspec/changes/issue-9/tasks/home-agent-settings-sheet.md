Nothing saved leaves the field empty

The new-role form does not write the home agent

A saved agent shows in the field

## Source

`src/window/page.ts` serves settings HTML through the page surface; split `add-role` from `choose-agent` so the new-role form posts only role fields.

`src/window/client/settings.tsx` moves the home agent control into the «Дом» block: an `ActForm` with `act="choose-agent"`, label `агент`, above `ModeFields`, watch list, and roots. The new-role form under Roles keeps only role fields and posts `add-role` with no agent control.

`src/window/client/frame.ts` treats `add-role` as a settings-sheet gesture alongside `choose-agent`.

`src/window/window.ts` and snapshot types: `settings.agent` is empty when the home file records no agent; when the home file names an agent, the field shows that agent.

Leave overlay UI, home writes in `src/window/factory.ts`, and board wiring untouched.

## Proof

`src/window/page.test.ts` observes the rendered settings sheet: agent field labeled `агент` above the models, watch list and roots still present, new-role form without a home-agent control, empty agent field when the home file has no agent, and the saved agent when the home file names one. Tests may read snapshot fixtures and HTML from the page surface only.

- `pnpm test src/window/page.test.ts`
- `pnpm test`
- `pnpm run test:types`
