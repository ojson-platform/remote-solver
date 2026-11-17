<!--
sdd-absorbed: 96b2f4da17722595
-->

## ADDED Requirements

### Requirement: The row renders the line as markdown

The spec row SHALL render the line as markdown. A heading, a list, emphasis, a link, and code in that line SHALL render as markdown, and their marks SHALL NOT stay characters of the text.

#### Scenario: A marked line renders as markdown

- **WHEN** the person opens Specify on a spec line that contains a heading, a list, emphasis, a link, and code
- **THEN** the row renders that heading, that list, that emphasis, that link, and that code as markdown, and those marks do not stay characters of the text

## MODIFIED Requirements

### Requirement: The line numbers and the fold bar stay

On a changed spec, the row SHALL show a baseline number cell and a folded number cell, and a cell with no number SHALL be empty. On a spec with no addition and no deletion, the row SHALL show one line number. Rendering the line as markdown SHALL NOT remove those number cells. A code block in the line SHALL NOT show a line number for each of its visual lines, and the following row SHALL show the next line number. A fold of unchanged lines SHALL be a fold bar, and that bar SHALL NOT be the comment control.

#### Scenario: A changed row keeps both number cells and the fold bar is separate

- **WHEN** the person opens Specify on a spec that has a change and a fold of unchanged lines
- **THEN** a changed row shows a baseline number cell and a folded number cell, and the fold is a fold bar separate from the row

#### Scenario: An unchanged spec shows one line number

- **WHEN** the person opens Specify on a spec that has no addition and no deletion
- **THEN** each row shows one line number

#### Scenario: A code block keeps the line numbers in sequence

- **WHEN** the person opens Specify on a changed spec line that contains a code block, and the following line is another spec line
- **THEN** that row shows a baseline number cell and a folded number cell, the code block does not show a line number for each of its visual lines, and the following row shows the next line number

## REMOVED Requirements

### Requirement: The row shows the line as text
