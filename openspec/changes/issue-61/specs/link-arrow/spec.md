## RENAMED Requirements

- FROM: `### Requirement: The wait mark and the hold mark are triangles with no shaft`
- TO: `### Requirement: The wait mark and the hold mark are arrows with a shaft and a head`

## MODIFIED Requirements

### Requirement: The wait mark and the hold mark are arrows with a shaft and a head

The mark for an issue this one waits on, and the mark for an issue this one holds, SHALL be arrows with a shaft and a head. A naked triangle SHALL NOT be the mark, so neither SHALL read as the play control. The wait SHALL stay a muted arrow to the left. The hold SHALL stay a brass arrow to the right. The child SHALL stay a light corner, down and then right, with no arrowhead, and it SHALL still stand only on the parent.

#### Scenario: The mark for an issue this one waits on, and the mark for an issue this one holds, are arrows with a shaft and a head

- **WHEN** the mark for an issue this one waits on and the mark for an issue this one holds are already arrows with a shaft and a head, together with a naked triangle as the limit that can replace those arrows
- **THEN** the mark for an issue this one waits on, and the mark for an issue this one holds, are arrows with a shaft and a head

#### Scenario: A naked triangle is not the mark, so neither reads as the play control

- **WHEN** the mark for an issue this one waits on and the mark for an issue this one holds are already visible, a naked triangle is already not the mark, and neither reads as the play control, together with the play control as the limit that can replace those marks
- **THEN** a naked triangle is not the mark, so neither reads as the play control

#### Scenario: The wait stays a muted arrow to the left

- **WHEN** the wait is already a muted arrow to the left, together with a brass arrow to the right as the limit that can replace that muted arrow
- **THEN** the wait stays a muted arrow to the left

#### Scenario: The hold stays a brass arrow to the right

- **WHEN** the hold is already a brass arrow to the right, together with a muted arrow to the left as the limit that can replace that brass arrow
- **THEN** the hold stays a brass arrow to the right

#### Scenario: The child stays a light corner, down and then right, with no arrowhead, and it still stands only on the parent

- **WHEN** the child is already a light corner, down and then right, with no arrowhead, and it already stands only on the parent, together with an arrow with a shaft and a head as the limit that can replace that corner
- **THEN** the child stays a light corner, down and then right, with no arrowhead, and it still stands only on the parent

### Requirement: Both marks stand on the chip under the title

The wait mark and the hold mark SHALL stand on the chip under the title of a column card, of a pool card, and in the sidebar.

#### Scenario: Both stand on the chip under the title, on a column card, a pool card, and in the sidebar

- **WHEN** the mark for an issue this one waits on and the mark for an issue this one holds already stand on the chip under the title, on a column card, a pool card, and in the sidebar, together with a mark off the chip under the title as the limit that can replace that chip
- **THEN** both stand on the chip under the title, on a column card, a pool card, and in the sidebar
