## Problem

Plan and Design in the change sidebar (`PlanDocument` and `DesignDocument` through `PlanLines`).

On each surface, every source line the leaf paints renders markdown (headings, lists, emphasis, links, and code). The line stays a comment target. A click opens the remark draft on that line. There is no diff row.

This cycle introduces the shared line renderer in the window that later surface children call.

## Outcome

On each surface, every source line the leaf paints renders markdown (headings, lists, emphasis, links, and code). The line stays a comment target. A click opens the remark draft on that line. There is no diff row.

`PlanLines` stays the leaf. `data-line` is the source line with trailing space removed and stays the draft key. `data-path` is `proposal.md` or `design.md` under the change read path. `data-at` is the source line number `sectionsOf` already assigns. `data-side` is `right`. `LineNote` and posted line comments stay on that path and line. On Design, `model.design.questions` is passed only for Open questions; every other section passes an empty list so a checkbox outside Open questions stays a line comment. A `##` line stays the section `h3`, not a button. A `###` line stays the `h4` from `partsOf`, not a button. A run of blank lines stays one `span.gap`. With no pull request, the line stays a `p.line` and is not a comment target. The phase foot stays outside the document.

## Scope

Plan and Design in the change sidebar (`PlanDocument` and `DesignDocument` through `PlanLines`).

On each surface, every source line the leaf paints renders markdown (headings, lists, emphasis, links, and code). The line stays a comment target. A click opens the remark draft on that line. There is no diff row.

This cycle introduces the shared line renderer in the window that later surface children call. `PlanLines` stays the leaf.

## Out of scope

Specify, Tasks, and the focus block (sibling children of host #27). Editing the file from the sidebar. A second document viewer. Rendering the issue body.

## Constraints

The line stays a comment target. A click opens the remark draft on that line. There is no diff row.

`PlanLines` stays the leaf. `data-line` is the source line with trailing space removed and stays the draft key. `data-path` is `proposal.md` or `design.md` under the change read path. `data-at` is the source line number `sectionsOf` already assigns. `data-side` is `right`. `LineNote` and posted line comments stay on that path and line. On Design, `model.design.questions` is passed only for Open questions; every other section passes an empty list so a checkbox outside Open questions stays a line comment. A `##` line stays the section `h3`, not a button. A `###` line stays the `h4` from `partsOf`, not a button. A run of blank lines stays one `span.gap`. With no pull request, the line stays a `p.line` and is not a comment target. The phase foot stays outside the document.

## Capabilities

### Added

- `source-line` every source line the leaf paints renders markdown (headings, lists, emphasis, links, and code), and the line stays a comment target

### Modified

## Open questions

none

## Shelf

- source-line
