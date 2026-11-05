## Verification boundary

`link-mark`. Scenarios are observed on the rendered window page that `src/window/board.test.ts` already draws. The column card and the pool card are both `Ticket` in `src/window/client/board.tsx`. The open sidebar is `Sidebar` in `src/window/client/sidebar.tsx`. Both render one mark list from `src/window/board.ts`. The corner, the two arrows, and the wrap are the face stylesheet. The reason line is that same page.

one-file: `pnpm exec vitest --run --reporter=default <test-file>`
layer: `pnpm test`
fast suite: none

`dependencies`. The tasking wait, the implementing wait, the single count, the rollback, and every other phase are observed at `decide` in `src/machine/dependencies.test.ts`. Reading and writing parent, blocks, blocked-by, and depends-on, and leaving a body line unread, are observed at the GitHub adapter in `src/adapters/github.test.ts` and the Arcanum adapter in `src/adapters/arcanum.test.ts`.

one-file: `pnpm exec vitest --run --reporter=default <test-file>`
layer: `pnpm test`
fast suite: none

The one-file command passes `--reporter=default` so that file can exit 0. The layer command keeps the coverage reporter. `pnpm test` is the CI run of the package script `vitest --run`.

trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`
`pnpm run test:types`

## External contracts

none

## Technical prerequisites

none

## Approach

The tracker port is the only seam that knows a link. `IssueRecord` keeps `parent` and `dependsOn` and gains `blockedBy` and `blocks`. GitHub's tracker adapter and Arcanum's adapter fill those four fields from the host's own issue links and write them back. `linksFrom` is deleted. A `Parent:` line or a `Depends:` line does not fill a field, in `asRecord` or in `memoryPorts`. Policy and the window never read the body for this.

Arcanum today only posts on a pull request. This change adds the four issue-link kinds beside that, through the same fixture HTTP the pull-request comments already use, and adds nothing else of that tracker. A host kind the response does not carry is an empty list. A write sends that host kind. It does not send a body line. GitHub's parent is its parent relationship. GitHub's wait is blocked-by and its hold is blocks. A `depends-on` write on a host that has no separate depends-on kind writes that host's blocked-by link, and the read stores it in the field the host actually returned, so one relationship is one field.

`children` in `src/machine/policy.ts` stays parent plus `sdd:cycle` on the open list. `blockers` becomes the union of `blockedBy` and `dependsOn` on that same list, each issue once. `blocks` is not a blocker. An issue that is both a child and a blocker is named in the child wait and is not named again in that same decision. Tasking still waits on a child that is not at least `specified`, including a cancelled child, and the decision reason still names that child. Implementing still runs an open task before it looks at links, then waits until every child is `accepted`, then waits while a blocker is open, then moves to `verifying`. A closed issue is absent from the open list, so it does not hold that wait. No other phase calls `children` or `blockers`. Rollback still advances only this issue. The linked issue is another key and is left as it was.

The window copies the four fields in `src/window/live.ts`. One function in `src/window/board.ts` builds three lists from the cards on the board, not from the open list and not from issues past the next one. Children are cards whose parent is this key and whose labels include `sdd:cycle`. Waits are cards named by `blockedBy` or `dependsOn`, one chip when both name the same issue. Holds are cards named by `blocks`. Each list is key order. The row is children, then waits, then holds. A child and a blocker that are the same issue produce both chips. A cancelled issue and a closed issue have no card, so they have no chip. The child card has no chip for its parent.

`reasonParts` drops `дети` and `блокеры`. Open questions, Ask, and the merge stay, and so do the other parts that block does not name. The decision reason that names a child or a blocker stays on the settlement. It is not copied back into the reason block.

`Ticket` draws the chips under the title in `.ident`, so the column card and the pool card share them. The chip row wraps and the ticket grows with it. It is not a clamped line and it is not clipped. `Sidebar` draws the same list in `<header>`, under the title and outside `.side-scroll`, so the chips stay while the body scrolls. A chip is its own `open` form. The hidden key is the issue the chip names. The form is not inside the form that opens the card it stands on. Hovering sets that issue's title.

The child mark is a corner of the edge, down and then right, with no arrowhead. The wait mark is a muted arrow to the left. The hold mark is a brass arrow to the right. The number is the key. That look is recorded on the face. The words `Child`, `Blocker`, and `Chip` are recorded in the module glossaries. The port decision is ADR 0033.

The flow that opens a child or a dependency is the tasks step. A skill writes the tracker only through an sdd verb. The verb is `node scripts/sdd.mjs link <key> <kind> <other>`, with `<kind>` one of `parent`, `blocks`, `blocked-by`, and `depends-on`. It calls the port write and does not change the body. A new child is still filed in the first queue, `remote-solver`, with `sdd:cycle`, and the step then runs `link <child> parent <this issue>`. A dependency is `link <this issue> depends-on <other>`. The step stops writing `Parent:` and `Depends:`.

After merge the body line is not a link, and this change does not convert old lines into host links. No flag and no follow-up step.

Rejected: parsing the body when the host field is empty. Rejected: a chip on the child that names its parent. Rejected: edges between cards. Rejected: listing an issue past the direct link. Rejected: one chip when the issue is both a child and a blocker. Rejected: leaving children and blockers in the reason block. Rejected: a link wait in any phase but tasking and implementing. Rejected: moving the linked issue on rollback. Rejected: storing the chips on the issue. The card, the pool, and the sidebar derive them from the board.

## Open decisions

none
