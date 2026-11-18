- A click opens the remark draft
- An anchored row carries the file, the line, and the right side
- A row with no anchor opens a draft and shows no posted line comment

sdd-delta: 3943a98f4b1fa6c6

## Source

On the `diff-row` button when a pull request is open and the line has text: a click opens the remark draft on that line when no draft is open yet. When the row has an anchor, `data-path` is the anchored file, `data-at` is the anchored line, and `data-side` is `right`. When the row has no anchor, a click still opens the remark draft and the row shows no posted line comment (`PostedComments` stays off that path).

Keep `LineNote`, the client draft memory in `src/window/client/main.tsx`, and existing thread placement. Edit `src/window/client/sidebar.tsx` in `DiffRow`/`noteAnchor` only as needed after paint.

Seams (no child issues): draft UI on `DiffRow` versus client `button.diff-row` handler in `main.tsx` versus `PostedComments` when anchor is missing.

## Proof

`src/window/spec-diff.test.ts` observes the rendered Specify spec row: a click on a row with text and no draft opens the remark draft; an anchored row carries `data-path`, `data-at`, and `data-side` `right`; a row with text and no anchor opens a draft and shows no posted line comment.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/window/spec-diff.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.