The pager's open page is a live page in four cases

The window computes it from the current decision and from whether a worker is on this issue

It is not an issue comment, it is not a history slot, and it disappears when the reason passes

Past live reasons are not pages

A worker on this issue shows the phase and the action

A full cap shows the next action

A wait on another issue names who and until which phase

An implementing child is named until accepted

A child and a blocker are named the way the decision names them

One number is named once

Checks still running

Checks are red and the failure has not been handed to a worker yet

A worker on this issue wins

A ready action that the cap held back is the open page

A wait on another issue is the open page

Checks are the open page

The latest written page stays open

The badge is working

The badge is waiting for a slot

The badge is waiting on an issue

The badge is checks

## Source

Implement `liveFocus` in `src/window/focus.ts` as the only chooser for a live page: inputs are worker turn, held action, settled decision, check color, and ask presence; output is no live page or `{badge, text}` with review gate off and priority worker, then held action, then child/blocker wait, then checks. Prepend one `kind: 'live'` block in `src/window/sidebar.ts` `blocksFor` ahead of written focus pages; omit it when the reason is gone. In `src/window/client/sidebar.tsx`, treat the live block as page 0 when present, render badge as monospaced live word not a marker, and keep ask/reason/review/hook separate.

Update `src/window/FACE.md` and window glossary entries for the live page and badge in the session that draws them.

Leave review-gate suppression, plaque sentence, pager return-to-now index rules, and Accept caption to later tasks unless wiring requires a shared helper.

Seams (no child issues): window reads spy decision and does not settle; written prose stays untouched.

## Proof

`src/window/sidebar.test.ts` observes the live page in the four cases, sentence text and priority order, that it is not a comment or history slot, past live reasons absent from Back, and the live badge labels.

- `pnpm exec vitest --run --reporter=default src/window/sidebar.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
