sdd-absorbed: 2481c1dec3cb8856

## Verification boundary

`task-line`. Scenarios are observed on the task file the change sidebar paints, `TaskFile` in `src/window/client/sidebar.tsx`, in `src/window/task-line.test.ts`. Each source line renders a heading, a list, emphasis, a link, and code as markdown. Each source line stays a comment target. A click on one source line opens the remark draft for that line and does not open it for the other line. The task file paints the remark draft the click stored. No source line is a diff row. A `###` line stays a button. The path is `<readPath>/tasks/<id>.md`. The one-file command passes `--reporter=default` so that file can exit 0. The layer command keeps the coverage reporter. `pnpm test` is the CI run of the package script `vitest --run`. CI runs the type check as `pnpm run test:types`.

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

The seams are the ones `CONTEXT-MAP.md` already names. This change stays in the window, in `TaskFile` in `src/window/client/sidebar.tsx`. The machine does not settle it, and no adapter grows a call.

`TaskFile.paint` calls `paintSourceDocument` in `src/window/client/source-line.tsx` on the source lines it already paints. It does not copy a parser into `TaskFile.paint`. It does not call `partsOf`.

Each source line renders markdown: a heading, a list, emphasis, a link, and code. The line stays a comment target. A click on one source line opens the remark draft for that line and does not open it for the other line. The task file paints the remark draft that click stored. No source line is a diff row. A `###` line stays a button. The path stays `<readPath>/tasks/<id>.md`.

The click listener in `src/window/client/main.tsx` still stores that draft. `Sidebar` already holds the drafts and passes them into `TaskFile`. `TaskFile` paints the stored draft with `LineNote`, the note a stored draft already uses.

Rejected: a second parser in `TaskFile.paint`. Rejected: taking on `partsOf`, so a `###` line would not stay a button. Rejected: a diff row on the task file. Rejected: editing the file from the sidebar. Rejected: a second document viewer. Rejected: rendering the issue body. Plan, Design, Specify, and the focus block stay as they are.

After merge the task file in the change sidebar renders each source line as markdown, the line stays a comment target, and a click opens the remark draft on that line. No flag and no follow-up step.

## Open decisions

none
