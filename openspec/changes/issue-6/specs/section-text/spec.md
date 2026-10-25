## RENAMED Requirements

- FROM: `### Requirement: The Plan row stops Problem and Outcome at the first blank line`
- TO: `### Requirement: The Plan row shows the whole Problem and the whole Outcome`
- FROM: `### Requirement: The Design row stops a boundary and an approach at the first blank line`
- TO: `### Requirement: The Design row shows the whole boundary and the whole approach`

## MODIFIED Requirements

### Requirement: The Plan row shows the whole Problem and the whole Outcome

When Problem or Outcome has text, the Plan row SHALL show the whole text of that section, including the text after a blank line. A line break that is not a blank line SHALL leave the following words in that text. A section that has no text SHALL show no heading. A section whose text is none SHALL show none.

#### Scenario: Both paragraphs of Problem and Outcome are shown

- **WHEN** Problem has a first paragraph, a blank line, and a second paragraph, and Outcome is written the same way
- **THEN** the Plan row shows the first paragraph and the second paragraph of Problem and of Outcome

#### Scenario: A line break inside the paragraph stays

- **WHEN** Problem is two lines with no blank line between them
- **THEN** the Plan row shows the words of both lines

#### Scenario: A section whose text is none shows none

- **WHEN** Outcome has no text other than none
- **THEN** the Plan row shows none under Outcome

#### Scenario: An empty section has no heading

- **WHEN** Outcome has text and Problem has no text
- **THEN** the Plan row shows the Outcome and has no Problem heading

### Requirement: The Design row shows the whole boundary and the whole approach

When Verification boundary or Approach has text, the Design row SHALL show the whole text of that section, including the text after a blank line. A section that has no text SHALL show no heading. A section whose text is none SHALL show none. Besides Verification boundary, Approach, and Open decisions, the row SHALL show no section.

#### Scenario: Both paragraphs of the boundary are shown

- **WHEN** Verification boundary has a first paragraph, a blank line, and a second paragraph
- **THEN** the Design row shows the first paragraph and the second paragraph

#### Scenario: Both paragraphs of the approach are shown

- **WHEN** Approach has a first paragraph, a blank line, and a second paragraph
- **THEN** the Design row shows the first paragraph and the second paragraph

#### Scenario: None stays none

- **WHEN** Verification boundary has no text other than none
- **THEN** the Design row shows none under Verification boundary

#### Scenario: Another section stays off the row

- **WHEN** External contracts has two paragraphs and Verification boundary has no text other than none
- **THEN** the Design row shows none and does not show External contracts

### Requirement: A rejected line stays past a blank line and is shown again inside a section

The Design row SHALL show each line that starts with `Отклонено:`, including a line that sits after a blank line.
When that line is already in section text the row shows, the row SHALL show the line again on its own.

#### Scenario: A rejected line past the blank line is shown

- **WHEN** Approach has a first paragraph, a blank line, a second paragraph, and a line after that blank line that starts with `Отклонено:`
- **THEN** the Design row shows the first paragraph, the second paragraph, and that line
- **AND** shows that line again on its own

#### Scenario: A rejected line inside the shown text is shown again

- **WHEN** the first paragraph of Approach contains a line that starts with `Отклонено:`
- **THEN** the Design row shows that line in the approach and shows it again on its own
