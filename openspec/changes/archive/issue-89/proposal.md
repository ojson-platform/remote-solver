## Problem

Tasks in the change sidebar (`TaskFile`).

`TaskFile` does not paint `LineNote` today. Each source line renders markdown (headings, lists, emphasis, links, and code). The line stays a comment target. A click opens the remark draft. There is no diff row.

The child calls the shared line renderer. It does not copy a second parser into `TaskFile.paint`, and it does not take on `partsOf`.

## Outcome

Each source line renders markdown (headings, lists, emphasis, links, and code). The line stays a comment target. A click opens the remark draft. There is no diff row.

This surface does not use `partsOf`, so a `###` line stays a button. The path stays `<readPath>/tasks/<id>.md`. The click in `src/window/client/main.tsx` already stores the draft, and this child paints it.

## Scope

Tasks in the change sidebar (`TaskFile`).

Each source line renders markdown (headings, lists, emphasis, links, and code). The line stays a comment target. A click opens the remark draft. There is no diff row.

This surface does not use `partsOf`, so a `###` line stays a button. The path stays `<readPath>/tasks/<id>.md`. The child calls the shared line renderer. It does not copy a second parser into `TaskFile.paint`, and it does not take on `partsOf`.

## Out of scope

Plan, Design, Specify, and the focus block (sibling children of host #27). Editing the file from the sidebar. A second document viewer. Rendering the issue body.

## Constraints

The line stays a comment target. A click opens the remark draft. There is no diff row. This surface does not use `partsOf`, so a `###` line stays a button. The path stays `<readPath>/tasks/<id>.md`.

The click in `src/window/client/main.tsx` already stores the draft, and this child paints it. The child calls the shared line renderer. It does not copy a second parser into `TaskFile.paint`, and it does not take on `partsOf`.

## Capabilities

### Added

- `task-line` each source line renders markdown (headings, lists, emphasis, links, and code), the line stays a comment target, a click opens the remark draft, and there is no diff row

### Modified

## Open questions

none

## Shelf

- task-line
