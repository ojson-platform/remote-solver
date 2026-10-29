The agent field sits above the models

The new-role form has no agent field

An unsaved agent field is empty

## Source

`src/window/page.ts` serves settings HTML through the page surface; leave acts other than settings layout untouched.

`src/window/client/settings.tsx` moves the home agent control out of the new-role form. The block «Дом» gets its own `ActForm` with `act="choose-agent"`, label `агент`, placed above the models (`ModeFields`), watch list, and roots. The new-role form keeps only role fields and `act="add-role"`. Until the home file records an agent, the select shows empty (blank option and `defaultValue` from `settings.agent`); do not pre-select `cursor` when nothing is saved. Leave `src/window/page.ts` `choose-agent` handling, `src/window/factory.ts` home writes, overlay UI, and board wiring untouched.

Adjust `src/window/window.ts` (and snapshot types if needed) so `settings.agent` is empty when the home file has no agent.

## Proof

`src/window/page.test.ts` observes the rendered settings sheet: agent field label and order above models, watch list and roots still present, new-role form without an agent control, and an empty agent field when the home file has no agent. Tests may read snapshot fixtures and HTML from the page surface only.

- `pnpm test -- src/window/page.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
