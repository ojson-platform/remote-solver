## Verification boundary

`live-focus-page`. Scenarios are observed on the pager and on the closed plaque. The four sentences, their order, the review gate keeping the written focus, the ask staying its own block, the badge, a live page that is not a comment or a history slot, Back when that page is the only page, and the return to now are the pager in `src/window/sidebar.test.ts`. Opening the sidebar, a worker starting, and a new written comment are the page index in that same file. The plaque's live sentence, the sentence leaving, `Done <done>/<done+open>` when no live reason applies, and the narrow `Waits for` line are the station plaque in `src/window/board.test.ts`. The row's fact that a ready action is waiting for a free slot is the held action beside the parallel cap in `src/window/live.test.ts`. The one-file command passes `--reporter=default` so that file can exit 0. The layer command keeps the coverage reporter.

one-file: `pnpm exec vitest --run --reporter=default <test-file>`
layer: `pnpm test`

fast suite: none
`pnpm run test:types`
trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`
test path: `src/**/*.test.ts` or `src/**/*.test.tsx`

## External contracts

none

## Technical prerequisites

none

## Approach

The written pager from the previous change stays the history. This change adds a live page in front of it, computed in the window, and puts that same sentence on the closed plaque until the reason passes. The window does not settle the cycle and does not write a comment.

`tick` in `src/machine/scheduler.ts` already walks ready agent decisions and stops when the running set plus the ones it starts would pass the cap. The ones not started for that reason are the held set. An idle decision is not held: the cap had room and the signature had already stopped. `runSpy` in `src/main.ts` publishes three facts the page already almost has. The worker turn stays `{phase, action}` as `RunningTurn` stores it. The held set is the issue and the action token `tick` did not start. The settled decision is the one `performCycle` just returned; a worker that this poll starts stores the agent decision that started it. A later poll that skips a busy issue leaves that stored decision in place. `src/window/live.ts` remembers the three the way it remembers turns, in maps the tracker's own refresh does not clear.

The row already copies the worker action and `running` in `publish`. It gains the held action token. The port that today returns only the action (`turn: key => turns.get(key)?.action` in the board command) also exposes the phase. The live sentence uses the phase the machine gave the worker, not the label the ticket wears now.

`liveFocus` in `src/window/focus.ts` is the only place that chooses the page. Its inputs are the worker turn, the held action, the settled decision, the check color the ticket already stores, and whether an ask is present. It returns either no live page, or `{badge, text}`.

The review gate is first, and it is not the writing phase. `reviewGateForPhase` is true for the whole of proposing, specifying, and designing, including while a worker writes the spec, and that worker's page has to show. The gate is on when the decision is a wait that carries `gate` (the proposal, the spec, or the design), or when the phase is `accepting` and the decision is a wait (checks before merge, or the person). An archive worker is an agent decision, so the accepting gate is off and the worker page can show. While the gate is on, `liveFocus` returns nothing: now stays the latest written page, and the plaque is not given the sentence.

Otherwise the order is the spec's order.

A worker turn: text is `${phase} → ${action}`, badge `working`. The issue key is not in the sentence. The page is already that issue.

A held action: text is the action token alone, badge `waiting for a slot`. This wins over a wait and over checks, including when the held action is `classify-failures`.

A wait on another issue: the decision reason starts with `wait for children` or `wait for blockers`. The sentence takes each `#<key>` the reason writes, once, in that order. When the reason names `specified` or `accepted`, the sentence ends with `until` and that word. A blocker reason that names no phase does not gain one. `#12` once stays once when that issue is both the child and the blocker. Badge `waiting on an issue`. The window does not read parent, blocked-by, or the plaque's `Waits for` line to build this sentence.

Checks, only when the decision is not that wait: `pending` is `checks are still running`. `red` is `checks are red and the failure has not been handed to a worker yet`. `green` and `none` are not this case. Badge `checks`.

Anything else, including an idle action and a wait that is not a child, a blocker, or checks, returns no live page. The latest written page stays now.

The live page is not a focus record. `blocksFor` in `src/window/sidebar.ts` prepends one block, kind `live`, badge and text, ahead of the written `kind: 'focus'` pages. It is absent from the list when the reason is gone, so Back cannot open a past one. The ask stays `kind: 'ask'` and is not copied into the live text. Reason, review, and hook stay their own blocks.

The pager in `src/window/client/sidebar.tsx` treats that live block as page 0 when it is present, then the written pages newest first. The badge is the live word, rendered with the same monospaced badge, and it is not parsed as a marker. One page still draws no pills, so Back does nothing while the live page is the only page. `focusIndexAfterSnapshot` returns to 0 when the open key changes, when the newest written body changes, and when a worker turn for this key appears. Those are the sidebar opening, a new written comment, and a worker starting. A held action or a checks page appearing does not steal the index: the index moves by one so it stays on the same written page, and moves back when the live page leaves. Index 0 while a live page is present is that page. While it is absent, index 0 is the latest written page.

`plaqueLines` in `src/window/board.ts` receives the live sentence only when `liveFocus` returned one and the ticket has no ask. The ask keeps the plaque it has today. The review gate never passes the sentence in. When the sentence is passed, it is the plaque text, and the phase row is not. `Done 1/4` returns when the sentence is absent. `childWaits` is unchanged: the narrow line is `Waits for` plus the keys of children not yet specified, and it does not gain a blocker, an until-phase, a worker, a cap, or checks. That string is the plaque text only when no live sentence is showing. The hammer still mounts from `running` and is not the sentence.

`FACE.md` names the live badge as that same monospaced badge and not a phase marker. The window glossary names the live page and the plaque sentence. The context map records the two seams: the window reads the spy's decision and does not settle, and the written prose stays untouched.

A refresh that paints tickets from the tracker must not drop the turn, the held action, or the decision. Those maps are spy memory, like the running set.

After merge the live page and the plaque sentence are that computation. No flag and no follow-up step.

Rejected: a past live reason kept as a pager page. Rejected: an issue comment or a focus marker as the live page. Rejected: the writing phase itself as the review gate. Rejected: rebuilding the wait from parent links or from `Waits for`. Rejected: an idle signature as a full cap. Rejected: the live sentence inside the ask block, or on the plaque while an ask or a review gate holds. Rejected: widening the narrow `Waits for` line. Rejected: a phase marker as the live badge. Rejected: the window calling `settle` again.

## Open decisions

none
