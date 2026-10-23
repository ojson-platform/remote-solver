## Why

The window still lays cycles out as a pool and seven columns, with a rail and a role shelf. The station row replaces that frame. Behavior is `docs/plans/2026-10-22-station-row.md`. Colors, fonts, and sizes stay in that plan's theme section and are not requirements here.

## What Changes

- The board becomes one column of keys and seven stations. An empty station keeps the same width.
- Take stays a login write and does not write a phase. The visible control is a play sign named «Взять». An exclamation replaces play on this ticket's break.
- A column card becomes a plaque. A gate on `proposing`, `specifying`, `designing`, or `accepting` writes or clears one auto label. A pool ticket with no plaque shows those four signs. Removing the last gate asks first. A door opens the port and does not write a phase.
- The open ticket opens a sidebar over the board from the right. Roles become verbs in that sidebar. Focus is not rewritten.

## Capabilities

### New Capabilities

### Modified Capabilities

- `board`: stations, plaque, take, gate, and door
- `sidebar`: the open ticket opens a sidebar over the board
- `role`: verbs replace the shelf and the drag

## Impact

`src/window`. The window still does not write a phase. A label that arrives after `sdd:wait-human` does not clear the wait.
