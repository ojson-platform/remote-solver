## Verification boundary

`phase-thread-accept`. The modified requirement is observed on the rendered spine of the open ticket, in `src/window/acceptance.test.ts`. Each scenario drives Plan, Specify, or Design through the page that file already hosts, with the open review threads on that window's review reading. The row that would show acceptance shows the `accept-review` control in the gate's place. A thread that counts leaves that control inactive, and its hover names the phase and says a thread on that phase is still open. A later-phase thread and a note leave the control active and do not say that. An open question leaves the place empty. The requirement "A thread of this phase withholds the accept ask" is unchanged and is not observed again here. The one-file command passes `--reporter=default` so that file can exit 0. The layer command keeps the coverage reporter. `pnpm test` is the CI run of the package script `vitest --run`.

one-file: `pnpm exec vitest --run --reporter=default <test-file>`
layer: `pnpm test`
fast suite: none
`pnpm run test:types`
trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`
test path: `src/**/*.test.ts`, `src/**/*.test.tsx`

## External contracts

none

## Technical prerequisites

Depends: #49. The open review already carries each thread's marker. This change does not draw threads and does not build that reading.

## Approach

The window and the machine disagree on this row. `layerAct` in `src/window/snapshot.ts` returns `accept` whenever the current Plan, Specify, or Design row would show acceptance, and it does not read threads. The sidebar then paints an active «Принять». The machine already withholds the ask. `decideOpen` classifies an unmarked thread, continues a thread marked for this phase, and opens the gate for a later-phase thread and for a note. That rule stays in `src/machine/policy.ts` and `src/machine/review.ts`. This change does not set or clear `sdd:wait-human` and does not add a second gate.

The count belongs to `layerAct`, on the same branch that would return `accept`. `LayerAct` gains `held`. `none` and `gate` stay what they are. The open window already holds the review: `sidebar()` reads `review(key)`, and the marker on each thread is the one `live.ts` stored. The window object exposes that same reading, the page passes it into the snapshot, and a missing reading means no counting thread. The client does not match `sdd:` tokens. `shellAct` stays the gate: the shell has no review.

A thread counts when its marker is absent, or it is `proposal` on Plan, `spec` on Specify, or `design` on Design. Any other marker does not, including a later phase, an earlier phase, `note`, `fixed`, `out`, and `begin`. One counting thread is enough, whether or not it has a line. A conversation comment is not a thread. The count runs only after the row would show acceptance. An open question, an open decision, a spec turn, a missing baseline, and a missing artifact still return `none`, and a counting thread does not fill that place.

`hereControl` in `src/window/client/sidebar.tsx` paints `held` as the same `accept-review` form in that place. The button stays «Принять», with `aria-label` `Принять ${name}`, and it is `disabled`, so it does not submit. Its `title` is `${name}: нить этой фазы ещё открыта`, where the name is Plan, Specify, or Design. The active control has no such title. The row does not gain `data-gate`. The accept handler is unchanged.

No new colour, ground, or measure. `FACE.md` stays. Tasks, Code, and Accept are unchanged. After merge the inactive control is the window's. No flag and no follow-up step.

Rejected: removing «Принять», and putting the gate sign back in that place. Rejected: leaving the control active. Rejected: counting in the client by matching `sdd:` tokens. Rejected: a second withhold in the machine. Rejected: inactivating the control for a later-phase thread, an earlier-phase thread, or a note. Rejected: filling the empty place an open question leaves. Rejected: treating a conversation comment as a thread. Rejected: drawing threads on their lines, and changing the unsent-remark queue.

## Open decisions

none
