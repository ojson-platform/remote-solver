## Problem

Render focus block prose as markdown.

The focus block (written prose beside the badge).

The prose today sits in a `pre`; this child renders the prose beside the badge.

The prose renders markdown (headings, lists, emphasis, links, and code). The marker line stays the badge and is not a heading. A scenario name stays a `button.jump`. This surface has no line comment and no diff row.

## Outcome

The prose renders markdown (headings, lists, emphasis, links, and code). The marker line stays the badge and is not a heading. A scenario name stays a `button.jump`. This surface has no line comment and no diff row.

The prose today sits in a `pre`; this child renders the prose beside the badge. A jump is handled before the line click, and it stays that way.

The live page sentence is not the written prose.

## Scope

The focus block (written prose beside the badge).

The prose renders markdown (headings, lists, emphasis, links, and code). The marker line stays the badge and is not a heading. A scenario name stays a `button.jump`. This surface has no line comment and no diff row.

This child calls the shared line renderer. It does not introduce a second parser.

`focus.ts` already splits the marker off: the badge is the first line, and `focusBlockProse` is the rest, unrewritten.

## Out of scope

Plan, Design, Specify, and Tasks (sibling children of host #27). Editing the file from the sidebar. A second document viewer. Rendering the issue body.

## Constraints

The marker line stays the badge and is not a heading. A scenario name stays a `button.jump`. This surface has no line comment and no diff row.

`focus.ts` already splits the marker off: the badge is the first line, and `focusBlockProse` is the rest, unrewritten. The live page sentence is not the written prose. A jump is handled before the line click, and it stays that way.

This child calls the shared line renderer. It does not introduce a second parser.

## Capabilities

### Added

### Modified

- `focus-prose` the written prose beside the badge renders markdown (headings, lists, emphasis, links, and code), and the marker line stays the badge and is not a heading

## Open questions

none

## Shelf

- focus-prose
