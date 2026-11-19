sdd-absorbed: e3b0c44298fc1c14

## Verification boundary

This change names no capability. No scenario is observed on this issue. The caller-visible rule arrives on a child.

The one-file command passes `--reporter=default` so that file can exit 0. The layer command keeps the coverage reporter. `pnpm test` is the CI run of the package script `vitest --run`.

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

The window already separates the text of a surface from the leaf that owns the comment. A markdown engine is one function that turns the text of one source line into headings, lists, emphasis, links, and code. The leaf stays the parent of that text. Joining a section into one document would drop the per-line anchor, and a reload would not show the same comment on the same line. This issue files the children that call that function. It does not implement the function.

`PlanDocument` and `DesignDocument` in `src/window/client/sidebar.tsx` both paint through `PlanLines`. That is one change. One child covers both surfaces. The rule the caller sees on each: every source line the leaf paints renders that markdown, the line stays a comment target, and a click opens the remark draft on that line. Neither surface has a diff row. The child introduces the line renderer in the window, where the later children call it. `PlanLines` stays the leaf. `data-line` stays the source line with its trailing space removed, and that string stays the draft key. `data-path` stays `<readPath>/proposal.md` or `<readPath>/design.md`. `data-at` stays the source line number `sectionsOf` already assigned. `data-side` stays `right`. `LineNote` and `PostedComments` stay on that path and line. Design still passes `model.design.questions` only for Open questions and an empty list for every other section, so a checkbox outside that section stays a line comment. A `##` line stays the section `h3` and is not a button. A `###` line stays the `h4` from `partsOf` and is not a button. A run of blank lines stays one `span.gap`. With no pull, the line stays a `p.line` and is not a comment target. The phase foot stays outside the document.

Specify is the next child, after that one is accepted. Its surface is the spec diff. `SpecRows` paints `DiffRow`. The rule the caller sees: the row text renders the same markdown, the row keeps its add and delete coloring and its comment control, and a click opens the remark draft. The coloring is the row class `diff-row` plus `add`, `del`, or `ctx`, and `span.bit` on a changed span. The comment control is the row button, not a `button.line`. `data-line` stays `row.text`. The anchor stays `row.anchor` when the row has one: path, line, side `right`. Number cells, `data-scenario`, and the fold bar stay. A row with no anchor still opens a draft and still shows no posted line comment.

The remaining surfaces are two children, both after Specify is accepted. The study names no other. The issue description, the ask, the hook, a posted comment, and the code rest are not change documents.

Tasks is the task file, `TaskFile`. The rule the caller sees: each source line renders the same markdown, the line stays a comment target, and a click opens the remark draft. There is no diff row. This surface does not use `partsOf`, so a `###` line stays a button. The path stays `<readPath>/tasks/<id>.md`. `TaskFile` does not paint `LineNote` today. The click in `src/window/client/main.tsx` already stores the draft, and this child paints it. The child calls the renderer. It does not copy a second parser into `TaskFile.paint`, and it does not take on `partsOf`.

The focus block is the written prose. The rule the caller sees: the prose renders the same markdown, and the marker line stays the badge and is not a heading. A scenario name stays a `button.jump`. This surface has no line comment and no diff row. `focus.ts` already splits the marker off: the badge is the first line, and `focusBlockProse` is the rest, unrewritten. The live page stays that sentence. It is not the written prose. The prose today sits in a `pre`. This child renders the prose beside the badge. A jump is handled before the line click, and it stays that way.

A platform child stays unfiled. The text slot is already separate on each leaf: the children of the line button, `span.diff-text`, and the text parts of `FocusProse`. Nothing has to move before Plan and Design can place the renderer. That child unblocks Specify, Tasks, and the focus block. Specify does not need the diff grid to move first. Tasks does not need its copied loop to move first. The focus block does not need the badge split to move first.

Each child is a cycle in the remote-solver queue. `sdd link 27 parent <child>` makes this issue the host parent. A child that waits takes `sdd link <child> blocked-by <earlier>` on the host. Specify waits on the Plan and Design child. Tasks and the focus block wait on Specify. They do not wait on each other. This issue does not name their titles. The child names its surface and the rule above.

The click listener stays `button.line, button.diff-row`. Content inside the button, including a rendered link, stays inside that control. A comment on reload stays the review thread's path and source line, which is what `commentsOnLine` already matches.

Rejected: two children for Plan and Design. They share `PlanLines`. Rejected: a platform child before any surface. Rejected: one markdown document per section. Rejected: teaching Tasks to use `partsOf`. That would stop a `###` line being a comment target. Rejected: rendering the issue body, a second document viewer, editing the file from the sidebar, and implementing the engine in this issue.

After merge the children are already filed. No flag and no follow-up step.

## Open decisions

none
