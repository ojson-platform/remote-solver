## Problem

`remote-solver board` runs its spy with a parallel cap of 20. A poll that finds twenty ready cycles starts twenty agents. The twenty-first waits until one of those workers leaves.

## Outcome

`remote-solver board` runs its spy with a parallel cap of 20. A poll that finds twenty ready cycles starts twenty agents. The twenty-first waits until one of those workers leaves. `remote-solver spy` keeps the default cap of 2 and still honors `--parallel`.

## Scope

`remote-solver board` runs its spy with a parallel cap of 20. A poll that finds twenty ready cycles starts twenty agents. The twenty-first waits until one of those workers leaves.

## Out of scope

A `--parallel` flag on `board`. Removing the cap. Changing the spy command's default.

## Constraints

`remote-solver spy` keeps the default cap of 2 and still honors `--parallel`.

## Capabilities

### Added

### Modified

- `parallel-cap` `remote-solver board` runs its spy with a parallel cap of 20, and `remote-solver spy` keeps the default cap of 2 and still honors `--parallel`

## Open questions

none
