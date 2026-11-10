# auto-gate

## Purpose

A human gate on `proposing`, `specifying`, `designing`, and `accepting` is one auto label. The station and the open row set and clear that label.

## Requirements

### Requirement: A future gate sets or clears one auto label

A human gate exists on `proposing`, `specifying`, `designing`, and `accepting`.

On a row that has a plaque, the sign SHALL stand only ahead of the plaque and only while that station has no file.

On a pool cycle with no plaque, the sign SHALL stand on each of those four stations.

When the gate is on, the sign SHALL be Gandalf and its accessible name SHALL be «Снять гейт» plus the station name.

#### Scenario: Gandalf writes one auto label and does not write a phase

A click SHALL write that one label: `sdd:auto-plan`, `sdd:auto-spec`, `sdd:auto-design`, or `sdd:auto-merge`.

The click SHALL NOT write a phase, `proposed`, `specified`, `designed`, or `accepted`.

When the gate is off, the sign SHALL be an empty circle and its accessible name SHALL be «Поставить гейт» plus the station name.

A click SHALL remove that one label.

A started or passed station SHALL NOT show the button on the board, and a board click SHALL NOT change the label there.

When a future station already has a door, the board SHALL show the door.

A click SHALL NOT remove `sdd:wait-human`.

A station with no gate and no file SHALL be a dot, including a station behind the plaque.

A dot SHALL NOT be a button.

`accepted` SHALL NOT be set by this button.

Removing the last gate that is still on SHALL ask before the write.

The question SHALL say that the cycle will be left without control.

Dismissing it SHALL leave the label as it was.

Confirming it SHALL write that one label.

A click SHALL be written for its station when an earlier click on another station has not yet been accepted.

Both clicks SHALL write their own labels.

A tracker reading that does not yet contain a label this click wrote SHALL leave that gate off.

Once a reading contains that label, the click is confirmed.

A later reading that lacks it SHALL show the gate on again.

When the write fails and no later click has replaced that label, the gate SHALL return to the sign it had before the click.

- **WHEN** the plaque is on `proposing`, `designing` has no file, and the gate is on
- **THEN** the `designing` station is Gandalf named «Снять гейт designing», and a click adds `sdd:auto-design` and does not write a phase

#### Scenario: A circle removes that one label

- **WHEN** the gate on `specifying` is off and the station is still ahead of the plaque with no file
- **THEN** the station is an empty circle named «Поставить гейт specifying», and a click removes `sdd:auto-spec`

#### Scenario: A started phase has no gate button

- **WHEN** the plaque is on `specifying`
- **THEN** the `proposing` and `specifying` stations have no gate button

#### Scenario: A door keeps the gate button in the open row

- **WHEN** a future station already has a file
- **THEN** the board shows the door on that station and the sidebar still has the gate button

#### Scenario: A pool cycle sets a gate

- **WHEN** a pool cycle has no plaque and the manager turns off `proposing`
- **THEN** the four gate stations are buttons, `tasking` is a dot, the click adds `sdd:auto-plan`, and the window does not write a phase or `accepted`

#### Scenario: Accepting sets auto-merge

- **WHEN** the manager turns off `accepting` on a pool cycle
- **THEN** the click adds `sdd:auto-merge` and does not add `accepted` or write a phase

#### Scenario: The last gate asks before it clears

- **WHEN** three gates are already off and the manager turns off the last one
- **THEN** the window asks, the label stays, dismissing the question writes nothing, and confirming adds `sdd:auto-merge` without `accepted`

#### Scenario: An auto label does not clear the wait

- **WHEN** the cycle has `sdd:wait-human` and the manager sets `sdd:auto-spec`
- **THEN** `sdd:wait-human` remains

#### Scenario: A station behind the plaque with no file is a dot

- **WHEN** the plaque is on `implementing` and `tasking` has no file
- **THEN** `tasking` is a dot and is not a button

#### Scenario: A second station is cleared while the first click is still being accepted

- **WHEN** the plaque is on `proposing` and the manager clears `designing`, then clears `specifying` before the first request is accepted
- **THEN** both requests succeed, and the cycle has `sdd:auto-design` and `sdd:auto-spec`

#### Scenario: A reading from before the click leaves the gate off

- **WHEN** the manager has cleared `designing` and a tracker reading still lacks `sdd:auto-design`
- **THEN** `designing` stays off, a reading that contains `sdd:auto-design` confirms the click, and a later reading that lacks it shows the gate on

#### Scenario: A failed write restores the gate

- **WHEN** clearing `designing` fails and no later click has replaced that label
- **THEN** `designing` is on again

### Requirement: The open row shows three gate lines

The spine SHALL show a gate button on Plan, Specify, Design, and Accept, for `proposing`, `specifying`, `designing`, and `accepting`, except on the row of the phase the plaque is standing on when that phase is `proposing`, `specifying`, or `designing`.

That row SHALL NOT show its gate button.

Acceptance stands in that place when `openspec/specs/acceptance/spec.md` offers it, and that place SHALL be empty when it does not.

The Accept row SHALL keep its gate while the plaque is `accepting`.

#### Scenario: A passed gate is controlled from the sidebar

Every other gate SHALL stay, including when the board station is a door, a plaque, or a dot.

The button face SHALL be the sign alone.

The empty sign SHALL be the smaller circle.

The set sign SHALL be the larger circle.

Its accessible name SHALL stay «Поставить гейт …» or «Снять гейт …».

A click in the sidebar SHALL write or remove that one label even when the board would not.

- **WHEN** the plaque is on `implementing` and `sdd:auto-plan` is set
- **THEN** the board `proposing` station is a dot, and the sidebar line is the circle «Поставить гейт proposing» whose click removes `sdd:auto-plan`. That circle is smaller than the set sign

#### Scenario: A future gate repeats the station button

- **WHEN** the plaque is on `proposing` and `designing` has a door
- **THEN** the `designing` line in the sidebar has the gate button, and that sign is the set sign
