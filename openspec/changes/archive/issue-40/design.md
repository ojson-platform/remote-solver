## Verification boundary

`line-select`. The scenarios are observed on the line gesture in `src/window/client/gesture.ts` and on the face of the sidebar lines that take a comment. Plan and design lines are `button.line`. Spec and diff lines are `button.diff-row`. The click listener in `src/window/client/main.tsx` already matches both.

`A sidebar line can be selected and copied` is observed on the face stylesheet: those buttons set `user-select: text`, and the line text is the button text, so the browser can select it and copy it. `A drag that leaves selected text is not a click`, `The drag does not open the line's comment and does not close one that is already open`, and `The field stays as it was` are observed on the gesture the listener calls before `draftsAfterClick`: a non-collapsed selection inside the clicked line leaves the drafts unchanged, and the listener does not draw. `A click that leaves no selection still opens an empty field, still closes an empty field, and still leaves a field that holds text open` is observed on that same gesture falling through to `draftsAfterClick`, which already opens an empty field, closes an empty one, and keeps one that holds text.

The one-file command passes `--reporter=default` so that file can exit 0. The layer command keeps the coverage reporter.

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

A sidebar line that takes a comment is already a button. Plan and design lines are `button.line` in `DocumentLines` (`src/window/client/sidebar.tsx`). Spec and diff lines are `button.diff-row` in `DiffRow`. The click listener in `src/window/client/main.tsx` treats a click on either as `draftsAfterClick` (`src/window/client/gesture.ts`) and then draws. That draw replaces the button, so a drag that had selected the line text loses the selection and toggles the field.

The gesture gains one question, beside `draftsAfterClick`: `dragLeavesSelection`. It reads the document selection at click time. A non-collapsed selection whose text is non-empty, with an endpoint inside the clicked line, is a drag that left selected text. The listener returns before `draftsAfterClick` and before `draw`. The drafts stay as they were: a closed line stays closed, an open empty field stays open, and a field that holds text stays open. The selection stays, and the browser copies it.

A click that leaves no selection — a collapsed selection, an empty one, or a selection that does not meet the line — still calls `draftsAfterClick`. That function stays the click rule: it opens an empty field, closes an empty field, and leaves a field that holds text open. `line-field` keeps that rule. This change does not edit it.

The face lets the drag leave a selection. `src/window/face.css` sets `user-select: text` on `.spine button.line` and `.spine button.diff-row`. The listener does not cancel `mousedown`, so the browser can start the selection. This is not a colour, a ground, or a measure, so `FACE.md` stays.

The comment field is `form.line-note`, a sibling of the button. A click inside it does not match `button.line, button.diff-row`. That click stays out. Selecting text outside the sidebar does not meet the line, so it does not take this path.

`dragLeavesSelection` is re-exported from `src/window/page.ts` with `draftsAfterClick`, so the window test observes it the same way. After merge the listener asks the gesture and the face allows the selection. No flag and no follow-up step.

Rejected: a movement threshold. A drag that leaves no selected text is still a click. Rejected: treating any document selection as not a click. Selecting text outside the sidebar is out of scope, and the selection has to meet the clicked line. Rejected: changing `draftsAfterClick`. A click with no selection keeps that rule. Rejected: replacing the button with another element. The line stays the control the listener already matches. Rejected: a copy control. The browser copies the selection that the listener left in place.

## Open decisions

none
