## Problem

Mark the implementing task and shrink the badges.

## Outcome

In Tasks, the first open task of a cycle in `implementing` shows the badge `impl`. A done task keeps `готово`. An open task that is not the current one keeps `открыто`. A cycle outside `implementing` has no `impl` badge.

`impl`, `готово`, `открыто`, and the spec badges `new`, `changed`, and `removed` share one compact mark: smaller padding, no glow, one line.

## Scope

In Tasks, the badge on the first open task of a cycle in `implementing`, and the one compact mark shared by `impl`, `готово`, `открыто`, and the spec badges `new`, `changed`, and `removed`.

## Out of scope

A badge per scenario. A second word on the mark. Choosing a task other than the first open one.

## Constraints

A done task keeps `готово`. An open task that is not the current one keeps `открыто`. A cycle outside `implementing` has no `impl` badge. The mark stays one line, with smaller padding and no glow.

## Capabilities

### Added

- `compact-mark` `impl`, `готово`, `открыто`, and the spec badges `new`, `changed`, and `removed` share one compact mark: smaller padding, no glow, one line

### Modified

- `task-mark` the first open task of a cycle in `implementing` shows `impl`, a done task keeps `готово`, an open task that is not the current one keeps `открыто`, and a cycle outside `implementing` has no `impl` badge

## Open questions

none
