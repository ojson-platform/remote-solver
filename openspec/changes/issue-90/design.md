sdd-absorbed: bfa2878e4eb945d1

## Verification boundary

`focus-prose`. Scenarios are observed on the written focus the sidebar draws, the rendered `FocusBlocks` in `src/window/sidebar.test.ts`. The prose beside the badge renders a heading, a list, emphasis, a link, and code, and the heading mark, the list mark, the emphasis marks, the link marks, and the code marks do not stay the characters that were written. That prose is not left in a `pre`. The badge is the first line, and the prose beside the badge is the words after that line and those words are not rewritten. The marker line is the badge, the badge is the first line, and that line is not a heading. A scenario name in that prose is a `button.jump`. The prose beside the badge is the written prose and is not the live page sentence. The one-file command passes `--reporter=default` so that file can exit 0. The layer command keeps the coverage reporter.

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

The seams are the ones `CONTEXT-MAP.md` already names. The window draws the focus block and does not rewrite the written prose. The marker line is the badge and the first line. `focusBlockProse` in `src/window/focus.ts` is the words after that line, and those words are not rewritten.

`FocusBlocks` in `src/window/client/sidebar.tsx` renders that prose beside the badge. The text is painted with `paintSourceDocument` in `src/window/client/source-line.tsx`, the line renderer the window already uses. A heading, a list, emphasis, a link, and code render, and the heading mark, the list mark, the emphasis marks, the link marks, and the code marks do not stay the characters that were written. The prose is not left in a `pre`. The marker line is the badge span and is not a heading.

A scenario name in that prose stays a `button.jump`. `linkFocusProseParts` still separates that name, and the paint runs on the text around it. The prose beside the badge is the written prose and is not the live page sentence.

Rejected: a second parser for this prose. Rejected: leaving the prose in a `pre`.

The drawing session updates `src/window/FACE.md` and the Focus block entry in `src/window/CONTEXT.md`: the prose beside the badge renders as markdown and is not a quiet pre, and the marker line is not a heading.

After merge the written prose beside the badge is that paint. No flag and no follow-up step.

## Open decisions

none
