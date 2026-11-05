# link-arrow

## Purpose

The mark for an issue this one waits on, and the mark for an issue this one holds, stand on the chip under the title.

## Requirements

### Requirement: The wait mark and the hold mark are triangles with no shaft

The mark for an issue this one waits on SHALL be a muted triangle pointing left, with no shaft.
The mark for an issue this one holds SHALL be a brass triangle pointing right, with no shaft.

#### Scenario: The wait mark is a muted triangle pointing left with no shaft

- **WHEN** a column card, a pool card, or the sidebar waits on an issue that is on the board
- **THEN** the chip under the title shows a muted triangle pointing left, with no shaft

#### Scenario: The hold mark is a brass triangle pointing right with no shaft

- **WHEN** a column card, a pool card, or the sidebar holds an issue that is on the board
- **THEN** the chip under the title shows a brass triangle pointing right, with no shaft

### Requirement: Both marks stand on the chip under the title

The wait mark and the hold mark SHALL stand on the chip under the title of a column card, of a pool card, and in the sidebar.

#### Scenario: A column card, a pool card, and the sidebar show the mark on the chip under the title

- **WHEN** a column card, a pool card, and the sidebar each wait on an issue or hold an issue that is on the board
- **THEN** each mark stands on the chip under the title
