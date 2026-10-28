# section-text

## Purpose

The Plan row, the Design row, and the Specify row show the text of a section. This is that text as the rows show it today.

## Requirements

### Requirement: The Plan row stops Problem and Outcome at the first blank line

When Problem or Outcome has text, the Plan row SHALL show that text up to the first blank line. A line break that is not a blank line SHALL leave the following words in that text. A section that has no text SHALL show no heading. A section whose text is none SHALL show none.

#### Scenario: The second paragraph is absent

- **WHEN** Problem has a first paragraph, a blank line, and a second paragraph, and Outcome is written the same way
- **THEN** the Plan row shows the first paragraph of Problem and the first paragraph of Outcome
- **AND** the second paragraph of each section is absent

#### Scenario: A line break inside the paragraph stays

- **WHEN** Problem is two lines with no blank line between them
- **THEN** the Plan row shows the words of both lines

#### Scenario: A section whose text is none shows none

- **WHEN** Outcome has no text other than none
- **THEN** the Plan row shows none under Outcome

#### Scenario: An empty section has no heading

- **WHEN** Outcome has text and Problem has no text
- **THEN** the Plan row shows the Outcome and has no Problem heading

### Requirement: The Design row stops a boundary and an approach at the first blank line

When Verification boundary or Approach has text, the Design row SHALL show that text up to the first blank line. A section that has no text SHALL show no heading. A section whose text is none SHALL show none. Besides Verification boundary, Approach, and Open decisions, the row SHALL show no section.

#### Scenario: The second paragraph of the boundary is absent

- **WHEN** Verification boundary has a first paragraph, a blank line, and a second paragraph
- **THEN** the Design row shows the first paragraph and the second paragraph is absent

#### Scenario: None stays none

- **WHEN** Verification boundary has no text other than none
- **THEN** the Design row shows none under Verification boundary

#### Scenario: Another section stays off the row

- **WHEN** External contracts has two paragraphs and Verification boundary has no text other than none
- **THEN** the Design row shows none and does not show External contracts

### Requirement: Open decisions keeps the text after a blank line

When Open decisions has text, the Design row SHALL show the whole section, including the text after a blank line.

#### Scenario: Both paragraphs of Open decisions are shown

- **WHEN** Open decisions has a first paragraph, a blank line, and a second paragraph
- **THEN** the Design row shows the text of both paragraphs

### Requirement: A rejected line stays past a blank line and is shown again inside a section

The Design row SHALL show each line that starts with `Отклонено:`, including a line that sits after a blank line.
When that line is already in section text the row shows, the row SHALL show the line again on its own.

#### Scenario: A rejected line past the blank line is shown

- **WHEN** Approach has a first paragraph, a blank line, a second paragraph, and a line after that blank line that starts with `Отклонено:`
- **THEN** the Design row shows the first paragraph and that line
- **AND** the second paragraph is absent

#### Scenario: A rejected line inside the shown text is shown again

- **WHEN** the first paragraph of Approach contains a line that starts with `Отклонено:`
- **THEN** the Design row shows that line in the approach and shows it again on its own

### Requirement: Specify shows the whole requirement body before the first scenario

The Specify row SHALL show each requirement the change adds, modifies, or removes. The body before the first scenario SHALL include the text after a blank line. Every WHEN and every THEN that carries text SHALL be shown. A requirement under another heading SHALL stay off the row.

#### Scenario: The paragraph after a blank line stays

- **WHEN** a modified requirement has a first paragraph, a blank line, and a second paragraph before its first scenario
- **THEN** the Specify row shows the words of both paragraphs

#### Scenario: Every WHEN and THEN is shown

- **WHEN** a scenario has two WHEN lines and two THEN lines
- **THEN** the Specify row shows both WHEN lines and both THEN lines

#### Scenario: A requirement under another heading stays off the row

- **WHEN** the change's only requirement sits under a heading other than added, modified, or removed
- **THEN** the Specify row shows no requirement
