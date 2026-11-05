The Accept row's caption becomes the first sentence of that comment

Until the comment exists, the row keeps the sentence about auto-merge

Auto-merge sets the machine sentence

No auto-merge sets the person sentence

Before the spine is read the caption waits for a person

A focus comment leaves the caption

## Source

Choose the Accept caption in `projectSpine`. The latest non-manager `sdd:focus:accept` comment supplies it via `firstFocusSentence` of that body. The open focus page does not supply it. Until that comment exists, or the prose has no sentence, keep the auto-merge sentence from `gateOff`: «На приёмке машина мержит сама.» when the issue carries `sdd:auto-merge`, and «На приёмке мерж ждёт человека.» when it does not. A focus comment whose first line is not `sdd:focus:accept` does not replace the caption.

Keep the shell in `src/window/client/frame.ts` at «На приёмке мерж ждёт человека.» before the spine is read. When the Accept row is open and the caption is exactly one of the two auto-merge sentences, keep the paragraph the row shows today; any other caption leaves that paragraph out.

Leave pager navigation and scenario-name links to other tasks.

## Proof

`src/window/spine.test.ts` observes the Accept caption once the spine is read, including auto-merge, no auto-merge, and a non-accept focus comment leaving the caption. `src/window/live-frame.test.ts` observes the person sentence before the spine is read.

- `pnpm exec vitest --run --reporter=default src/window/spine.test.ts`
- `pnpm exec vitest --run --reporter=default src/window/live-frame.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
