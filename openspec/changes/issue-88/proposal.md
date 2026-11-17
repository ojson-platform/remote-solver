## Problem

Specify in the change sidebar (the spec diff: `SpecRows` paints `DiffRow`).

The row text renders markdown (headings, lists, emphasis, links, and code). The row keeps its add and delete coloring and its comment control. A click opens the remark draft.

This cycle calls the shared line renderer the Plan and Design child introduced. It does not reintroduce a second parser.

## Outcome

The row text renders markdown (headings, lists, emphasis, links, and code). The row keeps its add and delete coloring and its comment control. A click opens the remark draft.

Coloring stays the row class `diff-row` plus `add`, `del`, or `ctx`, and `span.bit` on a changed span. The comment control is the row button, not a `button.line`. `data-line` stays `row.text`. When the row has an anchor, it stays `row.anchor` (path, line, side `right`). Number cells, `data-scenario`, and the fold bar stay. A row with no anchor still opens a draft and still shows no posted line comment.

## Scope

Specify in the change sidebar (the spec diff: `SpecRows` paints `DiffRow`).

The row text renders markdown (headings, lists, emphasis, links, and code). The row keeps its add and delete coloring and its comment control. A click opens the remark draft.

This cycle calls the shared line renderer the Plan and Design child introduced. It does not reintroduce a second parser.

## Out of scope

Plan, Design, Tasks, and the focus block (sibling children of host #27). Editing the file from the sidebar. A second document viewer. Rendering the issue body.

## Constraints

Coloring stays the row class `diff-row` plus `add`, `del`, or `ctx`, and `span.bit` on a changed span. The comment control is the row button, not a `button.line`. `data-line` stays `row.text`. When the row has an anchor, it stays `row.anchor` (path, line, side `right`). Number cells, `data-scenario`, and the fold bar stay. A row with no anchor still opens a draft and still shows no posted line comment.

This cycle calls the shared line renderer the Plan and Design child introduced. It does not reintroduce a second parser.

## Capabilities

### Added

### Modified

- `spec-row` the row text renders markdown (headings, lists, emphasis, links, and code), and the row keeps its add and delete coloring and its comment control

## Open questions

none

## Shelf

- spec-row
