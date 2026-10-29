Leaving a model empty writes the empty field

## Source

`src/window/page.ts` `leave-model` posts model edits from the home block.

`src/window/factory.ts` `openHome.leaveModel`: when a home agent is recorded, clearing a model field (including `models.judgment`) and leaving the field writes that empty value to the home file; settings continue to mark the field as needing a value. Empty effort and speed behavior stays unchanged. Closing settings must not erase values already written from the home block.

`src/window/page.ts` `leave-model` and `src/window/client/settings.tsx` model fields may need to align with recorded-agent writes only; do not change overlay model acts.

## Proof

`src/window/page.test.ts` observes the home file after `leaveModel('judgment', '')` and the settings sheet warning for an empty judgment model. Tests may use the page/window test harness and home file reads used in that file.

- `pnpm test -- src/window/page.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
