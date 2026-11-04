## Problem

Select a sidebar line without toggling its comment.

## Outcome

A sidebar line can be selected and copied. A drag that leaves selected text is not a click. It does not open the line's comment, and it does not close one that is already open. The field stays as it was. A click that leaves no selection still opens an empty field, still closes an empty field, and still leaves a field that holds text open.

## Scope

The line is one that takes a comment: a plan line, a design line, a spec line, or a diff line. A drag that leaves selected text is not a click. It does not open the line's comment, and it does not close one that is already open. The field stays as it was.

## Out of scope

The comment field itself. A click with no selection changing its present rule. Selecting text outside the sidebar.

## Constraints

A click that leaves no selection still opens an empty field, still closes an empty field, and still leaves a field that holds text open.

## Capabilities

### Added

- `line-select`: a drag that leaves selected text is not a click

### Modified

none

## Open questions

none
