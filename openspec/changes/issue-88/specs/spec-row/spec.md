<!--
sdd-absorbed: 96b2f4da17722595
-->

## ADDED Requirements

### Requirement: The row renders the line as markdown

The spec row SHALL render the line as markdown. A heading, a list, emphasis, a link, and code in that line SHALL render as markdown, and their marks SHALL NOT stay characters of the text.

#### Scenario: A marked line renders as markdown

- **WHEN** the person opens Specify on a spec line that contains a heading, a list, emphasis, a link, and code
- **THEN** the row renders that heading, that list, that emphasis, that link, and that code as markdown, and those marks do not stay characters of the text

## REMOVED Requirements

### Requirement: The row shows the line as text
