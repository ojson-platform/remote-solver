sdd-absorbed: 60598f439f900bc1

## Verification boundary

`focus-prose`. Scenarios are observed on the written focus the sidebar draws, the rendered `FocusBlocks` in `src/window/sidebar.test.ts`. The prose beside the badge renders a heading, a list, emphasis, a link, and code, and the heading mark, the list mark, the emphasis marks, the link marks, and the code marks do not stay the characters that were written. That prose is not left in a `pre`. The badge is the first line, and the prose beside the badge is the words after that line and those words are not rewritten. The marker line is the badge, the badge is the first line, and that line is not a heading. A scenario name in that prose is a `button.jump`. When a scenario name sits on a line of a multi-line list item, the prose beside the badge shows that item's list mark once and a heading mark on that line once, in front of the jump button, that line's document paint does not include those two marks, and the paint runs on the text around the name, including a later line of the item, where emphasis, a link, and code render as markdown. When a scenario name sits on the first line of a list item that spans three or more lines, and that line has no text after the name, the words on the line between the first and the last are beside the badge. Those words are the words after the marker line, and they are not rewritten. When a scenario name sits on the first line of a multi-line list item and text remains on that line after the name, an emphasis mark, a link mark, and a code mark that each open on that line and close on a later line render as markdown. Those marks do not stay the characters that were written. The jump line does not show the written emphasis mark, the written link mark, or the written code mark. The later line does not paint that mark on its own. When a scenario name sits on a later line of a multi-line list item and that line carries a heading mark, the prose beside the badge shows that item's list mark once and a heading mark on that line once, in front of the jump button. That line is not painted as a heading. That line's document paint does not include those two marks. The prose beside the badge is the written prose and is not the live page sentence. The one-file command passes `--reporter=default` so that file can exit 0. The layer command keeps the coverage reporter.

one-file: `pnpm exec vitest --run --maxWorkers=1 --reporter=default '<test-file>' -t '<titles>'`
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

A scenario name in that prose stays a `button.jump`. `linkFocusProseParts` still separates that name, and the paint runs on the text around it. When a scenario name sits on a line of a multi-line list item, the prose beside the badge shows that item's list mark once and a heading mark on that line once, in front of the jump button. That line's document paint does not include those two marks. The paint runs on the text around the name, including a later line of the item. Emphasis, a link, and code on that line render as markdown. The prose beside the badge is the written prose and is not the live page sentence.

When a scenario name sits on the first line of a list item that spans three or more lines, and that line has no text after the name, the words on the line between the first and the last stay beside the badge. Those words are the words after the marker line, and they are not rewritten. When a scenario name sits on the first line of a multi-line list item and text remains on that line after the name, an emphasis mark, a link mark, and a code mark that each open on that line and close on a later line render as markdown. Those marks do not stay the characters that were written. The jump line does not show the written emphasis mark, the written link mark, or the written code mark. The later line does not paint that mark on its own. When a scenario name sits on a later line of a multi-line list item and that line carries a heading mark, that line is not painted as a heading. The prose beside the badge shows that item's list mark once and a heading mark on that line once, in front of the jump button, and that line's document paint does not include those two marks.

Rejected: a second parser for this prose. Rejected: leaving the prose in a `pre`.

The drawing session updates `src/window/FACE.md` and the Focus block entry in `src/window/CONTEXT.md`: the prose beside the badge renders as markdown and is not a quiet pre, and the marker line is not a heading. When a scenario name sits on a line of a multi-line list item, that entry also says the list mark and a heading mark on that line stay once in front of the jump button, the document paint does not include those two marks, and emphasis, a link, and code on that line render as markdown. When a scenario name sits on the first line of a list item that spans three or more lines and that line has no text after the name, that entry says the words on the line between the first and the last stay beside the badge and are not rewritten. When an emphasis mark, a link mark, and a code mark each open on that first line and close on a later line, that entry says those marks render as markdown, the jump line does not show the written marks, and the later line does not paint that mark on its own. When a heading mark sits on a later line of the item, that entry says that line is not painted as a heading.

After merge the prose beside the badge shows the list mark and a heading mark once in front of the jump button, and emphasis, a link, and code on that line render as markdown. A middle line of a list item that spans three or more lines stays beside the badge. A mark that opens on the first line and closes on a later line renders as markdown, the jump line does not show the written mark, and that later line does not paint the mark on its own. A later line that carries a heading mark is not painted as a heading. No flag and no follow-up step.

## Open decisions

none
